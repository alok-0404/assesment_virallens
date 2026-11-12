# 06 — Backend Specification

Node.js (ESM, `"type": "module"`), Express 5, Mongoose, Zod, jsonwebtoken, bcrypt, helmet, cors, cookie-parser, express-rate-limit.

## 1. Entry points
- `src/server.js` — `loadEnv()` → `connectDatabase()` → `createApp(env).listen(PORT)` → handles `SIGTERM`/`SIGINT` (close server, `mongoose.disconnect()`, exit 0; force exit after 10 s) and `unhandledRejection` (log + shutdown).
- `src/app.js` — `createApp(env, deps?)` returns a configured Express app without connecting to DB or listening (Supertest-friendly). `deps.aiClient` allows tests to inject a mocked OpenRouter client.

## 2. Middleware order (app.js)
1. `app.disable("x-powered-by")`; `app.set("trust proxy", TRUST_PROXY)`
2. `requestLogger` (disabled when `NODE_ENV=test`) — first, so requests rejected by CORS or the body parser are still logged (ISS-002)
3. `Cache-Control: no-store` on `/api` (D-014)
4. `helmet()`
5. `cors({ origin: allow-list fn, credentials: true, methods, allowedHeaders: [Content-Type, X-CSRF-Token] })`
6. `express.json({ limit: "100kb" })` (strict: only objects/arrays; a literal `null` body → 400 `INVALID_JSON`)
7. `cookieParser()`
8. global rate limiter on `/api`
9. `requireCsrf` on `/api` (mutating methods only; D-004)
10. routes: `/api/health`, `/api/auth`, `/api/chat`
11. `notFound` → `errorHandler`

## 3. Modules
| Module | Responsibility |
|---|---|
| `config/env.js` | Zod schema; `loadEnv(source = process.env)` returns frozen config or throws `EnvValidationError` listing invalid keys only |
| `config/db.js` | `connectDatabase(uri)`, `disconnectDatabase()`, `isDatabaseConnected()`; `strictQuery`, `serverSelectionTimeoutMS: 10000` |
| `utils/AppError.js` | `class AppError extends Error { status, code, details }` + helpers |
| `utils/apiResponse.js` | `sendSuccess(res, data, status=200, meta)` |
| `utils/jwt.js` | `signAccessToken(userId, env)`, `verifyAccessToken(token, env)` (HS256, `algorithms` pinned) |
| `utils/cookies.js` | cookie option builders for auth & CSRF cookies; `clearAuthCookie` |
| `utils/logger.js` | minimal leveled logger (silent in test) |
| `utils/inFlight.js` | in-memory per-key lock (`acquire(key) → release | null`) |
| `middleware/auth.js` | `requireAuth`: read cookie → verify JWT → load user (`User.findById(sub)`) → `req.user = { id, name, email }`; else 401 |
| `middleware/csrf.js` | `issueCsrfToken` handler; `requireCsrf` for unsafe methods (timing-safe compare cookie vs header) |
| `middleware/validate.js` | `validate({ body, params, query })` with Zod; parsed values stored in `req.validated` |
| `middleware/rateLimiters.js` | `globalLimiter`, `authLimiter`, `chatLimiter` (keyed by user id) with JSON 429 handler |
| `middleware/requestLogger.js` | logs `METHOD path status ms` |
| `middleware/notFound.js`, `errorHandler.js` | 404 + central error mapping (Zod, Mongoose CastError/ValidationError, duplicate key 11000, JSON SyntaxError, 413, AppError, unknown → 500) |
| `services/auth.service.js` | `registerUser`, `authenticateUser` (dummy-hash compare to equalize timing) |
| `services/chat.service.js` | conversation/message CRUD with ownership filters; `sendMessage` orchestration |
| `services/openrouter.service.js` | `createOpenRouterClient(env, { fetch, sleep })` → `{ complete(messages) }` |
| `controllers/*` | translate HTTP ↔ services |

## 4. Environment variables
| Var | Required | Default | Notes |
|---|---|---|---|
| `NODE_ENV` | no | `development` | `development`/`test`/`production` |
| `PORT` | no | `5000` | |
| `MONGODB_URI` | **yes** | – | Atlas `mongodb+srv://…/ai_support` |
| `JWT_SECRET` | **yes** | – | ≥ 32 chars, random |
| `JWT_EXPIRES_IN` | no | `7d` | `ms`-style duration |
| `COOKIE_SECURE` | no | `true` in production else `false` | must be `true` when `COOKIE_SAMESITE=none` |
| `COOKIE_SAMESITE` | no | `lax` | `lax`/`strict`/`none` |
| `CLIENT_ORIGIN` | no | `http://localhost:5173` | comma-separated allow-list |
| `TRUST_PROXY` | no | `0` | hop count (`1` behind Nginx/Render) |
| `BCRYPT_SALT_ROUNDS` | no | `12` | 4–15 |
| `OPENROUTER_API_KEY` | **yes** | – | server-only secret |
| `OPENROUTER_MODEL` | no | `openai/gpt-4o-mini` | any OpenRouter model id |
| `OPENROUTER_BASE_URL` | no | `https://openrouter.ai/api/v1` | |
| `OPENROUTER_APP_URL` | no | `http://localhost:5173` | `HTTP-Referer` attribution header |
| `OPENROUTER_APP_NAME` | no | `AI Customer Support Agent` | `X-Title` header |
| `AI_SYSTEM_PROMPT` | no | built-in | overrides default prompt |
| `AI_TIMEOUT_MS` | no | `30000` | per attempt |
| `AI_MAX_RETRIES` | no | `2` | retries after first attempt (0–5) |
| `AI_MAX_TOKENS` | no | `1024` | completion cap |
| `AI_TEMPERATURE` | no | `0.3` | 0–2 |
| `AI_CONTEXT_MESSAGES` | no | `20` | history messages sent |
| `AI_CONTEXT_MAX_CHARS` | no | `12000` | char budget for history |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | no | `900000` / `300` | global per IP |
| `AUTH_RATE_LIMIT_MAX` | no | `20` | per IP per window on signup/login |
| `CHAT_RATE_LIMIT_WINDOW_MS` / `CHAT_RATE_LIMIT_MAX` | no | `60000` / `20` | per user on send |

## 5. Scripts (`server/package.json`)
`dev` (node --watch src/server.js), `start` (node src/server.js), `test` (vitest run), `test:watch`, `lint` (node --check over src is not required; no ESLint to keep deps minimal).
