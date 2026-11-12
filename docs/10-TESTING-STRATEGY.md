# 10 — Testing Strategy

## 1. Tooling
| Area | Tools |
|---|---|
| Server | Vitest (node env), Supertest, `mongodb-memory-server` (real `mongod` binary, in-memory) |
| AI provider | Fake `fetch` injected into `createOpenRouterClient`; fake `aiClient` injected into `createApp` (tests only) |
| Client | Vitest (jsdom), `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`; API modules mocked with `vi.mock` |
| Live checks | `npm run smoke:ai` (real OpenRouter), manual/browser E2E against real Atlas — BLOCKED without credentials |

Mocks never ship in application code paths (Rule 6).

## 2. Server suites (`server/tests`)
| File | Covers |
|---|---|
| `env.test.js` | valid env, missing required, short JWT secret, `SameSite=none` + insecure, numeric coercion, error does not leak values |
| `app.test.js` | health 200/503, 404 JSON, malformed JSON 400, body > 100kb 413, helmet headers, CORS allow/deny, error handler 500 hides stack in production |
| `auth.test.js` | signup valid/duplicate/invalid email/weak password/unknown fields, password hashed, login valid/invalid/unknown email, cookie flags, me with/without/invalid/expired/tampered token, deleted user token, logout clears cookie, CSRF missing/mismatch, auth rate limit |
| `chat.models.test.js` | conversation & message creation, indexes present, toJSON shape, unique clientMessageId |
| `openrouter.service.test.js` | success payload & headers, retry on 500, no retry on 401, 429 → AI_RATE_LIMITED, timeout → AI_TIMEOUT, empty content, error body in 200, context building/ordering/trimming |
| `chat.send.test.js` | new conversation + title, continue conversation with ordered context, AI failure rollback (new + existing), idempotent replay, in-flight 409, validation, not-owned conversation 404, chat rate limit |
| `chat.history.test.js` | history pagination & ordering & isolation (A/B), get conversation, messages chronological + cursor pagination, delete owned, cross-user delete/read blocked, invalid id 400, unauthenticated 401 |
| `security.test.js` | NoSQL injection payloads, every protected endpoint 401, no `passwordHash`/key leakage in responses |

## 3. Client suites (`client/src/**/*.test.jsx`)
| File | Covers |
|---|---|
| `utils/validation.test.js` | email/password/name validators |
| `api/http.test.js` | credentials + base URL, single CSRF fetch, no token on GET, CSRF refresh + retry, 401 handler |
| `api/authApi.test.js` | logout sends a JSON object body (ISS-002) |
| `pages/AuthPages.test.jsx` | login/signup render, client validation, invalid credentials, server field errors, success redirects; route guards (spinner while restoring, anonymous redirect, session restore, authenticated redirect away from /login); 404 page |
| `components/chat/ChatInput.test.jsx` | Enter sends, Shift+Enter newline, empty not sent, disabled while sending, char limit |
| `components/chat/MessageBubble.test.jsx` | user vs assistant rendering, markdown/code, raw HTML and `javascript:` links neutralised, copy, failed + retry |
| `pages/ChatPage.test.jsx` | sidebar list/selection/delete flow/mobile drawer/logout (incl. failed logout), send → typing indicator → reply, AI error → failed message + retry, suggested prompt, rapid switching, URL restore, not-found state |

Login/Signup/ProtectedRoute/Sidebar behaviour is covered inside `AuthPages.test.jsx` and `ChatPage.test.jsx` (full-app rendering with mocked API modules) rather than in separate per-component files.

## 4. Commands
```bash
cd server && npm test        # all server tests
cd client && npm test        # all client tests
cd client && npm run build   # production build
cd server && npm run smoke:ai  # live OpenRouter (needs real key)
```

## 5. Gates
A phase is COMPLETE only when: its new tests pass, all previously passing tests still pass, and (for client phases) the production build succeeds. Results are recorded in `12-PROGRESS-TRACKER.md` with counts.
