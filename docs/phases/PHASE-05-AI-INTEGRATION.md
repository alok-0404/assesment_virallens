# PHASE 05 — AI Integration

1. **Objective** — Real OpenRouter integration with timeout, retry, context management, persistence and duplicate prevention; `POST /api/chat/send`.
2. **Requirements** — AI-01..09, BE-05, CHAT-03, CHAT-07, CHAT-08.
3. **Prerequisites** — Phase 04 COMPLETE.
4. **Tasks**
   - `services/openrouter.service.js`: `createOpenRouterClient(env, {fetch, sleep, random})`, `DEFAULT_SYSTEM_PROMPT`, `buildContext(history, env)`; error mapping (07-AI §4).
   - `utils/inFlight.js`.
   - `chat.service.sendMessage(userId, {message, conversationId, clientMessageId}, aiClient, env)` per 07-AI §5.
   - `validators/chat.schemas.js` (`sendSchema`).
   - `controllers/chat.controller.js` `send`; `routes/chat.routes.js` (`requireAuth`, `chatLimiter`).
   - `createApp(env, { aiClient })` injection; default real client.
   - `scripts/smoke-openrouter.js` live check.
5. **Expected files** — above + `tests/openrouter.service.test.js`, `tests/chat.send.test.js`.
6. **Dependencies** — native fetch.
7. **API** — 04-API `POST /api/chat/send`.
8. **Edge cases** — provider 200 with `error` body; `choices` empty; whitespace-only content; `Retry-After` header; abort during retry; client double-click (lock) and network retry (idempotency); conversation deleted mid-request.
9. **Security checks** — key only in `Authorization` header server-side; error messages generic; provider body not echoed to client.
10. **Test cases** — mocked success; API failure (500 ×3) → 502; retry then success; timeout → 504; invalid key (401) → 502 `AI_AUTH_ERROR` no retry; empty response → 502; rate limit (429) → 503; context ordering & trimming; send creates conversation + title; continue conversation passes previous messages; rollback on failure; idempotent replay; concurrent send → 409; live smoke test (BLOCKED without key).
11. **Build verification** — server `npm test` green.
12. **Acceptance criteria** — §10 pass (live smoke may be BLOCKED).
13. **Completion checklist** — [ ] client [ ] context [ ] send orchestration [ ] route [ ] tests [ ] smoke script
14. **Next phase dependency** — Phase 06 adds read/delete endpoints on the same router.
