const express = require('express');
const crypto = require('crypto');

async function getFetch() {
  if (typeof fetch === 'function') return fetch;
  const mod = await import('node-fetch');
  return mod.default;
}

function genSign({ appKey, appSecret, query = null, body = null }) {
  let signStr = '';

  if (query !== null) {
    const normalizedQuery = Object.entries(query).reduce((acc, [k, v]) => {
      acc[k] = v == null ? '' : String(v);
      return acc;
    }, {});

    const sortedKeys = Object.keys(normalizedQuery).sort();

    for (const key of sortedKeys) {
      const value = normalizedQuery[key];
      if (value === undefined || value === null) continue;
      signStr += key + value;
    }
  }

  signStr += appKey;
  signStr += appSecret;

  if (body !== null) {
    signStr += typeof body === 'string' ? body : JSON.stringify(body);
  }

  signStr = signStr
    .replace(/ /g, '')
    .replace(/~/g, '')
    .replace(/!/g, '')
    .replace(/\(/g, '')
    .replace(/\)/g, '')
    .replace(/'/g, '');

  signStr = encodeURIComponent(signStr);

  const hex = crypto
    .createHash('md5')
    .update(signStr, 'utf8')
    .digest('hex')
    .toUpperCase();

  return `${hex}encodeutf8`;
}

function normalizeQuery(query) {
  const out = {};
  if (!query) return out;
  for (const [k, raw] of Object.entries(query)) {
    let v = raw;
    if (Array.isArray(v)) v = v[0];
    out[k] = v == null ? '' : String(v);
  }
  return out;
}

async function unirunRequest({ upstream, appKey, appSecret, apiPath, method = 'GET', token = '', query = null, body = null }) {
  const f = await getFetch();

  const sign = genSign({ appKey, appSecret, query, body });

  const headers = {
    'Accept-Encoding': 'gzip',
    'User-Agent': 'okhttp/4.12.0',
    'Content-Type': 'application/json; charset=UTF-8',
    'appkey': appKey,
    'sign': sign,
  };
  if (token) headers['token'] = token;

  let url = upstream + apiPath;
  if (query && Object.keys(query).length > 0) {
    const params = new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)]));
    url += '?' + params.toString();
  }

  const init = { method, headers };
  if (body !== null && method !== 'GET') {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const resp = await f(url, init);
  const text = await resp.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    return { code: 500, msg: `invalid_json_response (${resp.status})`, response: null };
  }
}

function resolveToken(req) {
  const direct = String(req.headers?.token || '').trim();
  if (direct) return direct;
  const auth = String(req.headers?.authorization || '').trim();
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : '';
}

function createUnirunProxyRouter(config) {
  const router = express.Router();
  const upstream = String(config?.upstream || '').trim();
  const appKey = String(config?.appKey || '').trim();
  const appSecret = String(config?.appSecret || '').trim();

  router.all(/^\/(auth|unirun|clubactivity)\//, async (req, res) => {
    try {
      const method = String(req.method || 'GET').toUpperCase();
      const token = resolveToken(req);
      const query = normalizeQuery(req.query || null);
      const body = method === 'GET' ? null : (req.body ?? null);

      const data = await unirunRequest({
        upstream,
        appKey,
        appSecret,
        apiPath: req.path,
        method,
        token,
        query,
        body,
      });

      res.status(200).json(data);
    } catch (err) {
      res.status(200).json({ code: 500, msg: err?.message || 'proxy_error', response: null });
    }
  });

  return router;
}

module.exports = { createUnirunProxyRouter };
