module.exports = {
  apps: [
    {
      name: "hermes3d-ui",
      cwd: __dirname,
      script: "server/index.js",
      env: {
        NODE_ENV: process.env.NODE_ENV || "production",
        PORT: process.env.PORT || 3000,
        HOST: process.env.HOST || "0.0.0.0",
        // Forward auth token UI dari Secret K8s
        STUDIO_ACCESS_TOKEN: process.env.STUDIO_ACCESS_TOKEN || "",
        // Forward WebSocket upstream gateway Hermes ke backend host VPS
        HERMES3D_GATEWAY_URL: process.env.HERMES3D_GATEWAY_URL || "",
        HERMES3D_GATEWAY_TOKEN: process.env.HERMES3D_GATEWAY_TOKEN || "",
        HERMES3D_ADAPTER_TYPE: process.env.HERMES3D_ADAPTER_TYPE || "hermes-agent",
        HERMES_STATE_DIR: process.env.HERMES_STATE_DIR || "",
      },
      restart_delay: 4000,
      autorestart: true,
    },
    {
      name: "hermes-adapter",
      cwd: __dirname,
      script: "server/hermes-gateway-adapter.js",
      env: {
        HERMES_ADAPTER_PORT: process.env.HERMES_ADAPTER_PORT || 18789,
        HERMES_ADAPTER_HOST: process.env.HERMES_ADAPTER_HOST || "0.0.0.0",
        HERMES_API_URL: process.env.HERMES_API_URL || "http://localhost:8642",
        HERMES_API_KEY: process.env.HERMES_API_KEY || "",
      },
      restart_delay: 4000,
      autorestart: true,
    },
  ],
};
