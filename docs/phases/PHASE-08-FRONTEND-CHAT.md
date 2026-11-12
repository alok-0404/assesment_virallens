# PHASE 08 — Frontend Chat Interface

1. **Objective** — Complete, responsive chat dashboard.
2. **Requirements** — FE-03..09, CHAT-01, CHAT-06, CHAT-08, CHAT-09, CHAT-10.
3. **Prerequisites** — Phase 07 COMPLETE.
4. **Tasks** — `api/chatApi.js`, `context/ChatContext.jsx`, `hooks/useChat.js`, `utils/ids.js`, components in `components/chat/*`, `components/common/ConfirmDialog.jsx`, `pages/ChatPage.jsx`. Features: dashboard, sidebar, new conversation, conversation list, chat window, user/AI bubbles, input, typing indicator, suggested prompts, Markdown, code blocks, copy response, retry failed message, delete confirmation, mobile drawer, empty/loading/error states.
5. **Expected files** — above + tests (`ChatInput.test.jsx`, `MessageBubble.test.jsx`, `Sidebar.test.jsx`, `ChatPage.test.jsx`).
6. **Dependencies** — react-markdown, remark-gfm.
7. **UI** — 05-FRONTEND §3–§6.
8. **Edge cases** — very long words (wrap/`break-words`), long code lines (horizontal scroll), clipboard API unavailable (graceful message), empty history, failing history load, delete active conversation, sending while previous pending.
9. **Security checks** — no raw HTML in Markdown; links `noopener noreferrer`.
10. **Test cases** — chat UI rendering; message input; Enter / Shift+Enter; sidebar selection; delete confirmation; mobile layout (drawer toggle); message rendering (markdown/code/copy/failed retry).
11. **Build verification** — client `npm test` + `npm run build`.
12. **Acceptance criteria** — §10 pass + build OK.
13. **Completion checklist** — [ ] api [ ] context [ ] components [ ] page [ ] tests [ ] build
14. **Next phase dependency** — Phase 09 runs the UI against the real backend.
