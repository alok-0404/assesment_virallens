# 13 — Decision Log

Format: ID · date · decision · context/why · consequences. Decisions here are locked; reversing one requires a new entry referencing it.

## D-001 · 2026-11-11 · Monorepo with `client/` and `server/`
Two deployable units in one repo; simplest structure for an assessment, maps 1:1 to Vercel + Render + two Dockerfiles. No microservices.

## D-002 · 2026-11-11 · ESM + Express 5 + Vitest for both packages
Express 5 forwards rejected promises from async handlers to the error middleware (no `asyncHandler` wrapper). Vitest works natively with ESM (Jest ESM support is still experimental) and is the same runner for client and server, satisfying "Jest/Vitest + Supertest".

## D-003 · 2026-11-11 · Same-origin `/api` via proxies
Vite proxy (dev), Nginx (Docker), Vercel rewrites (prod) forward `/api` to the backend. Makes the auth cookie first-party so `SameSite=Lax` works and third-party-cookie blocking does not break login. CORS stays configured for direct calls.

## D-004 · 2026-11-11 · JWT in HttpOnly cookie + server-issued double-submit CSRF token
Brief requires secure cookie-based tokens and CSRF protection appropriate to the cookie strategy. `GET /api/auth/csrf-token` sets an HttpOnly `csrf_token` cookie and returns the token; SPA sends it as `X-CSRF-Token` on unsafe methods. Chosen over `csurf` (deprecated) and over relying on SameSite alone (defence in depth).

## D-005 · 2026-11-11 · OpenRouter via native `fetch`, no SDK
Node ≥ 20 has `fetch`/`AbortController`. Avoids a dependency, gives full control of timeout/retry and makes the client trivially injectable for tests. Default model `openai/gpt-4o-mini`, configurable by `OPENROUTER_MODEL`.

## D-006 · 2026-11-11 · Roll back user message on AI failure
If the provider fails after retries, the user message (and a conversation created in the same request) are deleted and an `AI_*` error is returned. Keeps the DB free of unanswered turns that would corrupt future context; the UI keeps the text as a *failed* message with Retry (same `clientMessageId`).

## D-007 · 2026-11-11 · Duplicate-submission prevention = in-memory lock + idempotency key
Per-process lock keyed by `user:conversation` and a unique partial index on `messages{user, clientMessageId}`. The lock is single-instance only (adequate for one Render instance); the unique index protects across instances. Documented limitation.

## D-008 · 2026-11-11 · Zod for validation
Single schema library for body/params/query with `.strict()` objects; also used for env validation.

## D-009 · 2026-11-11 · Tests use `mongodb-memory-server`
Real MongoDB engine in tests (no mocked DB layer) without needing Atlas credentials. Production/dev always use `MONGODB_URI` (Atlas).

## D-010 · 2026-11-11 · Not-owned resources return 404
Prevents resource enumeration across users.

## D-011 · 2026-11-11 · Tailwind CSS v4 with `@tailwindcss/vite`
Current major version; zero-config content detection; no `tailwind.config.js` / PostCSS config required.

## D-012 · 2026-11-11 · No streaming (SSE) responses
Typing indicator is shown while waiting for the full response. Streaming is out of scope (not required) and would complicate retry/rollback semantics.

## D-013 · 2026-11-11 · Local browser E2E without an OpenRouter key uses an out-of-repo stub
No API key is available, so the success path of the chat UI (reply rendering, URL update, history upsert, multi-turn context) was exercised by pointing `OPENROUTER_BASE_URL` (process env only) at a throwaway OpenAI-compatible stub in `%TEMP%`. The application code is unchanged and still talks to the real provider by default; the stub is not part of the repository and its replies are labelled "Local stub provider". This is test-harness evidence only — live AI replies remain BLOCKED until a real key is supplied. The provider-error path was verified against the real OpenRouter API.

## D-014 · 2026-11-11 · `Cache-Control: no-store` on all `/api` responses
The production path is browser → Vercel CDN (external rewrite) → Render. Vercel's CDN honours upstream caching headers on external rewrites, and `/api/auth/me`, history and messages are per-user data selected by cookie. Setting `no-store` on every `/api` response (before CORS/rate limiting, so error responses carry it too) guarantees no browser or shared cache can store or replay one user's data to another. Cost: browsers no longer revalidate with ETag (`304`), which is negligible for this API. Applies identically in Vite dev, Docker/Nginx and Vercel.

## D-015 · 2026-11-11 · `TRUST_PROXY=1` on Render, verified after deployment
Render documents one trusted hop for Express; community reports differ, and the Vercel rewrite adds another hop in front. A wrong value makes per-IP limits (global, auth) key on a proxy IP instead of the visitor. Kept configurable via `TRUST_PROXY`; `render.yaml` uses Render's documented value `1`, and the README lists checking the keyed IP as a post-deployment step. The chat limiter keys on the authenticated user id and is unaffected.
