# 04 — API Specification

Base path: `/api`. JSON only. Authenticated endpoints read the JWT from the `access_token` HttpOnly cookie. All **mutating** requests (`POST`, `PUT`, `PATCH`, `DELETE`) require header `X-CSRF-Token` matching the `csrf_token` cookie (see 08-SECURITY).

## Envelope
```json
// success
{ "success": true, "data": { ... }, "meta": { ... } }
// error
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Human readable", "details": [{ "path": "email", "message": "Invalid email" }] } }
```

## Error codes
| HTTP | code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Zod validation failed |
| 400 | `INVALID_JSON` | Malformed JSON body |
| 400 | `INVALID_CURSOR` | `before` cursor is not a message of the requested conversation |
| 401 | `UNAUTHORIZED` | Missing/invalid/expired token, or user no longer exists |
| 401 | `INVALID_CREDENTIALS` | Login failed (generic message) |
| 403 | `CSRF_INVALID` | Missing/mismatched CSRF token |
| 403 | `CORS_FORBIDDEN` | Origin not allowed |
| 404 | `NOT_FOUND` / `CONVERSATION_NOT_FOUND` | Route or resource not found / not owned |
| 409 | `EMAIL_IN_USE` | Duplicate signup |
| 409 | `REQUEST_IN_PROGRESS` | Another send for the same conversation is in flight |
| 409 | `DUPLICATE_REQUEST` | Same `clientMessageId` currently being processed |
| 413 | `PAYLOAD_TOO_LARGE` | Body > 100 kb |
| 429 | `RATE_LIMITED` | Rate limit exceeded |
| 500 | `INTERNAL_ERROR` | Unexpected error (no stack in production) |
| 502 | `AI_PROVIDER_ERROR` | Provider 5xx/unknown error after retries |
| 502 | `AI_AUTH_ERROR` | Provider rejected the server's API key (401/403) |
| 502 | `AI_EMPTY_RESPONSE` | Provider returned no content |
| 502 | `AI_BAD_REQUEST` | Provider rejected the request (400/402/404/413/422) |
| 503 | `AI_RATE_LIMITED` | Provider 429 after retries |
| 504 | `AI_TIMEOUT` | Provider did not respond within `AI_TIMEOUT_MS` (all attempts) |
| 503 | `SERVICE_UNAVAILABLE` | Database not connected (health) |

## Public objects
```json
User:         { "id": "…", "name": "Ada", "email": "ada@example.com", "createdAt": "ISO" }
Conversation: { "id": "…", "title": "My order is late", "lastMessageAt": "ISO", "messageCount": 4, "createdAt": "ISO", "updatedAt": "ISO" }
Message:      { "id": "…", "conversationId": "…", "role": "user|assistant", "content": "…", "clientMessageId": "…?", "replyTo": "…?", "model": "…?", "createdAt": "ISO" }
```

---

## Health
### `GET /api/health`
200 `{ success, data: { status: "ok", uptime, database: "connected", timestamp } }`; 503 `SERVICE_UNAVAILABLE` with `database: "disconnected"` when Mongo is not connected.

## Auth
### `GET /api/auth/csrf-token`
Public. Issues a CSRF token, sets `csrf_token` cookie (HttpOnly). 200 `{ data: { csrfToken } }`.

### `POST /api/auth/signup` (BE-01)
Body: `{ name: string 2–60, email: valid email ≤254, password: 8–128 with ≥1 letter and ≥1 digit }` (unknown keys rejected).
201 `{ data: { user } }` + sets `access_token` cookie. Errors: 400, 403 CSRF, 409 `EMAIL_IN_USE`, 429.

### `POST /api/auth/login` (BE-02)
Body: `{ email, password (1–128) }`. 200 `{ data: { user } }` + cookie. Errors: 400, 401 `INVALID_CREDENTIALS`, 403, 429.

### `POST /api/auth/logout` (BE-03)
Clears `access_token` cookie. Works whether or not the session is still valid (idempotent). 200 `{ data: { loggedOut: true } }`. Requires CSRF.

### `GET /api/auth/me` (BE-04)
Auth required. 200 `{ data: { user } }`; 401 `UNAUTHORIZED`.

## Chat (all require auth)
### `POST /api/chat/send` (BE-05)
Body:
```json
{ "message": "string, trimmed, 1–4000", "conversationId": "ObjectId (optional)", "clientMessageId": "string 8–64 [A-Za-z0-9_-] (optional, recommended)" }
```
Behaviour: if `conversationId` omitted → creates conversation (title from message). Persists user message, calls OpenRouter with system prompt + recent context, persists assistant message.
201
```json
{ "success": true, "data": { "conversation": Conversation, "userMessage": Message, "assistantMessage": Message } }
```
Idempotent replay: if `clientMessageId` was already completed for this user → 200 with the same payload shape (no new AI call).
Errors: 400, 401, 403, 404 `CONVERSATION_NOT_FOUND`, 409 `REQUEST_IN_PROGRESS`/`DUPLICATE_REQUEST`, 429, 502/503/504 `AI_*`.
Rate limit: `CHAT_RATE_LIMIT_MAX` per `CHAT_RATE_LIMIT_WINDOW_MS` per user.

### `GET /api/chat/history` (BE-06)
Query: `page` (default 1), `limit` (default 20, max 50).
200 `{ data: { conversations: Conversation[] }, meta: { page, limit, total, totalPages, hasMore } }` sorted by `lastMessageAt` desc. Only caller's conversations.

### `GET /api/chat/conversations/:id` (BE-07)
200 `{ data: { conversation } }`; 400 invalid id; 404 not found / not owned.

### `GET /api/chat/conversations/:id/messages` (BE-08)
Query: `limit` (default 50, max 100), `before` (message id, optional).
200 `{ data: { messages: Message[] (chronological), hasMore, nextCursor } }`; 400; 404.

### `DELETE /api/chat/conversations/:id` (BE-09)
Deletes the conversation and all its messages. 200 `{ data: { id, deletedMessages } }`; 400; 404 (also for another user's conversation).

## Status code summary
| Endpoint | Success | Auth | CSRF | Rate limit |
|---|---|---|---|---|
| GET /api/health | 200 | – | – | global |
| GET /api/auth/csrf-token | 200 | – | – | global |
| POST /api/auth/signup | 201 | – | ✔ | auth |
| POST /api/auth/login | 200 | – | ✔ | auth |
| POST /api/auth/logout | 200 | – | ✔ | global |
| GET /api/auth/me | 200 | ✔ | – | global |
| POST /api/chat/send | 201/200 | ✔ | ✔ | chat |
| GET /api/chat/history | 200 | ✔ | – | global |
| GET /api/chat/conversations/:id | 200 | ✔ | – | global |
| GET /api/chat/conversations/:id/messages | 200 | ✔ | – | global |
| DELETE /api/chat/conversations/:id | 200 | ✔ | ✔ | global |
