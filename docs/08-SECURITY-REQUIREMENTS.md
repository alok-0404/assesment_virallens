# 08 — Security Requirements

## 1. Authentication
| Control | Requirement |
|---|---|
| Password hashing | bcrypt, cost `BCRYPT_SALT_ROUNDS` (default 12). Plaintext never stored, logged or returned. `passwordHash` has `select: false`. |
| Password policy | 8–128 chars, ≥1 letter, ≥1 digit (server Zod + client). |
| Login | Generic `INVALID_CREDENTIALS` for unknown email or wrong password. A dummy bcrypt compare runs when the email is unknown to reduce user-enumeration timing differences. |
| Signup enumeration | Duplicate email returns 409 `EMAIL_IN_USE` (accepted UX trade-off; rate-limited). |
| JWT | HS256, `JWT_SECRET` ≥ 32 chars, payload `{ sub: userId }`, `expiresIn` `JWT_EXPIRES_IN`. Verification pins `algorithms: ["HS256"]`. Expired/invalid/tampered → 401. |
| Identity | `req.user` is set only by `requireAuth` after verifying the JWT **and** loading the user from DB. No endpoint reads a user id from body/query/params. |

## 2. Cookies
`access_token`: `HttpOnly`, `SameSite=${COOKIE_SAMESITE}` (default `Lax`), `Secure=${COOKIE_SECURE}` (default true in production), `Path=/`, `Max-Age` = JWT lifetime. Logout clears with identical attributes.
`csrf_token`: `HttpOnly`, same `SameSite`/`Secure`, `Path=/`, session cookie.
Env validation rejects `COOKIE_SAMESITE=none` with `COOKIE_SECURE=false`.

## 3. CSRF (AUTH-12)
Strategy: **server-issued double-submit token** plus SameSite cookies.
1. `GET /api/auth/csrf-token` generates 32 random bytes (hex), stores them in the `csrf_token` HttpOnly cookie and returns the same value in the body.
2. The SPA keeps the token in memory and sends it as `X-CSRF-Token` on every `POST/PUT/PATCH/DELETE`.
3. `requireCsrf` (mounted for all unsafe methods under `/api`) compares header and cookie with `crypto.timingSafeEqual`; missing/mismatch → 403 `CSRF_INVALID`.
A cross-site attacker cannot read the body of the token response (CORS allow-list) and cannot set custom headers on simple cross-site form posts, so forged requests fail. Login/signup are protected too (login-CSRF).

## 4. CORS (NFR-02)
Allow-list from `CLIENT_ORIGIN` (comma-separated). Requests with no `Origin` (same-origin proxied, curl, health checks) are allowed. Disallowed origins → 403 `CORS_FORBIDDEN`. `credentials: true`; allowed headers `Content-Type`, `X-CSRF-Token`.

## 5. Rate limiting (AUTH-11)
| Limiter | Scope | Default |
|---|---|---|
| global | all `/api`, per IP | 300 / 15 min |
| auth | signup + login, per IP | 20 / 15 min |
| chat | `POST /api/chat/send`, per user id | 20 / min |
429 JSON `{ success:false, error:{ code:"RATE_LIMITED" } }` with `RateLimit-*` standard headers. `TRUST_PROXY` must be set correctly behind Nginx/Render so the client IP is used.

## 6. Input validation (NFR-11)
Zod `.strict()` schemas for every body; ObjectId params validated with a regex; query params coerced and bounded. Mongoose `strictQuery: true`. Because all values are validated as primitives, NoSQL operator injection (`{ "$gt": "" }`) is rejected with 400. Express 5 uses the "simple" query parser, so `?page[$gt]=0` is a literal unknown key (ignored, defaults apply) and never becomes a nested operator; repeated parameters (`?page=1&page=2`) become arrays and fail validation with 400.

## 7. HTTP hardening
Helmet defaults on the API (`X-Content-Type-Options`, `Strict-Transport-Security`, `X-Frame-Options`, CSP for API responses, etc.); `Cache-Control: no-store` on every `/api` response (D-014); `x-powered-by` disabled; JSON body limit 100 kb (413); unknown routes 404 JSON; production errors never include stack traces. Nginx adds `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, a CSP for the SPA, and hides its version.

## 8. Secrets (AI-08, NFR-10)
- `.env` files are gitignored; only `.env.example` with placeholders is committed.
- `OPENROUTER_API_KEY`, `JWT_SECRET`, `MONGODB_URI` exist only in server env (Render dashboard / Compose `env_file`). No `VITE_*` variable may contain a secret (Vite inlines `VITE_*` into the bundle).
- Env validation errors list key names, never values.
- Request logger never logs headers, cookies or bodies.
- Verification: grep the built `client/dist` for `sk-or-` / `OPENROUTER` → no matches.

## 9. Frontend
- JWT never accessible to JS (HttpOnly). No tokens in `localStorage`.
- Markdown rendered without raw HTML (`react-markdown` default, no `rehype-raw`) → no XSS from AI output. External links `rel="noopener noreferrer"`.

## 10. Data isolation (CHAT-05, DB-04)
All conversation/message queries include `user: req.user.id`. Not-owned resources → 404. Tests cover read, messages, send-into, and delete across two users.

## 11. Containers
Non-root users (`node` in API image, `nginx-unprivileged` for client), production dependencies only, no secrets baked into images (`.dockerignore` excludes `.env`).

## 12. Security test checklist (Phase 10)
- [x] Unauthenticated access to every protected endpoint → 401 — `security.test.js` (6 endpoints)
- [x] Tampered / expired / wrong-secret / alg-none / non-ObjectId-subject JWT → 401 — `auth.test.js`, `security.test.js`
- [x] Missing / wrong / other-session CSRF token → 403 — `auth.test.js`, `chat.history.test.js`, `security.test.js`
- [x] Disallowed CORS origin → 403 — `app.test.js`
- [x] Rate limit → 429 (global, auth, per-user chat) — `app.test.js`, `auth.test.js`, `chat.send.test.js`
- [x] NoSQL injection payloads → 400; mass assignment and `__proto__` rejected — `chat.send.test.js`, `security.test.js`
- [x] Oversized body → 413 — `app.test.js`
- [x] Cross-user read/send/delete → 404 — `chat.history.test.js`, `chat.send.test.js`, browser E2E (Phase 09)
- [x] Cookie flags verified (`HttpOnly`, `SameSite=Lax`, `Secure`, `Path=/`, `Max-Age`) in production config — `security.test.js`
- [x] `passwordHash` / plaintext password never in responses — `security.test.js`
- [x] Provider key absent from client bundle (grep `client/dist` → 0 matches) and API responses — `chat.send.test.js`, `security.test.js`
- [x] Model output cannot inject HTML/script or `javascript:`/`data:` links — `MessageBubble.test.jsx`
