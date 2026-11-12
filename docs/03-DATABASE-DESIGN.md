# 03 — Database Design

MongoDB Atlas, accessed via Mongoose. Database name comes from the connection string (recommended: `ai_support`). Three collections.

## 1. `users` (model `User`)
| Field | Type | Rules |
|---|---|---|
| `_id` | ObjectId | |
| `name` | String | required, trimmed, 2–60 chars |
| `email` | String | required, unique, lowercase, trimmed, max 254 |
| `passwordHash` | String | required, bcrypt hash, `select: false` |
| `createdAt`, `updatedAt` | Date | `timestamps: true` |

Indexes: `{ email: 1 }` unique.
`toJSON` transform: `_id` → `id`; remove `__v`, `passwordHash`.

## 2. `conversations` (model `Conversation`)
| Field | Type | Rules |
|---|---|---|
| `_id` | ObjectId | |
| `user` | ObjectId → User | required, **ownership key** |
| `title` | String | required, max 80; generated from first user message (whitespace-collapsed, truncated to 60 chars + "…") |
| `lastMessageAt` | Date | required, default now; updated on every exchange |
| `messageCount` | Number | default 0, incremented by 2 per successful exchange |
| `createdAt`, `updatedAt` | Date | timestamps |

Indexes: `{ user: 1, lastMessageAt: -1 }` (history listing).

## 3. `messages` (model `Message`)
| Field | Type | Rules |
|---|---|---|
| `_id` | ObjectId | |
| `conversation` | ObjectId → Conversation | required |
| `user` | ObjectId → User | required, **ownership key** (denormalised for query-level isolation) |
| `role` | String | enum `user` \| `assistant` |
| `content` | String | required, max 20 000 chars (user input itself limited to 4 000 by validator) |
| `clientMessageId` | String | optional, only on `user` messages; idempotency key |
| `replyTo` | ObjectId → Message | only on `assistant` messages, references the user message |
| `model` | String | only on `assistant` messages (model id reported by provider) |
| `usage` | `{ promptTokens, completionTokens, totalTokens }` | optional, assistant only |
| `createdAt`, `updatedAt` | Date | timestamps |

Indexes:
- `{ conversation: 1, createdAt: 1, _id: 1 }` — chronological reads & cursor pagination.
- `{ user: 1, conversation: 1 }` — ownership-scoped queries / deletion.
- `{ user: 1, clientMessageId: 1 }` unique, `partialFilterExpression: { clientMessageId: { $type: "string" } }` — duplicate-submission prevention.

## 4. Relationships
`User 1 — N Conversation 1 — N Message`. Deleting a conversation deletes its messages (application-level cascade in `chat.service.deleteConversation`). Users are never deleted by the application.

## 5. Ownership rules (DB-04) — MUST hold for every query
| Operation | Filter |
|---|---|
| List conversations | `{ user: userId }` |
| Get conversation | `{ _id: id, user: userId }` → 404 if null |
| Read messages | conversation verified with `{ _id, user }` **and** messages queried with `{ conversation: id, user: userId }` |
| Send message to existing conversation | `{ _id: id, user: userId }` |
| Delete conversation | `findOneAndDelete({ _id: id, user: userId })` then `deleteMany({ conversation: id, user: userId })` |

`userId` always comes from `req.user.id` (set by JWT middleware), never from client input. Accessing another user's resource returns **404** (not 403) to avoid revealing existence.

## 6. Pagination
- Conversations: page-based `page` (≥1), `limit` (1–50, default 20), sorted `lastMessageAt desc, _id desc`; meta `{ page, limit, total, totalPages, hasMore }`.
- Messages: cursor-based. `limit` (1–100, default 50), optional `before` (message id). Query newest-first `{ createdAt: -1, _id: -1 }` limited to `limit+1`, then reversed to chronological order. Returns `{ messages, hasMore, nextCursor }` where `nextCursor` is the id of the oldest returned message.

## 7. Consistency notes
- No multi-document transactions (works on Atlas M0 and on the standalone test server). Failure windows are small and documented: a crash between conversation deletion and message deletion can leave orphan messages that are unreachable (ownership-checked through the conversation).
- On AI failure, the inserted user message (and a conversation created in the same request) are removed (D-006).
