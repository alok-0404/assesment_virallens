# Final Assessment Report — Minimal AI Customer Support Agent

**Date:** 2026-11-11 · **Scope:** every requirement in `01-ASSESSMENT-REQUIREMENTS.md` (§2, §3) and the 18 success criteria of Part 10 of the brief.

## 1. Verdict

**The application is fully implemented, deployed and verified live. The assessment is NOT declared complete**, because one mandatory item cannot be verified without Docker:

| Blocked item | Needs |
|---|---|
| Docker image build and `docker compose up` (OPS-01/02/03/07, success criterion 15) | Docker installed on the host |

**Deployed (2026-11-13):** frontend [assesment-virallens.vercel.app](https://assesment-virallens.vercel.app), API `https://ai-support-api-4v06.onrender.com` — see §9.

**Update 2026-11-13:** with the owner's MongoDB Atlas cluster and OpenRouter key in `server/.env`, real AI replies (CHAT-03, criterion 6) and Atlas connectivity (criterion 2) were verified locally — see §8.

No requirement is **FAIL** or **NOT IMPLEMENTED**. Nothing has been deployed, and no deployment is claimed.

Status legend: **PASS** = implemented and verified (evidence type stated) · **BLOCKED** = implemented, verification impossible without the listed access · **FAIL** · **NOT IMPLEMENTED**.
Evidence types: *auto* = automated test · *browser* = live browser run against the local stack (Phase 09 / 13) · *runtime* = manual run of the real process · *static* = file/code inspection or syntax validation.

## 2. Test, build and audit results (final run, Phase 13)

| Check | Command | Result |
|---|---|---|
| Server tests | `cd server && npx vitest run` | **159 passed / 159** (8 files: env, app, auth, chat.models, openrouter.service, chat.send, chat.history, security) |
| Client tests | `cd client && npx vitest run` | **59 passed / 59** (7 files: validation, http, authApi, AuthPages, ChatInput, MessageBubble, ChatPage) |
| Client production build | `cd client && npm run build` | **PASS** — 516.72 kB JS (162.87 kB gzip), 24.93 kB CSS; Vite's >500 kB advisory warning only |
| Dependency audit | `npm audit` (dev + prod) in both packages | **0 vulnerabilities** in each |
| Clean-clone run (Phase 12) | Only the 138 committable files copied to a temp dir → `npm ci`, tests, build | **PASS** — same 159 / 59 results, build OK |
| Secrets in client bundle | grep `client/dist` for `sk-or-`, `OPENROUTER`, `JWT_SECRET`, `MONGODB_URI`, `mongodb://`, `mongodb+srv` | **0 matches** |
| Secrets in committable files | `git ls-files --others --cached --exclude-standard` scanned for OpenRouter keys / credentialed Atlas URIs | **0 matches**; no `.env` file committable; `server/.env`, `client/.env` ignored (`.gitignore:10`) |
| Config syntax | `client/vercel.json`, `package.json` ×2 (JSON); `render.yaml`, `docker-compose.yml` (YAML via `js-yaml`) | **All valid** |
| Graceful shutdown | Real `node src/server.js` (local MongoDB), health request, then `SIGTERM` emitted in-process | **PASS** — "Shutting down (SIGTERM)…" → "MongoDB disconnected" → "Shutdown complete", exit code 0, 20 ms after the signal |
| Docker | `docker compose config / up --build` | **NOT RUN — BLOCKED** (`docker` not installed) |

Testing note: database tests run against a real `mongod` binary (mongodb-memory-server), not mocks. The AI provider is mocked **only** in automated tests; the application always uses the real OpenRouter client.

## 3. Functional requirements

### Authentication
| ID | Status | Evidence |
|---|---|---|
| AUTH-01 Signup | PASS | auto: `auth.test.js` signup 201 + user, duplicate email 409; browser: Alice/Bob signup → `/chat` |
| AUTH-02 Login | PASS | auto: login 200 + cookie, generic 401 for wrong password/unknown email; browser: wrong password → "Invalid email or password.", correct → history intact |
| AUTH-03 Logout | PASS | auto: cookie cleared, `/me` 401 afterwards, idempotent, failure keeps user signed in (ISS-002 regression tests); browser: after logout `/api/auth/me` → 401 |
| AUTH-04 JWT | PASS | auto: HS256 with `sub` = user id; tampered, expired, wrong-secret, `alg: none`, non-ObjectId `sub` → 401 (`auth.test.js`, `security.test.js`) |
| AUTH-05 bcrypt | PASS | auto: stored `passwordHash` starts `$2`, plaintext never stored or returned; runtime: prod-only install hashes/compares |
| AUTH-06 Protected routes | PASS | auto: 401 on all 6 protected endpoints; client guards tested; browser: anonymous `/chat` → `/login` |
| AUTH-07 Session restore | PASS | auto: restore on refresh (`AuthPages.test.jsx`); browser: reload on `/chat/:id`, and 1280 px session restored from cookie in Phase 13 |
| AUTH-08 Secure cookie | PASS | auto: `HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`, `Secure` in production; browser: `document.cookie` empty |
| AUTH-09 Identity from JWT only | PASS | auto: `userId`/`user` injection in body rejected (400), mass assignment rejected; static: all services take `req.user.id` |
| AUTH-10 Validation | PASS | auto: invalid email, 3 weak passwords, unknown fields → 400 `VALIDATION_ERROR`; client field errors tested; browser: empty form + mismatched confirmation messages |
| AUTH-11 Auth rate limit | PASS | auto: 429 `RATE_LIMITED` |
| AUTH-12 CSRF | PASS | auto: missing / mismatched / foreign-session token → 403 `CSRF_INVALID`; client refresh-and-retry tested |

### Chat system
| ID | Status | Evidence |
|---|---|---|
| CHAT-01 Text input | PASS | auto: Enter sends, Shift+Enter newline, 4000-char limit, blocked while sending (`ChatInput.test.jsx`) |
| CHAT-02 User messages | PASS | auto: `role: "user"` persisted; browser: optimistic bubble then persisted message after reload |
| CHAT-03 Real AI responses | PASS | runtime: `npm run smoke:ai` → real reply from `nvidia/nemotron-3-ultra-550b-a55b:free` in 8.3 s; browser (§8): real replies rendered as Markdown, follow-up answered from context. Also auto (mocked `fetch`) and the provider-error path (401 → safe 502) |
| CHAT-04 Persistence | PASS | auto: real `mongod`; browser: conversation, messages and history restored after reload. Atlas itself: see success criterion 2 |
| CHAT-05 User scoping | PASS | auto: A/B isolation for read, list, send, delete (`chat.history.test.js`, `chat.send.test.js`); browser: Bob sees "Conversation not found" for Alice's URL |
| CHAT-06 Previous conversations | PASS | auto: ordered by last activity with page/limit meta; browser: sidebar order updates |
| CHAT-07 Continue conversation | PASS | auto: context ordered and limited by `AI_CONTEXT_MESSAGES`; browser: stub reported 3 then 5 context messages |
| CHAT-08 New conversation | PASS | auto: title generated from first message; browser: "New chat" starts fresh context |
| CHAT-09 Deletion | PASS | auto: owner-only cascade delete, foreign → 404, data intact; UI confirm/cancel/error tested; browser: delete → 404 afterwards |
| CHAT-10 Typing indicator | PASS | auto: `ChatPage.test.jsx`; browser: indicator visible while waiting |

### AI
| ID | Status | Evidence |
|---|---|---|
| AI-01 OpenRouter integration | PASS | auto: request shape, headers, `/chat/completions`; runtime + browser: real replies (CHAT-03) |
| AI-02 Configurable model | PASS | static/auto: `OPENROUTER_MODEL` (default `openai/gpt-4o-mini`) validated in `config/env.js`, sent in request |
| AI-03 System prompt | PASS | auto: default support prompt and `AI_SYSTEM_PROMPT` override |
| AI-04 Context | PASS | auto: chronological, trimmed to last N, assistant-first handling |
| AI-05 Error handling | PASS | auto: 401/402/429/5xx/empty/error-in-200 → `AI_*` codes; key and provider text absent from responses (`security.test.js`) |
| AI-06 Retry | PASS | auto: retries 5xx/429/network with backoff (honours `Retry-After`); no retry on auth errors |
| AI-07 Timeout | PASS | auto: real 1 s abort → 504 `AI_TIMEOUT` |
| AI-08 Key protection | PASS | static: key only in server env; 0 matches in client bundle; absent from logs and responses (auto + browser error path) |
| AI-09 Duplicate prevention | PASS | auto: concurrent send → 409, `clientMessageId` replay calls AI once, retry after rollback; UI disables send while pending |

### Backend endpoints
| ID | Status | Evidence |
|---|---|---|
| BE-01 … BE-04 Auth endpoints | PASS | auto: `auth.test.js` + `security.test.js` |
| BE-05 `POST /api/chat/send` | PASS | auto: `chat.send.test.js` (validation, ownership, rollback, idempotency, rate limit) |
| BE-06 `GET /api/chat/history` | PASS | auto: `chat.history.test.js` |
| BE-07 `GET /api/chat/conversations/:id` | PASS | auto: owned 200, foreign 404 without title leak, invalid id 400 |
| BE-08 `GET …/:id/messages` (cursor) | PASS | auto: chronological pages, foreign cursor → `INVALID_CURSOR`, limit bounds |
| BE-09 `DELETE …/:id` | PASS | auto: cascade, second delete 404, CSRF required |
| BE-10 Health | PASS | auto: 200 / 503 depending on DB; runtime: `database: connected` |
| BE-11 Envelope + central errors | PASS | auto: `{success, data, meta?}` / `{success:false, error:{code,message}}`; production 500 hides internals |

### Database
| ID | Status | Evidence |
|---|---|---|
| DB-01 Users | PASS | `models/User.js`; auto: unique email (case-insensitive) |
| DB-02 Conversations | PASS | `models/Conversation.js`; auto |
| DB-03 Messages | PASS | `models/Message.js`; auto |
| DB-04 Ownership in queries | PASS | auto: cross-user read/write/delete blocked at query level; static: every query filters on `user` |
| DB-05 Indexes | PASS | auto: all indexes from `03-DATABASE-DESIGN` present, including the unique partial `user + clientMessageId` index |

### Frontend
| ID | Status | Evidence |
|---|---|---|
| FE-01 Login page | PASS | auto + browser |
| FE-02 Signup page | PASS | auto + browser |
| FE-03 Chat dashboard | PASS | auto: `/chat`, `/chat/:id`, not-found state; browser |
| FE-04 Sidebar | PASS | auto + browser: list, new chat, delete, user info, logout |
| FE-05 History displayed | PASS | auto + browser: selecting loads messages; stale/late responses ignored (tests only — see §6) |
| FE-06 Message input | PASS | auto: `ChatInput.test.jsx` |
| FE-07 Markdown / code / copy | PASS | auto: lists, links, code blocks, copy, raw HTML not rendered, `javascript:`/`data:` links neutralised; browser |
| FE-08 Loading & error states | PASS | auto: session spinner, "Sending…"/"Deleting…" states, error banners with retry, failed message + Retry; static: history loading skeleton (not asserted by a test); browser: provider error bubble + Retry |
| FE-09 Responsive | PASS | browser: 758 px → drawer (open/close/close-on-select); 1280 px → fixed 288 px sidebar with both drawer buttons hidden (Phase 13); auto: drawer + Escape |
| FE-10 Logout | PASS | auto + browser (after ISS-002 fix) |

### DevOps
| ID | Status | Evidence |
|---|---|---|
| OPS-01 Frontend Dockerfile | **BLOCKED** (file complete) | static: multi-stage node:24-alpine → `nginx-unprivileged` (non-root, 8080, HEALTHCHECK); build stage simulated outside Docker → identical assets. Image build not run |
| OPS-02 Backend Dockerfile | **BLOCKED** (file complete) | static: multi-stage, `npm ci --omit=dev`, `USER node`, HEALTHCHECK, `STOPSIGNAL`; prod-only dependency set started and served health 200. Image build not run |
| OPS-03 Docker Compose | **BLOCKED** (file complete) | static: valid YAML, internal-only API port, `depends_on: service_healthy`. `docker compose up --build` not run |
| OPS-04 `.env.example` | PASS | `server/.env.example`, `client/.env.example`; no real values |
| OPS-05 README | PASS | static: every section required by Phase 12; followed end to end in the clean-clone run |
| OPS-06 Deployment configuration | PASS (config) | static: `render.yaml` and `client/vercel.json` valid; actual deployment BLOCKED (§5) |
| OPS-07 Nginx | **BLOCKED** (file complete) | static: `/api/` proxy with 120 s timeouts, SPA fallback, CSP + security headers, `/healthz`. `nginx -t` not run (no Docker/Nginx) |

## 4. Non-functional requirements

| ID | Status | Evidence |
|---|---|---|
| NFR-01 Security headers | PASS (API) | auto: Helmet headers, `X-Powered-By` absent, `Cache-Control: no-store` on `/api` (D-014). Nginx/Vercel headers: static only |
| NFR-02 CORS | PASS | auto: disallowed origin → 403, no `Access-Control-Allow-Origin` |
| NFR-03 Body limit | PASS | auto: >100 kB → 413 |
| NFR-04 Safe request logs | PASS | static: method, path without query, status, duration only; auto: parser-rejected requests are logged too |
| NFR-05 Env validation | PASS | auto: 9 cases; runtime: exit 1 listing invalid keys without values |
| NFR-06 Graceful shutdown | PASS (handler) | runtime: SIGTERM handler closes HTTP, disconnects MongoDB, exit 0 (§2). A real OS SIGTERM from `docker stop` is not verified (Docker BLOCKED) |
| NFR-07 Automated tests | PASS | 159 + 59 passing |
| NFR-08 Production build | PASS | `npm run build` OK |
| NFR-09 Accessibility basics | PASS | auto: tests query by label/role/accessible name throughout; static: labelled inputs, `aria-current`, `aria-label` on icon buttons, `focus-visible` styles, mobile drawer closes on Escape. No automated a11y scanner was run |
| NFR-10 No secrets committed | PASS | §2 secret scans |
| NFR-11 Input validation | PASS | static: Zod schemas on every body/params/query; auto: strict bodies, repeated params, operator payloads → 400 |

## 5. Success criteria (Part 10)

| # | Criterion | Status | Notes |
|---|---|---|---|
| 1 | Runs locally | PASS | API + Vite + local MongoDB, full browser journeys (Phase 09) |
| 2 | Connects to MongoDB Atlas | PASS | Owner's Atlas cluster: ping ok, database `ai_support`; API logged "Connected to MongoDB"; signup, chats and reload served from Atlas (§8) |
| 3 | Registers users | PASS | |
| 4 | Authenticates securely | PASS | |
| 5 | Protects private routes | PASS | |
| 6 | Real AI responses via OpenRouter | PASS | CHAT-03 (§8) |
| 7 | Saves messages | PASS | |
| 8 | Maintains context | PASS | auto + browser (stub reported growing context) |
| 9 | Shows previous conversations | PASS | |
| 10 | User data isolation | PASS | |
| 11 | Handles failures | PASS | Provider error, rollback, retry, timeouts, network errors, logout failure |
| 12 | Functional responsive UI | PASS | Mobile and desktop verified in browser |
| 13 | Automated tests pass | PASS | 159 / 59 |
| 14 | Production frontend build | PASS | |
| 15 | Runs with Docker Compose | **BLOCKED** | Docker Desktop could not be installed on the development machine (WSL 2 installation problems). Files complete; step-by-step run guide in README "Docker" |
| 16 | Complete documentation | PASS | README + `docs/00–14` + phase docs + this report |
| 17 | Ready for GitHub submission | PASS | `.gitignore` verified, no secrets, README "GitHub submission" steps. Pushed by the owner 2026-11-13 to [alok-0404/assesment_virallens](https://github.com/alok-0404/assesment_virallens) (`main` @ `4ed2c10`, 139 files, no `.env`/`node_modules`/`dist`, 0 secret matches) |
| 18 | Deployment-ready configuration | PASS (config) | `render.yaml`, `client/vercel.json` valid; placeholders `REPLACE-WITH-RENDER-SERVICE` / `REPLACE-WITH-VERCEL-APP` must be filled at deploy time |

**Deployment status: DEPLOYED and VERIFIED** (2026-11-13) — see §9.

## 6. Known issues and limitations

- **Resolved issues** (details in `14-ISSUES-AND-RESOLUTIONS.md`): ISS-001 PowerShell pipeline tooling hang; ISS-002 logout did not end the session (real bug, fixed with client + server regression tests); ISS-003 stale local process (tooling); ISS-004 client timeout 30 s → 60 s per spec.
- Switching conversations *while a reply is pending* is covered by automated tests (`ChatPage.test.jsx`), not by a live browser run.
- Client bundle is 516 kB (163 kB gzip), above Vite's 500 kB advisory threshold. Not an error; code-splitting is possible future work.
- In-flight duplicate lock and rate-limit counters are in memory → correct for a single instance only (horizontal scaling out of scope, `01` §4).
- `TRUST_PROXY=1` on Render must be re-checked after deployment; the Vercel hop may require `2` (D-015).
- Render free tier cold starts can take tens of seconds; the client allows 60 s (120 s for sends).
- No streaming responses (D-012); email verification, password reset and OAuth are out of scope.

## 7. Next actions for every non-PASS item

| Item | Action | Verification |
|---|---|---|
| Docker (OPS-01/02/03/07, criterion 15, NFR-06 real signal) | Install Docker Desktop | `docker compose config` → `docker compose up --build` → `docker compose ps` (both healthy) → journey at `http://localhost:8080` → `docker compose down` (clean SIGTERM stop) |

## 8. Live verification with real credentials (2026-11-13)

Owner-provided MongoDB Atlas M0 cluster and OpenRouter key in the gitignored `server/.env` (values never printed or committed). Model: `nvidia/nemotron-3-ultra-550b-a55b:free`.

- Atlas: Mongoose connect + `ping` → ok, database `ai_support`; `node src/server.js` → "Connected to MongoDB", "API listening on port 5000".
- `npm run smoke:ai` → real customer-support reply in 8.3 s (559 tokens).
- Browser (Vite :5173 → API :5000 → Atlas + OpenRouter): signup "Atlas Tester" → `POST /api/auth/signup 201`; suggested prompt "How do I return an item and get a refund?" → real Markdown reply (`POST /api/chat/send 201`, 12.9 s), URL `/chat/:id`, history entry added; follow-up "What was my previous question about?" → "You asked how to return an item and receive a refund." (`201`, 4.2 s) — context confirmed; page reload → session, both exchanges and history restored from Atlas; `document.cookie` empty (HttpOnly).
- Note: free models have provider-side daily request limits; the reasoning model chosen adds latency (4–13 s observed), within the 30 s AI timeout.

## 9. Deployment verification (2026-11-13)

Render Blueprint (`render.yaml`) → web service `ai-support-api` (free, Node 24.22.3), `https://ai-support-api-4v06.onrender.com`; Vercel project from `client/` → `https://assesment-virallens.vercel.app` with `/api/*` rewritten to Render (`client/vercel.json`).

- `GET /api/health` (direct and through Vercel) → 200 `database: connected`; `Cache-Control: no-store`, HSTS, no `X-Powered-By`.
- Vercel: `/` and `/chat` (SPA fallback) → 200; page headers `X-Frame-Options: DENY`, `nosniff`, CSP.
- CORS: before `CLIENT_ORIGIN` was set, `Origin: https://assesment-virallens.vercel.app` → 403 `CORS_FORBIDDEN` (as designed); a Blueprint push did not re-sync env vars, so the owner updated `CLIENT_ORIGIN` / `OPENROUTER_APP_URL` in the Render dashboard → 200.
- Production cookie through the Vercel rewrite: `Path=/; HttpOnly; Secure; SameSite=Lax`.
- `TRUST_PROXY=1` (D-015): rate-limit counters for requests sent through Vercel continued the same per-client counter as direct requests to Render (never reset to a fresh Vercel-edge key) → the limiter keys on the real client IP; no change needed.
- Browser journey on the live URL: signup "Demo Reviewer" → `/chat`; `document.cookie` empty; suggested prompt "I was charged twice for the same order." → real AI reply (~4 s), URL `/chat/:id`; reload → session, conversation and history restored; Log out → `/login`, `GET /api/auth/me` → 401.
