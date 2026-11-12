# 00 — Project Master Plan

## Project
**Minimal AI Customer Support Agent** — MERN application where authenticated users hold persistent, user-scoped conversations with an AI customer-support assistant powered by OpenRouter.

## How to use this documentation (read first, every session)
1. `00-PROJECT-MASTER-PLAN.md` (this file)
2. `01-ASSESSMENT-REQUIREMENTS.md` — requirement IDs (AUTH-xx, CHAT-xx, AI-xx, BE-xx, DB-xx, FE-xx, OPS-xx, NFR-xx)
3. `02-ARCHITECTURE.md` — locked stack, folder structure, request flows
4. `12-PROGRESS-TRACKER.md` — current phase status and evidence
5. `13-DECISION-LOG.md` — decisions that must not be silently reversed
6. Active phase document in `docs/phases/`
7. Then inspect actual source code and run tests. **Code + test output is the evidence; docs are reconciled to it.**

## Document index
| File | Purpose |
|---|---|
| 01-ASSESSMENT-REQUIREMENTS.md | Original brief + traceable requirement checklist |
| 02-ARCHITECTURE.md | Stack, topology, folder structure, flows |
| 03-DATABASE-DESIGN.md | Collections, fields, indexes, ownership rules |
| 04-API-SPECIFICATION.md | Every endpoint contract, error codes |
| 05-FRONTEND-SPECIFICATION.md | Routes, components, state, UX states |
| 06-BACKEND-SPECIFICATION.md | Modules, middleware order, env vars |
| 07-AI-INTEGRATION.md | OpenRouter workflow, prompt, retry/timeout, context |
| 08-SECURITY-REQUIREMENTS.md | Auth, cookies, CSRF, rate limits, secrets |
| 09-DOCKER-DEPLOYMENT.md | Dockerfiles, Nginx, Compose, Vercel, Render |
| 10-TESTING-STRATEGY.md | Test tooling, suites, commands |
| 11-PHASE-WISE-IMPLEMENTATION.md | Phase overview, ordering, gates |
| 12-PROGRESS-TRACKER.md | Live status with evidence |
| 13-DECISION-LOG.md | Architecture decision records |
| 14-ISSUES-AND-RESOLUTIONS.md | Bugs found, root cause, fix, regression test |
| phases/PHASE-XX-*.md | Detailed per-phase instructions & acceptance criteria |
| FINAL-ASSESSMENT-REPORT.md | Produced in Phase 13 |

## Locked technology stack
| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite, JavaScript (ESM) |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`) |
| Routing | React Router DOM |
| API client | Axios |
| State | React Context API (`AuthContext`, `ChatContext`) |
| Backend | Node.js (≥ 20, developed on 24) + Express 5 |
| Database | MongoDB Atlas + Mongoose |
| Auth | JWT (HS256) in HttpOnly cookie, bcrypt |
| AI | OpenRouter Chat Completions API (server-side `fetch`) |
| Validation | Zod |
| Security | Helmet, CORS, express-rate-limit, double-submit CSRF token |
| Testing | Vitest + Supertest + mongodb-memory-server (server); Vitest + Testing Library + jsdom (client) |
| Deployment | Vercel (client) + Render (server) |
| Containers | Docker multi-stage + Docker Compose, Nginx (unprivileged) for the client |

Changes require an entry in `13-DECISION-LOG.md` (see Rule 3 / Part 8 of the brief).

## Phases
| # | Phase | Doc |
|---|---|---|
| 00 | Documentation | phases/PHASE-00-DOCUMENTATION.md |
| 01 | Project setup | phases/PHASE-01-PROJECT-SETUP.md |
| 02 | Backend foundation | phases/PHASE-02-BACKEND-FOUNDATION.md |
| 03 | Authentication | phases/PHASE-03-AUTHENTICATION.md |
| 04 | Chat database | phases/PHASE-04-CHAT-DATABASE.md |
| 05 | AI integration | phases/PHASE-05-AI-INTEGRATION.md |
| 06 | Chat history APIs | phases/PHASE-06-CHAT-HISTORY.md |
| 07 | Frontend auth | phases/PHASE-07-FRONTEND-AUTH.md |
| 08 | Frontend chat | phases/PHASE-08-FRONTEND-CHAT.md |
| 09 | Integration | phases/PHASE-09-FRONTEND-INTEGRATION.md |
| 10 | Security & testing | phases/PHASE-10-SECURITY-AND-TESTING.md |
| 11 | Docker | phases/PHASE-11-DOCKER.md |
| 12 | Deployment & README | phases/PHASE-12-DEPLOYMENT-AND-README.md |
| 13 | Final verification | phases/PHASE-13-FINAL-VERIFICATION.md |

## Non-negotiable rules (condensed)
1. Documentation first; docs are the source of truth.
2. Architecture lock — no stack/folder changes without a decision-log entry.
3. Read docs + code before coding each phase; never rely on chat memory.
4. A phase is COMPLETE only when its acceptance criteria pass with recorded evidence.
5. No fake implementations: no mocked AI/DB in the running app, no hard-coded credentials or identities. Mocks only inside automated tests.
6. Credentials-dependent checks that cannot run are marked **BLOCKED** with reason; independent work continues.
7. Bugs follow the regression protocol and are logged in `14-ISSUES-AND-RESOLUTIONS.md`.

## Environment facts (recorded during Phase 00 inspection)
- Workspace `e:\assesment_Virallens` was empty at start.
- Host: Windows, Node v24.22.0, npm 11.19.1, git 2.56.
- **Docker is not installed** on the host → Docker runtime verification is BLOCKED until Docker is available.
- **No MongoDB Atlas URI and no OpenRouter API key** are available → live Atlas/OpenRouter checks are BLOCKED until credentials are supplied. Automated tests use `mongodb-memory-server` (a real `mongod` binary) and mocked HTTP for OpenRouter.
