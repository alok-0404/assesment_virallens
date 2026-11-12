# 01 — Assessment Requirements

> Source of truth for WHAT must be built. Every requirement has a stable ID that is referenced by phase documents, tests and the final report. Never delete a requirement; if scope changes, record it in `13-DECISION-LOG.md`.

## 1. Original assessment (verbatim summary)

**Project:** Minimal AI Customer Support Agent — a full-stack MERN application in which authenticated users chat with an AI customer-support assistant. Conversations are persisted per user in MongoDB and AI replies are generated through OpenRouter.

### Authentication
Signup, login, logout, JWT authentication, bcrypt password hashing, protected routes, authenticated user restoration (on refresh), secure cookie-based token handling, user identity derived from the verified JWT.

### Chat system
Chat text input, user messages, real AI-generated responses, MongoDB persistence, user-scoped chat data, previous conversations, continue previous conversations, new conversation, conversation deletion, typing indicator.

### AI
OpenRouter integration, configurable model, system prompt, conversation context, API error handling, retry handling, timeout handling, server-side API key protection.

### Backend — mandatory endpoints
`POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/chat/send`, `GET /api/chat/history`. Additional endpoints for conversation retrieval, messages and deletion must be documented and implemented.

### Database
Three collections: Users, Conversations, Messages. Ownership enforced at database-query level.

### Frontend
Login, signup, chat dashboard, conversation sidebar, chat history, message input, AI response, loading and error states, responsive design, logout.

### DevOps
Frontend Dockerfile, backend Dockerfile, Docker Compose, `.env.example`, README, deployment configuration.

### Locked technology stack
React + Vite (JavaScript), Tailwind CSS, React Router DOM, Axios, React Context API, Node.js + Express, MongoDB Atlas + Mongoose, JWT, bcrypt, OpenRouter, Zod/express-validator, Helmet, CORS, express-rate-limit, Jest/Vitest + Supertest, Vercel + Render, Docker + Docker Compose, Nginx.

### Final success criteria (Part 10 of the brief)
1. Runs locally. 2. Connects to MongoDB Atlas. 3. Registers users. 4. Authenticates securely. 5. Protects private routes. 6. Real AI responses via OpenRouter. 7. Saves messages. 8. Maintains conversation context. 9. Shows previous conversations. 10. Enforces user data isolation. 11. Handles failures. 12. Functional responsive UI. 13. Passes automated tests. 14. Passes production frontend build. 15. Runs with Docker Compose. 16. Complete documentation. 17. Ready for GitHub submission. 18. Deployment-ready configuration.

## 2. Functional requirements checklist

| ID | Requirement | Phase(s) | Acceptance criterion (evidence) |
|---|---|---|---|
| AUTH-01 | Signup with name, email, password | 03, 07 | `POST /api/auth/signup` → 201 + user; UI signup form creates account and lands on `/chat` |
| AUTH-02 | Login | 03, 07 | `POST /api/auth/login` → 200 + auth cookie; UI login works |
| AUTH-03 | Logout | 03, 07 | `POST /api/auth/logout` clears cookie; UI redirects to `/login` |
| AUTH-04 | JWT authentication | 03 | Signed HS256 JWT with `sub` = user id, verified on every protected request |
| AUTH-05 | bcrypt password hashing | 03 | Stored `passwordHash` starts with `$2`; plaintext never stored/returned (test) |
| AUTH-06 | Protected routes (API + UI) | 03, 07 | API → 401 without valid cookie; UI redirects unauthenticated users to `/login` |
| AUTH-07 | Authenticated user restoration | 03, 07 | `GET /api/auth/me` restores session after page refresh |
| AUTH-08 | Secure cookie-based token handling | 03, 10 | Cookie is `HttpOnly`, `SameSite`, `Secure` in production, never exposed to JS |
| AUTH-09 | Identity derived only from verified JWT | 03, 06, 10 | No endpoint accepts a user id from body/query/params (test + audit) |
| AUTH-10 | Validation (email format, password strength) | 03, 07 | Invalid email / weak password → 400 `VALIDATION_ERROR`; UI shows field errors |
| AUTH-11 | Rate limiting on auth | 03, 10 | Exceeding limit → 429 `RATE_LIMITED` (test) |
| AUTH-12 | CSRF protection for cookie auth | 03, 10 | Mutating request without valid `X-CSRF-Token` → 403 `CSRF_INVALID` (test) |
| CHAT-01 | Chat text input | 08 | Textarea; Enter sends, Shift+Enter newline (test) |
| CHAT-02 | User messages displayed and persisted | 04, 05, 08 | User message saved in `messages` with `role: "user"` |
| CHAT-03 | Real AI responses | 05, 09 | Assistant message produced by OpenRouter (live smoke test) |
| CHAT-04 | MongoDB persistence | 04 | Conversations & messages stored and reloaded after refresh |
| CHAT-05 | User-scoped chat data | 04, 06 | All queries filter by `user` from JWT (tests for cross-user access) |
| CHAT-06 | Previous conversations list | 06, 08 | `GET /api/chat/history` + sidebar list ordered by last activity |
| CHAT-07 | Continue previous conversation | 05, 08, 09 | Sending with `conversationId` appends to it and uses its context |
| CHAT-08 | New conversation | 05, 08 | "New chat" button; first send creates a conversation titled from the first message |
| CHAT-09 | Conversation deletion | 06, 08 | `DELETE /api/chat/conversations/:id` removes conversation + messages; UI confirmation dialog |
| CHAT-10 | Typing indicator | 08 | Animated indicator visible while awaiting AI reply |
| AI-01 | OpenRouter integration | 05 | `services/openrouter.service.js` calls `/chat/completions` |
| AI-02 | Configurable model | 05 | `OPENROUTER_MODEL` env var |
| AI-03 | System prompt | 05 | Default customer-support prompt, overridable with `AI_SYSTEM_PROMPT` |
| AI-04 | Conversation context | 05 | Last N messages (chronological) sent with each request (test) |
| AI-05 | API error handling | 05 | Provider errors mapped to safe codes (`AI_*`), no key/internal leakage (tests) |
| AI-06 | Retry handling | 05 | Retries on 429/5xx/timeout/network with backoff, not on 4xx auth errors (tests) |
| AI-07 | Timeout handling | 05 | `AI_TIMEOUT_MS` abort → 504 `AI_TIMEOUT` (test) |
| AI-08 | Server-side API key protection | 05, 10 | Key only in server env; never in client bundle/responses/logs (audit) |
| AI-09 | Duplicate submission prevention | 05, 08 | In-flight lock + `clientMessageId` idempotency; UI disables send while pending |
| BE-01 | `POST /api/auth/signup` | 03 | See 04-API-SPECIFICATION |
| BE-02 | `POST /api/auth/login` | 03 | 〃 |
| BE-03 | `POST /api/auth/logout` | 03 | 〃 |
| BE-04 | `GET /api/auth/me` | 03 | 〃 |
| BE-05 | `POST /api/chat/send` | 05 | 〃 |
| BE-06 | `GET /api/chat/history` | 06 | 〃 |
| BE-07 | Conversation retrieval endpoint | 06 | `GET /api/chat/conversations/:id` |
| BE-08 | Messages endpoint (paginated) | 06 | `GET /api/chat/conversations/:id/messages` |
| BE-09 | Deletion endpoint | 06 | `DELETE /api/chat/conversations/:id` |
| BE-10 | Health endpoint | 01, 02 | `GET /api/health` → 200 |
| BE-11 | Consistent response format & centralized errors | 02 | `{ success, data }` / `{ success:false, error:{code,message} }` |
| DB-01 | Users collection | 03 | `User` model |
| DB-02 | Conversations collection | 04 | `Conversation` model |
| DB-03 | Messages collection | 04 | `Message` model |
| DB-04 | Ownership enforced in DB queries | 04, 06 | Every read/write filter includes `user: req.user.id` |
| DB-05 | Indexes | 04 | Indexes defined in 03-DATABASE-DESIGN exist |
| FE-01 | Login page | 07 | `/login` |
| FE-02 | Signup page | 07 | `/signup` |
| FE-03 | Chat dashboard | 08 | `/chat` and `/chat/:conversationId` |
| FE-04 | Conversation sidebar | 08 | Sidebar with list, new chat, delete, user info, logout |
| FE-05 | Chat history displayed | 08, 09 | Selecting a conversation loads its messages |
| FE-06 | Message input | 08 | `ChatInput` component |
| FE-07 | AI response rendering (Markdown, code, copy) | 08 | `MarkdownContent` + copy button |
| FE-08 | Loading & error states | 07, 08 | Spinners, skeletons, error banners, retry for failed message |
| FE-09 | Responsive design | 08 | Mobile drawer sidebar below `md` breakpoint |
| FE-10 | Logout | 07 | Sidebar logout button |
| OPS-01 | Frontend Dockerfile | 11 | `client/Dockerfile` multi-stage → Nginx (non-root) |
| OPS-02 | Backend Dockerfile | 11 | `server/Dockerfile` multi-stage, prod deps, non-root, HEALTHCHECK |
| OPS-03 | Docker Compose | 11 | `docker compose up --build` starts the full app |
| OPS-04 | `.env.example` files | 01 | `server/.env.example`, `client/.env.example` |
| OPS-05 | README | 12 | Complete root `README.md` |
| OPS-06 | Deployment configuration | 12 | `render.yaml`, `client/vercel.json` |
| OPS-07 | Nginx production frontend server | 11 | `client/nginx.conf` |

## 3. Non-functional requirements

| ID | Requirement | Phase | Acceptance criterion |
|---|---|---|---|
| NFR-01 | Security headers | 02 | Helmet enabled on API; Nginx adds headers |
| NFR-02 | CORS restricted to configured origins with credentials | 02 | Disallowed origin gets no `Access-Control-Allow-Origin` (test) |
| NFR-03 | JSON body size limit | 02 | Body > 100kb → 413 (test) |
| NFR-04 | Request logging without sensitive data | 02 | Logs only method, path (no query), status, duration |
| NFR-05 | Environment validation at startup | 02 | Missing/invalid env → process exits with list of invalid keys (no values) |
| NFR-06 | Graceful shutdown | 02, 11 | SIGTERM closes HTTP server and Mongo connection |
| NFR-07 | Automated tests | 03–10 | `npm test` passes in `server/` and `client/` |
| NFR-08 | Production frontend build | 01, 10 | `npm run build` in `client/` succeeds |
| NFR-09 | Accessibility basics | 07, 08 | Labelled inputs, buttons with accessible names, focus states |
| NFR-10 | No secrets committed | 01, 10 | `.env` gitignored; only `.env.example` committed |
| NFR-11 | Input validation on every endpoint | 03–06 | Zod schemas for body/params/query |

## 4. Out of scope (explicitly)
Email verification, password reset, OAuth, streaming responses (SSE), admin panel, multi-tenant knowledge base / RAG, horizontal scaling of the in-flight lock. These are documented as possible future work only.
