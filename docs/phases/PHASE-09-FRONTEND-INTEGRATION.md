# PHASE 09 — Frontend and Backend Integration

1. **Objective** — Verify the UI and API work together end-to-end in a real browser.
2. **Requirements** — CHAT-03, CHAT-07, FE-05, plus all auth/chat flows.
3. **Prerequisites** — Phases 01–08 COMPLETE.
4. **Tasks** — Run server (`npm run dev`) and client (`npm run dev`); exercise journeys in a browser; fix integration bugs (state sync, duplicate messages, rapid switching, restore selected conversation, provider error display).
   - With real credentials: Atlas URI + OpenRouter key in `server/.env`.
   - Without credentials (local verification only): a local `mongod` (mongodb-memory-server binary) may be used as the database; the OpenRouter-dependent steps are then BLOCKED, and the UI's provider-error path is verified instead.
   - To exercise the success UI path without a key, `OPENROUTER_BASE_URL` may be pointed (process env only, never committed) at a throwaway OpenAI-compatible stub kept outside the repository. Its replies are labelled "Local stub provider" and do **not** count as live AI verification.
5. **Expected files** — fixes only; evidence in tracker.
6. **Dependencies** — running backend + DB.
7. **API/UI** — all.
8. **Edge cases** — refresh on `/chat/:id`; refresh on deleted/foreign id (shows not-found state + new chat); switching conversations while a reply is pending; logging out and in as another user (no stale state).
9. **Security checks** — cookies visible in devtools as HttpOnly; `/me` after logout 401.
10. **Test cases** — complete signup→chat journey; send message; receive AI response (BLOCKED w/o key); refresh restores chat; continue previous conversation; delete conversation; switch accounts; data isolation.
11. **Build verification** — client build; server tests still green.
12. **Acceptance criteria** — all non-credential journeys verified in browser; AI journeys verified when key available (else BLOCKED).
13. **Completion checklist** — [ ] journeys [ ] fixes logged [ ] regression green
14. **Next phase dependency** — Phase 10 audits everything.
