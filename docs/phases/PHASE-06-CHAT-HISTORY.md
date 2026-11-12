# PHASE 06 — Chat History APIs

1. **Objective** — History, conversation, messages and delete endpoints with ownership enforcement.
2. **Requirements** — BE-06..09, CHAT-05, CHAT-06, CHAT-09, DB-04.
3. **Prerequisites** — Phase 05 COMPLETE.
4. **Tasks** — validators (`historyQuery`, `idParam`, `messagesQuery`); controller handlers `history`, `getConversation`, `getMessages`, `remove`; routes; consistent envelopes & meta.
5. **Expected files** — updates to `chat.controller.js`, `chat.routes.js`, `chat.schemas.js`; `tests/chat.history.test.js`.
6. **Dependencies** — chat.service from Phase 04.
7. **API** — 04-API §Chat.
8. **Edge cases** — page beyond total → empty list with correct meta; invalid ObjectId → 400 `VALIDATION_ERROR`; `before` cursor that does not belong to the (owned) conversation → 400 `INVALID_CURSOR`; limit outside bounds → 400.
9. **Security checks** — A cannot read/delete/send-into B's conversation (404); unauthenticated 401; DELETE requires CSRF.
10. **Test cases** — A sees only A; B sees only B; unauthorized retrieval blocked; unauthorized deletion blocked (and B's data intact); chronological ordering; history ordering by last activity; pagination meta; cursor pagination.
11. **Build verification** — server `npm test` green.
12. **Acceptance criteria** — §10 pass.
13. **Completion checklist** — [ ] validators [ ] handlers [ ] routes [ ] tests
14. **Next phase dependency** — Frontend phases consume these contracts.
