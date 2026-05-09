module.exports = {
  apps: [{
    name: "unirun",
    script: "/www/wwwroot/autorun-local/server.js",  // 🚨 改成绝对路径！
    cwd: "/www/wwwroot/autorun-local/",             // 🚨 强制绑定工作目录！
    watch: false,
    env: {
      NODE_ENV: "production",
      PORT: 5891
    }
  }]
}
