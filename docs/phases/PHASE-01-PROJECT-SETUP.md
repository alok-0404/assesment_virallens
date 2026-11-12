# PHASE 01 — Project Setup

1. **Objective** — Scaffold `client/` and `server/` with dependencies, scripts, env examples and a working health endpoint.
2. **Requirements** — OPS-04, BE-10, NFR-08, NFR-10.
3. **Prerequisites** — Phase 00 COMPLETE. Node ≥ 20 (raised to `>=22.12.0` for both packages in Phase 12 after checking dependency engine ranges: mongoose 9 `>=20.19`, Vite 8 `^20.19 || >=22.12`, Vitest 5 `^22.12 || ^24`; Node 24 recommended).
4. **Tasks**
   - `git init`; root `.gitignore` (node_modules, dist, .env*, !.env.example, coverage, logs).
   - Server: `package.json` (`type: module`, scripts `dev`, `start`, `test`, `smoke:ai`, `engines.node >=20`), deps: express@5, mongoose, zod, jsonwebtoken, bcrypt, helmet, cors, cookie-parser, express-rate-limit, dotenv; dev: vitest, supertest, mongodb-memory-server.
   - Server folders per 02-ARCHITECTURE; minimal `app.js` with `GET /api/health`; `server.js`.
   - `server/.env.example` with every var from 06-BACKEND §4.
   - Client: Vite React (JS) scaffold, Tailwind v4 (`@tailwindcss/vite`), react-router-dom, axios, react-markdown, remark-gfm; dev: vitest, jsdom, Testing Library. Scripts `dev`, `build`, `preview`, `test`.
   - `vite.config.js` with `/api` proxy (`VITE_PROXY_TARGET`) and Vitest config.
   - `client/.env.example`.
5. **Expected files** — `.gitignore`, `server/package.json`, `server/src/{app,server}.js`, `server/.env.example`, `server/vitest.config.js`, `client/package.json`, `client/vite.config.js`, `client/index.html`, `client/src/{main.jsx,App.jsx,index.css}`, `client/.env.example`.
6. **Dependencies** — npm registry access.
7. **API/UI** — `GET /api/health` → `{ success:true, data:{ status:"ok" } }`.
8. **Edge cases** — Windows paths; `bcrypt` native build (prebuilt binaries for Node 24).
9. **Security checks** — `.env` ignored by git; no secrets in examples.
10. **Test cases** — backend dev server starts; `curl /api/health` 200; frontend dev server starts; `npm run build` succeeds.
11. **Build verification** — `cd client && npm run build`.
12. **Acceptance criteria** — all tests in §10 pass.
13. **Completion checklist** — [ ] server runs [ ] health 200 [ ] client dev runs [ ] client build ok [ ] env examples [ ] gitignore
14. **Next phase dependency** — Phase 02 replaces the minimal app with the full foundation.
