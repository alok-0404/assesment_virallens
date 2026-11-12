# 11 — Phase-wise Implementation

Phases run strictly in order. Each phase document in `docs/phases/` has: objective, requirements, prerequisites, tasks, expected files, dependencies, API/UI requirements, edge cases, security checks, test cases, build verification, acceptance criteria, completion checklist, hand-off to next phase.

## Phase gate procedure (every phase)
1. Read master plan, requirements, relevant specs, phase doc, tracker, decision log.
2. Inspect current code/tests; run existing tests to confirm baseline.
3. Implement tasks.
4. Run phase tests + full regression suite + build where applicable.
5. Fix failures (log bugs in `14-ISSUES-AND-RESOLUTIONS.md`).
6. Update `12-PROGRESS-TRACKER.md` with files, commands, results.
7. Mark COMPLETE only if all acceptance criteria pass; credential-dependent items → BLOCKED with reason.

## Overview & requirement mapping
| Phase | Key requirement IDs |
|---|---|
| 00 Documentation | all (mapping) |
| 01 Project setup | OPS-04, BE-10, NFR-08, NFR-10 |
| 02 Backend foundation | BE-10, BE-11, NFR-01..06 |
| 03 Authentication | AUTH-01..12, BE-01..04, DB-01 |
| 04 Chat database | DB-02..05, CHAT-02, CHAT-04, CHAT-05 |
| 05 AI integration | AI-01..09, BE-05, CHAT-03, CHAT-07, CHAT-08 |
| 06 History APIs | BE-06..09, CHAT-05, CHAT-06, CHAT-09, DB-04 |
| 07 Frontend auth | FE-01, FE-02, FE-10, AUTH-06, AUTH-07, AUTH-10 |
| 08 Frontend chat | FE-03..09, CHAT-01, CHAT-06, CHAT-08..10 |
| 09 Integration | CHAT-03, CHAT-07, FE-05, end-to-end journey |
| 10 Security & testing | AUTH-08/09/11/12, AI-08, NFR-02/03/07/08/10/11 |
| 11 Docker | OPS-01..03, OPS-07, NFR-06 |
| 12 Deployment & README | OPS-05, OPS-06, success criteria 16–18 |
| 13 Final verification | every ID → FINAL-ASSESSMENT-REPORT.md |

## Dependency chain
00 → 01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10 → 11 → 12 → 13.
Frontend phases (07, 08) depend only on the documented API contract and may use mocked API modules in tests; Phase 09 wires them to the real backend.
