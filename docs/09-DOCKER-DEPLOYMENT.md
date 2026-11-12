# 09 — Docker & Deployment

## 1. Docker images
### Backend — `server/Dockerfile`
Multi-stage:
1. `deps` — `node:24-alpine`, `npm ci --omit=dev` (production deps only).
2. `runtime` — `node:24-alpine`, `NODE_ENV=production`, copy `node_modules` + `src` + `package.json`, `USER node`, `EXPOSE 5000`, `HEALTHCHECK` using `wget -qO- http://127.0.0.1:5000/api/health`, `CMD ["node","src/server.js"]` (exec form → receives SIGTERM directly; server shuts down gracefully).

### Frontend — `client/Dockerfile`
1. `build` — `node:24-alpine`, `npm ci`, `npm run build` (accepts `ARG VITE_API_BASE_URL=/api`).
2. `runtime` — `nginxinc/nginx-unprivileged:1.27-alpine` (runs as uid 101), copy `dist` and `nginx.conf`, `EXPOSE 8080`, `HEALTHCHECK` on `/healthz`.

### `client/nginx.conf`
- `listen 8080`; `server_tokens off`.
- `location /api/` → `proxy_pass http://server:5000;` with `Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto` headers, `proxy_read_timeout 120s` (AI calls with retries).
- `location /assets/` → long cache (`expires 1y`; file names are content-hashed).
- `location /` → `try_files $uri /index.html` (SPA fallback), `no-cache` for `index.html` (`expires -1`).
- `location = /healthz` → 200.
- Security headers (`X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, SPA CSP) at server level + gzip. Caching uses `expires` instead of `add_header` so locations keep inheriting the security headers; `/api/` hides Helmet's copies of those four headers to avoid duplicate/conflicting values (Helmet's other headers, e.g. HSTS, pass through).

## 2. Docker Compose — `docker-compose.yml`
```yaml
services:
  server:  build ./server, env_file ./server/.env, environment overrides (NODE_ENV=production, PORT=5000, TRUST_PROXY=1,
           COOKIE_SECURE=false for http://localhost, COOKIE_SAMESITE=lax, CLIENT_ORIGIN/OPENROUTER_APP_URL=http://localhost:8080),
           healthcheck (from Dockerfile), init: true (tini forwards SIGTERM, reaps zombies), stop_grace_period 15s
           (> 10 s forced-shutdown timer in server.js), restart unless-stopped; port 5000 is only exposed on the internal network
  client:  build ./client, ports "8080:8080", depends_on server (condition: service_healthy), restart unless-stopped
networks: default bridge network (service DNS name "server")
```
MongoDB is **Atlas** (external) — no Mongo container. The server container needs outbound internet (Atlas + OpenRouter); Atlas Network Access must allow the host IP.

Commands:
```bash
cp server/.env.example server/.env   # fill MONGODB_URI, JWT_SECRET, OPENROUTER_API_KEY
docker compose up --build             # http://localhost:8080
docker compose ps                     # both services "healthy"
docker compose logs -f server
docker compose down
```
`COOKIE_SECURE=false` is set in Compose only because local Docker serves plain HTTP; behind HTTPS it must be `true`.

## 3. Cloud deployment
### Backend → Render (`render.yaml` blueprint)
- Web service, `rootDir: server`, runtime `node`, build `npm ci --omit=dev`, start `node src/server.js`, health check path `/api/health`.
- Env: `NODE_ENV=production`, `TRUST_PROXY=1`, `COOKIE_SECURE=true`, `COOKIE_SAMESITE=lax`, `CLIENT_ORIGIN=https://<vercel-app>.vercel.app`, `JWT_SECRET` (generateValue), and `sync:false` secrets `MONGODB_URI`, `OPENROUTER_API_KEY`.
- Atlas Network Access: allow Render egress (or `0.0.0.0/0` with strong credentials).

### Frontend → Vercel (`client/vercel.json`)
- Root directory `client`, framework Vite, build `npm run build`, output `dist`.
- Rewrites: `/api/(.*)` → `https://<render-service>.onrender.com/api/$1`; everything else → `/index.html`.
- `VITE_API_BASE_URL` unset (defaults to `/api`) → same-origin requests through Vercel → first-party cookies (D-003).
- Replace `<render-service>` placeholder in `vercel.json` before deploying.

### Alternative (no proxy)
If the frontend calls Render directly (`VITE_API_BASE_URL=https://…onrender.com/api`), set `COOKIE_SAMESITE=none`, `COOKIE_SECURE=true` and `CLIENT_ORIGIN` to the Vercel URL. Browsers blocking third-party cookies may break this mode → the proxy approach is the documented default.

## 4. Deployment verification checklist
- [ ] `GET https://<render>/api/health` → 200, `database: connected`
- [ ] Vercel site loads, signup/login works, cookie set on Vercel domain
- [ ] Send message → real AI reply
- [ ] Refresh restores session and conversation
Deployment is reported as **BLOCKED / NOT VERIFIED** unless these checks are actually performed.
