# PHASE 03 — Authentication

1. **Objective** — Secure signup/login/logout/me with bcrypt, JWT in HttpOnly cookie, CSRF and rate limiting.
2. **Requirements** — AUTH-01..12, BE-01..04, DB-01.
3. **Prerequisites** — Phase 02 COMPLETE.
4. **Tasks**
   - `models/User.js` (03-DATABASE §1).
   - `validators/auth.schemas.js` (signup, login; strict).
   - `middleware/validate.js`.
   - `utils/jwt.js`, `utils/cookies.js`.
   - `middleware/csrf.js` (`issueCsrfToken`, `requireCsrf`), mounted for unsafe methods on `/api`.
   - `middleware/auth.js` (`requireAuth`).
   - `middleware/rateLimiters.js` (`authLimiter`, `globalLimiter`, `chatLimiter`).
   - `services/auth.service.js` (`registerUser`, `authenticateUser` with dummy-hash compare).
   - `controllers/auth.controller.js`, `routes/auth.routes.js`.
5. **Expected files** — above + `tests/auth.test.js`, `tests/helpers/agent.js` (CSRF-aware Supertest agent).
6. **Dependencies** — bcrypt, jsonwebtoken, cookie-parser, express-rate-limit, zod.
7. **API** — 04-API §Auth.
8. **Edge cases** — email case/whitespace normalisation; duplicate email race (unique index → 409); token for deleted user → 401; malformed cookie; `alg: none` token; logout without session.
9. **Security checks** — cookie flags; no `passwordHash` in responses; generic login error; CSRF required on signup/login/logout; limiter returns 429 JSON.
10. **Test cases** — valid signup; duplicate signup; invalid email; weak password; unknown fields rejected; valid login; invalid login (wrong pw + unknown email); password hashed (`$2b$`); protected route without token 401; invalid token 401; expired token 401; tampered token 401; logout clears cookie and `/me` → 401 afterwards; current user 200; CSRF missing/mismatch 403; auth rate limit 429.
11. **Build verification** — `npm test` server all green.
12. **Acceptance criteria** — all §10 pass; no regression.
13. **Completion checklist** — [ ] model [ ] validators [ ] jwt/cookies [ ] csrf [ ] requireAuth [ ] limiters [ ] routes [ ] tests
14. **Next phase dependency** — Phase 04 uses `requireAuth` and `req.user.id` for ownership.
