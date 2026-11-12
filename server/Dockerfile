# syntax=docker/dockerfile:1

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# bcrypt ships a musl prebuild, so no compiler toolchain is needed on Alpine.
RUN npm ci --omit=dev && npm cache clean --force

FROM node:24-alpine AS runtime
ENV NODE_ENV=production \
    PORT=5000
WORKDIR /app
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src
USER node
EXPOSE 5000
# /api/health returns 503 while MongoDB is disconnected, which marks the container unhealthy.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5000/api/health > /dev/null || exit 1
STOPSIGNAL SIGTERM
# Exec form (no shell wrapper) so SIGTERM reaches node and triggers the graceful shutdown in server.js.
CMD ["node", "src/server.js"]
