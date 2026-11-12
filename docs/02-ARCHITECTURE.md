# 02 — Architecture

## 1. Style
Single monorepo with two deployable units — **client** (static SPA) and **server** (REST API). No microservices. MongoDB Atlas is an external managed service. OpenRouter is called only from the server.

## 2. Topology

```text
                    ┌──────────────────────────── same origin ─────────────────────────────┐
Browser ──HTTPS──►  │ Static SPA (Vite dev / Nginx in Docker / Vercel)                     │
                    │    /           → index.html (SPA fallback)                            │
                    │    /api/*      → reverse proxy ───────────►  Express API (:5000)      │
                    └───────────────────────────────────────────────────┬──────────────────┘
                                                                         │ Mongoose (TLS)
                                                                         ▼
                                                                  MongoDB Atlas
                                                                         ▲
                                         Express API ── HTTPS (Bearer key, server-only) ──► OpenRouter
```

**Same-origin by proxy (decision D-003).** In every environment the browser talks to a single origin and `/api` is proxied to the backend:
- Development: Vite dev-server proxy (`/api` → `http://localhost:5000`).
- Docker: Nginx `location /api/` → `http://server:5000`.
- Vercel: `vercel.json` rewrite `/api/:path*` → Render URL.

Consequences: auth cookies are first-party, `SameSite=Lax` works, no third-party-cookie problems. CORS is still configured (allow-list + credentials) for direct cross-origin use.

## 3. Folder structure (locked)

```text
/
├── client/
│   ├── Dockerfile, nginx.conf, vercel.json, .env.example, .dockerignore
│   ├── index.html, vite.config.js, package.json
│   └── src/
│       ├── main.jsx, App.jsx, index.css
│       ├── api/            http.js (axios + CSRF), authApi.js, chatApi.js
│       ├── context/        AuthContext.jsx, ChatContext.jsx
│       ├── hooks/          useAuth.js, useChat.js
│       ├── components/
│       │   ├── auth/       AuthLayout.jsx, FormField.jsx
│       │   ├── chat/       Sidebar.jsx, ConversationItem.jsx, ChatWindow.jsx, MessageList.jsx,
│       │   │               MessageBubble.jsx, MarkdownContent.jsx, CopyButton.jsx, ChatInput.jsx,
│       │   │               TypingIndicator.jsx, SuggestedPrompts.jsx
│       │   └── common/     ProtectedRoute.jsx, PublicOnlyRoute.jsx, Spinner.jsx,
│       │                   ErrorBanner.jsx, ConfirmDialog.jsx
│       ├── pages/          LoginPage.jsx, SignupPage.jsx, ChatPage.jsx, NotFoundPage.jsx
│       ├── utils/          validation.js, errors.js, ids.js, format.js
│       └── test/           setup.js, renderApp.jsx
├── server/
│   ├── Dockerfile, .env.example, .dockerignore, package.json, vitest.config.js
│   ├── src/
│   │   ├── server.js       entry: env → db → listen → graceful shutdown
│   │   ├── app.js          createApp(): middleware + routes (no side effects; testable)
│   │   ├── config/         env.js (Zod-validated), db.js
│   │   ├── models/         User.js, Conversation.js, Message.js
│   │   ├── validators/     auth.schemas.js, chat.schemas.js
│   │   ├── middleware/     auth.js, csrf.js, validate.js, rateLimiters.js,
│   │   │                   requestLogger.js, notFound.js, errorHandler.js
│   │   ├── services/       auth.service.js, chat.service.js, openrouter.service.js
│   │   ├── controllers/    health.controller.js, auth.controller.js, chat.controller.js
│   │   ├── routes/         index.js, health.routes.js, auth.routes.js, chat.routes.js
│   │   └── utils/          AppError.js, apiResponse.js, cookies.js, jwt.js, logger.js, inFlight.js
│   ├── scripts/            smoke-openrouter.js (live provider check, needs real key)
│   └── tests/              *.test.js + helpers/
├── docs/                   this documentation
├── docker-compose.yml
├── render.yaml
├── .gitignore
└── README.md
```

## 4. Backend layering
`routes` (HTTP wiring + validators + middleware) → `controllers` (HTTP in/out only) → `services` (business logic, DB queries with ownership filter, OpenRouter) → `models` (Mongoose). Controllers never query the DB directly; services never touch `req`/`res`.

## 5. Key request flows

### 5.1 Signup / login
1. Client fetches CSRF token (`GET /api/auth/csrf-token`) lazily before first mutating request.
2. `POST /api/auth/signup|login` with `X-CSRF-Token` header → Zod validation → bcrypt hash/compare → JWT signed with `sub=userId` → set `access_token` HttpOnly cookie → return public user.

### 5.2 Session restoration
On app load `AuthContext` calls `GET /api/auth/me`. 200 → user stored in context; 401 → anonymous. Protected routes render a spinner until this resolves.

### 5.3 Send message
1. UI appends optimistic user message + typing indicator; disables send.
2. `POST /api/chat/send { message, conversationId?, clientMessageId }`.
3. Server: auth → CSRF → rate limit → validate → in-flight lock (per user+conversation) → find conversation **by `_id` AND `user`** or create one (title from first message) → insert user message (unique `user+clientMessageId`) → load last N messages chronologically → OpenRouter (timeout + retry) → insert assistant message → update `lastMessageAt`/`messageCount` → respond 201.
4. On AI failure: the user message (and a conversation created in this request) are rolled back, a mapped error is returned; UI marks the message *failed* with a Retry button (decision D-006).

### 5.4 History / continue / delete
Sidebar loads `GET /api/chat/history`. Selecting a conversation navigates to `/chat/:id` and loads `GET /api/chat/conversations/:id/messages`. Delete → confirm dialog → `DELETE /api/chat/conversations/:id` (conversation + its messages).

## 6. Cross-cutting
- Response envelope: `{ success: true, data, meta? }` / `{ success: false, error: { code, message, details? } }`.
- Errors: `AppError(status, code, message, details)` thrown anywhere → `errorHandler` (Express 5 forwards async rejections automatically).
- Logging: `requestLogger` (method, path without query, status, ms). Never logs bodies, cookies, headers or keys.
- Config: all runtime config via env vars validated by Zod at startup.
