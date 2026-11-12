# PHASE 07 — Frontend Authentication

1. **Objective** — Login/signup pages, AuthContext with session restoration, Axios with CSRF handling, protected routing, logout.
2. **Requirements** — FE-01, FE-02, FE-10, AUTH-06, AUTH-07, AUTH-10, FE-08.
3. **Prerequisites** — Phase 06 COMPLETE (API contract stable).
4. **Tasks** — `api/http.js`, `api/authApi.js`, `utils/errors.js`, `utils/validation.js`, `context/AuthContext.jsx`, `hooks/useAuth.js`, `components/auth/*`, `components/common/{ProtectedRoute,PublicOnlyRoute,Spinner,ErrorBanner}.jsx`, `pages/{LoginPage,SignupPage,NotFoundPage}.jsx`, router in `App.jsx`.
5. **Expected files** — above + tests (`validation.test.js`, `LoginPage.test.jsx`, `SignupPage.test.jsx`, `ProtectedRoute.test.jsx`), `src/test/setup.js`.
6. **Dependencies** — axios, react-router-dom.
7. **UI** — 05-FRONTEND §1–§6. Forms: labelled fields, inline errors, submit spinner, server error alert, link between login/signup, password visibility not required.
8. **Edge cases** — double submit (button disabled); server 409 email in use → field error; 429 message; network down message; `/me` 401 → anonymous (no error shown); redirect back to originally requested page.
9. **Security checks** — no token storage in JS; `withCredentials`; CSRF header on mutating requests.
10. **Test cases** — signup UI; login UI; invalid credentials message; page refresh (AuthContext calls `/me` and restores); protected routing redirect; logout redirection.
11. **Build verification** — `npm test` + `npm run build` in client.
12. **Acceptance criteria** — §10 pass + build OK.
13. **Completion checklist** — [ ] http/csrf [ ] context [ ] pages [ ] guards [ ] tests [ ] build
14. **Next phase dependency** — Phase 08 builds `ChatPage` inside `ProtectedRoute`.
