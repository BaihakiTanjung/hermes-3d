module.exports = {
  apps: [
    {
      name: "hermes3d-ui",
      cwd: __dirname,
      script: "node",
      args: "server/index.js",
      env: {
        NODE_ENV: "production",
        PORT: process.env.PORT || 3000,
        HOST: process.env.HOST || "0.0.0.0",
        STUDIO_ACCESS_TOKEN: process.env.STUDIO_ACCESS_TOKEN || "mysecrettoken123",
      },
      restart_delay: 4000,
      autorestart: true,
    },
    {
      name: "hermes-adapter",
      cwd: __dirname,
      script: "node",
      args: "server/hermes-gateway-adapter.js",
      env: {
        // Port adapter websocket (default: 18789)
        HERMES_GATEWAY_PORT: process.env.HERMES_GATEWAY_PORT || 18789,
        HERMES_ADAPTER_HOST: process.env.HERMES_ADAPTER_HOST || "10.20.0.18",
        // Target endpoint Hermes HTTP API upstream (default: http://localhost:8642)
        HERMES_API_URL: process.env.HERMES_API_URL || "http://localhost:8642",
        HERMES_API_KEY: process.env.HERMES_API_KEY || "",
      },
      restart_delay: 4000,
      autorestart: true,
    },
  ],
};
