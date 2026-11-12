# PHASE 02 — Backend Foundation

1. **Objective** — Production-grade Express foundation: env validation, DB connection, security middleware, error handling, logging, route registration.
2. **Requirements** — BE-10, BE-11, NFR-01..06.
3. **Prerequisites** — Phase 01 COMPLETE.
4. **Tasks**
   - `config/env.js` Zod schema (06-BACKEND §4), `loadEnv(source)`, `EnvValidationError` listing key names only; cross-field rule (`SameSite=none` ⇒ secure).
   - `config/db.js` connect/disconnect/isConnected.
   - `utils/AppError.js`, `utils/apiResponse.js`, `utils/logger.js`.
   - `middleware/requestLogger.js`, `notFound.js`, `errorHandler.js` (maps AppError, ZodError, CastError, ValidationError, 11000, JSON SyntaxError → 400 `INVALID_JSON`, `entity.too.large` → 413).
   - `app.js`: middleware order from 06-BACKEND §2, helmet, CORS allow-list, 100 kb JSON limit, cookie-parser, global rate limiter, routes index.
   - `controllers/health.controller.js` reports DB state (200/503).
   - `server.js`: graceful shutdown on SIGTERM/SIGINT.
   - Test helpers: `tests/helpers/env.js` (test env), `tests/helpers/db.js` (memory server start/stop/clear).
5. **Expected files** — listed above + `routes/index.js`, `routes/health.routes.js`, `tests/env.test.js`, `tests/app.test.js`.
6. **Dependencies** — Phase 01 packages.
7. **API** — `GET /api/health` (see 04).
8. **Edge cases** — DB down → health 503; malformed JSON; oversized body; unknown route; error thrown in async handler; disallowed origin.
9. **Security checks** — helmet headers present; `x-powered-by` absent; no stack traces in production responses; logger excludes query strings and bodies.
10. **Test cases** — env valid/missing/invalid/no value leakage; MongoDB connectivity (memory server) → health 200; disconnected → 503; 404 JSON; invalid JSON 400; 413; CORS allow/deny; prod error hides stack.
11. **Build verification** — `npm test` in server; `node src/server.js` starts with valid env (exits with clear message on invalid env).
12. **Acceptance criteria** — all §10 tests pass; invalid env exits non-zero with key list.
13. **Completion checklist** — [ ] env [ ] db [ ] errors [ ] security mw [ ] logger [ ] health [ ] tests green
14. **Next phase dependency** — Phase 03 mounts `/api/auth` routes and uses `AppError`, `validate`, limiters.
