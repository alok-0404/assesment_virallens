# PHASE 00 — Documentation

1. **Objective** — Produce the complete documentation system that drives all later phases.
2. **Requirements** — All IDs in `01-ASSESSMENT-REQUIREMENTS.md` must be captured and mapped.
3. **Prerequisites** — Original brief; workspace inspection (empty workspace; Node 24, npm 11, git; no Docker; no Atlas/OpenRouter credentials).
4. **Tasks** — Write docs 00–14; write 14 phase documents; build requirement → phase → acceptance mapping; initialise tracker and decision log.
5. **Expected files** — `docs/00…14-*.md`, `docs/phases/PHASE-00…13-*.md`.
6. **Dependencies** — none.
7. **API/UI requirements** — defined in 04 and 05.
8. **Edge cases** — requirements that cannot be verified locally (Atlas, OpenRouter, Docker, deployment) must be flagged as potentially BLOCKED up front.
9. **Security checks** — 08-SECURITY-REQUIREMENTS covers auth, cookies, CSRF, CORS, rate limits, validation, secrets, isolation.
10. **Test cases** — Review: every requirement ID appears in the 01 checklist with a phase and acceptance criterion; every phase doc has all 14 sections.
11. **Build verification** — N/A.
12. **Acceptance criteria** — All files exist; mapping review passes; tracker shows Phase 00 COMPLETE with evidence.
13. **Completion checklist**
    - [x] Docs 00–14 created
    - [x] Phase docs 00–13 created
    - [x] Requirement mapping reviewed (see tracker evidence)
14. **Next phase dependency** — Phase 01 uses 02-ARCHITECTURE (folder structure) and 06-BACKEND (env vars).
