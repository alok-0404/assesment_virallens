# PHASE 11 — Docker

1. **Objective** — Containerise client and server; one-command startup with Compose.
2. **Requirements** — OPS-01, OPS-02, OPS-03, OPS-07, NFR-06.
3. **Prerequisites** — Phase 10 COMPLETE. Docker Engine + Compose v2 installed (**not installed on the development host → runtime verification BLOCKED**).
4. **Tasks** — `server/Dockerfile`, `server/.dockerignore`, `client/Dockerfile`, `client/.dockerignore`, `client/nginx.conf`, `docker-compose.yml` per 09-DOCKER §1–§2: multi-stage, prod deps only, non-root, health checks, env via `env_file`, internal network, graceful stop.
5. **Expected files** — listed above.
6. **Dependencies** — Docker, Atlas, OpenRouter credentials.
7. **API/UI** — app served on `http://localhost:8080`, API via `/api`.
8. **Edge cases** — server not healthy → client waits; Atlas IP not allow-listed → server unhealthy (logs explain); SIGTERM → graceful shutdown within 10 s.
9. **Security checks** — `.env` not copied into images; `USER` non-root; no dev deps in runtime image.
10. **Test cases** — `docker compose config` valid; `docker compose up --build` → both healthy; browser → Nginx → API → Atlas journey; `docker compose down` clean.
11. **Build verification** — `docker compose build`.
12. **Acceptance criteria** — `docker compose up --build` starts the complete application (BLOCKED until Docker + credentials available).
13. **Completion checklist** — [ ] Dockerfiles [ ] nginx [ ] compose [ ] runtime verified
14. **Next phase dependency** — Phase 12 documents the Docker commands.
