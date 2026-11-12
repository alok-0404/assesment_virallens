# PHASE 04 — Chat Database and Backend Services

1. **Objective** — Conversation & Message models and an ownership-enforcing chat service layer.
2. **Requirements** — DB-02..05, CHAT-02, CHAT-04, CHAT-05.
3. **Prerequisites** — Phase 03 COMPLETE.
4. **Tasks**
   - `models/Conversation.js`, `models/Message.js` with indexes & toJSON (03-DATABASE).
   - `services/chat.service.js`: `generateTitle(text)`, `createConversation(userId, title)`, `findOwnedConversation(userId, id)` (404), `listConversations(userId, {page, limit})`, `listMessages(userId, conversationId, {limit, before})`, `addMessage(...)`, `touchConversation(...)`, `deleteConversation(userId, id)`, `getRecentMessages(userId, conversationId, n)`.
   - Ensure indexes are built (`Model.init()` / `syncIndexes` in tests).
5. **Expected files** — models, service, `tests/chat.models.test.js`.
6. **Dependencies** — Mongoose.
7. **API** — none new (exposed in 05/06).
8. **Edge cases** — title from whitespace-heavy / very long / multiline first message; pagination beyond last page; `before` cursor of another conversation; deleting conversation with many messages.
9. **Security checks** — every service function takes `userId` and filters by it; cross-user lookups return 404.
10. **Test cases** — conversation creation; message creation; message ordering (chronological); pagination (page & cursor); ownership checks; deletion cascades messages; cross-user access prevention; unique `clientMessageId` per user; title generation.
11. **Build verification** — server `npm test` green.
12. **Acceptance criteria** — §10 pass.
13. **Completion checklist** — [ ] models [ ] indexes [ ] service [ ] tests
14. **Next phase dependency** — Phase 05 composes these services into `sendMessage`.
