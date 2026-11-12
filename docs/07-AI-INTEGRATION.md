# 07 — AI Integration (OpenRouter)

## 1. Provider
OpenRouter OpenAI-compatible endpoint `POST {OPENROUTER_BASE_URL}/chat/completions`, called **only from the server** with Node's built-in `fetch`. No SDK dependency.

Headers: `Authorization: Bearer ${OPENROUTER_API_KEY}`, `Content-Type: application/json`, `HTTP-Referer: ${OPENROUTER_APP_URL}`, `X-Title: ${OPENROUTER_APP_NAME}`.

Body:
```json
{ "model": "<OPENROUTER_MODEL>", "messages": [ {"role":"system","content":"…"}, …history…, {"role":"user","content":"…"} ],
  "max_tokens": <AI_MAX_TOKENS>, "temperature": <AI_TEMPERATURE> }
```

Response used: `choices[0].message.content` (trimmed), `model`, `usage.{prompt_tokens,completion_tokens,total_tokens}`. OpenRouter may also return HTTP 200 with an `error` object — treated as a provider error.

## 2. Default system prompt (AI-03)
```
You are "Ava", a friendly and professional customer support assistant for an online store.
Goals: understand the customer's issue, give clear, accurate, concise help, and resolve it in as few turns as possible.
Rules:
- Be polite, empathetic and solution-oriented. Use short paragraphs or bullet steps.
- You do not have access to real order, account or payment systems. Never invent order numbers, tracking data, prices, policies or refunds. When specific account data is needed, explain what information the customer should prepare and that a human agent can verify it.
- Ask a clarifying question when the request is ambiguous.
- If the customer is angry, acknowledge feelings before solving.
- Offer to escalate to a human agent for billing disputes, legal issues, security concerns or when you cannot help.
- Never request full card numbers, passwords or one-time codes.
- Stay on customer-support topics; politely decline unrelated or harmful requests.
- Format answers with Markdown when it improves readability.
```
Overridable with `AI_SYSTEM_PROMPT`.

## 3. Context management (AI-04)
1. After persisting the new user message, load the conversation's most recent `AI_CONTEXT_MESSAGES` messages (`user`-scoped query, newest first, then reversed → chronological).
2. Walk from newest to oldest, keeping messages while the cumulative content length ≤ `AI_CONTEXT_MAX_CHARS`; the newest user message is always kept (it is ≤ 4 000 chars).
3. Ensure the first history message is a `user` turn (drop a leading `assistant` message if trimming left one).
4. Final payload: `[system, ...history]` in chronological order.

## 4. Timeout, retry and error mapping (AI-05/06/07)
- Each attempt uses `AbortController` with `AI_TIMEOUT_MS`.
- Retryable: network errors, timeouts, HTTP 408, 429, 500, 502, 503, 504. Max `AI_MAX_RETRIES` retries.
- Backoff: `min(500ms * 2^attempt, 4000ms)` + up to 250 ms jitter; on 429 honour `Retry-After` (seconds) capped at 5 s.
- Not retried: 400, 401, 402, 403, 404, 413, 422, empty content.

| Condition (final) | AppError |
|---|---|
| 401 / 403 | 502 `AI_AUTH_ERROR` "AI service is not configured correctly." |
| 400 / 402 / 404 / 413 / 422 | 502 `AI_BAD_REQUEST` "AI service rejected the request." |
| 429 | 503 `AI_RATE_LIMITED` "AI service is busy. Please try again shortly." |
| timeout | 504 `AI_TIMEOUT` "AI service timed out. Please try again." |
| 5xx / network / provider `error` body | 502 `AI_PROVIDER_ERROR` "AI service is temporarily unavailable." |
| empty/blank content | 502 `AI_EMPTY_RESPONSE` "AI service returned an empty response." |

Provider response bodies are logged server-side **truncated to 300 chars, without headers**; the API key is never logged or returned.

## 5. Send orchestration (`chat.service.sendMessage`)
1. Acquire in-flight lock `userId:conversationId` (or `userId:new:clientMessageId`) → 409 `REQUEST_IN_PROGRESS` if held.
2. If `clientMessageId` given and a completed exchange exists → return it (idempotent replay, status 200).
3. Resolve conversation (`{_id, user}`) or create one with generated title.
4. Insert user message (duplicate key on `user+clientMessageId` → 409 `DUPLICATE_REQUEST`).
5. Build context, call provider.
6. Success → insert assistant message (`replyTo`, `model`, `usage`), update conversation `lastMessageAt = now`, `messageCount += 2`.
7. Failure → delete inserted user message; if conversation was created in this request delete it; rethrow mapped error.
8. Always release lock (`finally`).

## 6. Testing
Unit tests inject a fake `fetch` into `createOpenRouterClient` (success, 500→retry→success, 401 no retry, 429 → AI_RATE_LIMITED, timeout, empty content, error-in-200 body). Integration tests inject a fake `aiClient` into `createApp`. A live smoke test (`npm run smoke:ai` → `scripts/smoke-openrouter.js`) calls the real API when `OPENROUTER_API_KEY` is set; BLOCKED otherwise.
