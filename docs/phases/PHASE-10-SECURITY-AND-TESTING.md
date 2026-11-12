# PHASE 10 — Security and Complete Testing

1. **Objective** — Audit every endpoint and control against 08-SECURITY; complete automated test coverage; full builds.
2. **Requirements** — AUTH-08, AUTH-09, AUTH-11, AUTH-12, AI-08, NFR-02, NFR-03, NFR-07, NFR-08, NFR-10, NFR-11.
3. **Prerequisites** — Phase 09 COMPLETE (or COMPLETE with BLOCKED credential items).
4. **Tasks** — endpoint audit table (auth, CSRF, validation, ownership, rate limit); add `tests/security.test.js`; check cookie flags in production config; scan repo + client bundle for secrets; `npm audit --omit=dev` both packages; fix findings.
5. **Expected files** — `server/tests/security.test.js`; audit results in tracker / final report.
6. **Dependencies** — all prior phases.
7. **API/UI** — n/a.
8. **Edge cases** — NoSQL operators in body/query; huge payload; alg-none JWT; cross-user ids.
9. **Security checks** — the 08-SECURITY §12 checklist.
10. **Test cases** — full server suite; full client suite; security suite.
11. **Build verification** — `client npm run build`; `server node --check` of all files via starting the app in test.
12. **Acceptance criteria** — all tests green; checklist all ticked; no high/critical prod vulnerabilities (or documented).
13. **Completion checklist** — [ ] audit [ ] security tests [ ] all suites [ ] build [ ] npm audit
14. **Next phase dependency** — Phase 11 containerises the verified app.
