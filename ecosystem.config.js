module.exports = {
  apps: [
    {
      name: "hermes-backend",
      script: "hermes",
      args: "serve --host 0.0.0.0 --port 9119 --skip-build",
      env: {
        // Token session gateway untuk koneksi WebSocket dari Hermes3D UI
        HERMES_DASHBOARD_SESSION_TOKEN: process.env.HERMES_DASHBOARD_SESSION_TOKEN || "mysecrettoken123",
        // Wajib saat bind 0.0.0.0 agar hermes serve tidak meminta prompt interaktif username/password
        HERMES_DASHBOARD_USERNAME: process.env.HERMES_DASHBOARD_USERNAME || "admin",
        HERMES_DASHBOARD_PASSWORD: process.env.HERMES_DASHBOARD_PASSWORD || "hermesadmin123",
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
