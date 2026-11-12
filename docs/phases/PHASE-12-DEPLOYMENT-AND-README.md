# PHASE 12 — Documentation and Deployment

1. **Objective** — Complete README and deployment configuration for Vercel (client) and Render (server).
2. **Requirements** — OPS-05, OPS-06; success criteria 16–18.
3. **Prerequisites** — Phase 11 files exist.
4. **Tasks** — README sections: overview, features, architecture diagram, tech stack, project structure, prerequisites, MongoDB Atlas setup, OpenRouter setup, environment variables (server/client tables), local install & run, testing commands, Docker commands, API summary (link to docs/04), security notes, deployment (Render + Vercel step by step), troubleshooting, GitHub submission steps, known limitations. Create `render.yaml` and `client/vercel.json`.
5. **Expected files** — `README.md`, `render.yaml`, `client/vercel.json`.
6. **Dependencies** — none.
7. **API/UI** — n/a.
8. **Edge cases** — Render cold start (first request slow → client timeout 60 s); Vercel rewrite placeholder must be replaced.
9. **Security checks** — README never contains real secrets; instructs to generate `JWT_SECRET` with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
10. **Test cases** — follow README from a clean clone (install + tests + build); validate JSON/YAML syntax.
11. **Build verification** — client build + server tests after doc changes.
12. **Acceptance criteria** — README complete; configs valid; deployment status reported truthfully (BLOCKED / NOT VERIFIED without accounts).
13. **Completion checklist** — [x] README [x] render.yaml [x] vercel.json [x] verified syntax — actual deployment: BLOCKED (no Render/Vercel/Atlas/OpenRouter access).
14. **Next phase dependency** — Phase 13 audits everything.
