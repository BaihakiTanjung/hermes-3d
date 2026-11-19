# Multi-stage build for Hermes3D running with PM2 in production.
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --omit=dev

FROM node:22-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_GATEWAY_URL=ws://127.0.0.1:9119
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOST=0.0.0.0

# Install PM2 globally
RUN npm install -g pm2 && npm cache clean --force

# Copy build artifacts and runtime dependencies
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/server ./server
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY ecosystem.config.js ./ecosystem.config.js

# Ensure cache directory exists and node user owns the runtime files
RUN mkdir -p /app/.next/cache && chown -R node:node /app

USER node

EXPOSE 3000

# pm2-runtime runs as PID 1, forwards signals, streams logs directly to docker/k8s stdout
CMD ["pm2-runtime", "start", "ecosystem.config.js", "--only", "hermes3d-ui"]
