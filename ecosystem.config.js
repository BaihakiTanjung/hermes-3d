module.exports = {
  apps: [
    {
      name: "hermes-backend",
      script: "hermes",
      args: "serve --port 9119 --skip-build",
      env: {
        HERMES_DASHBOARD_SESSION_TOKEN: process.env.HERMES_DASHBOARD_SESSION_TOKEN || "mysecrettoken123",
      },
      restart_delay: 4000,
      autorestart: true,
    },
    {
      name: "hermes3d-ui",
      cwd: __dirname,
      script: "node",
      args: "server/index.js",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        HOST: "0.0.0.0",
        STUDIO_ACCESS_TOKEN: process.env.STUDIO_ACCESS_TOKEN || "mysecrettoken123",
      },
      restart_delay: 4000,
      autorestart: true,
    },
  ],
};
