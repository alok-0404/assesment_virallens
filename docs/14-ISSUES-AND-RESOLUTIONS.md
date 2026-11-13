# 14 — Issues and Resolutions

Format per issue: ID · phase · symptom · reproduction · root cause · fix · affected modules · regression test · status.

| ID | Phase | Summary | Status |
|---|---|---|---|
| ISS-001 | 03 | Test command appeared to hang when its output was piped through PowerShell filters | RESOLVED (tooling) |
| ISS-002 | 09 | Logout looked successful in the UI but the session cookie survived (server returned 400) | RESOLVED |
| ISS-003 | 09 | Stale API process kept serving after a restart (only the parent shell was killed) | RESOLVED (tooling) |
| ISS-004 | 12 | Axios default timeout was 30 s instead of the specified 60 s (cold-start risk on Render) | RESOLVED |
| ISS-005 | post-13 | Local login returned 502 because the dev watcher restarted the API on a `node_modules` file change | RESOLVED (dev script) |

## ISS-001 · Phase 03 · Test run appears to hang under PowerShell pipelines
- **Symptom:** `npx vitest run 2>&1 | Select-String … | Select-Object -Last 60` never returned; no Vitest process was alive.
- **Reproduction:** Windows PowerShell 5, piping `npx.cmd` output into `Select-String`/`Select-Object`.
- **Root cause:** PowerShell pipeline buffering around the `npx.cmd` wrapper, not the application or tests (the same suite completes in ~4 s when run directly).
- **Fix:** Run `npx vitest run` (or `npm test`) without piping; use `--reporter=verbose` / `--reporter=dot` for readable output.
- **Affected modules:** none (developer tooling only).
- **Regression test:** full suite run directly → 52/52 passed.

## ISS-002 · Phase 09 · Logout did not end the server session
- **Symptom:** In the browser, clicking "Log out" redirected to `/login`, but `GET /api/auth/me` still returned the user and a page reload signed them straight back in. The API log showed no `POST /api/auth/logout` line; Vite logged an unhandled `AxiosError ... status code 400` from `AuthContext.logout`.
- **Reproduction:** Sign up → open the sidebar → Log out → `fetch('/api/auth/me')` → 200.
- **Root cause (three parts):**
  1. `authApi.logout()` called `http.post('/auth/logout', null)`. With the JSON `Content-Type`, Axios serialises `null` to the string `"null"`, which strict `express.json()` rejects → 400 `INVALID_JSON`; the cookie was never cleared.
  2. `AuthContext.logout` cleared local state in `finally`, so a failed server logout still looked like a successful one (HttpOnly cookie left valid — a security defect), and re-threw into an unhandled rejection.
  3. `requestLogger` was mounted after the body parser, so requests rejected by the parser were not logged, hiding the failure.
  Unit tests missed it because server tests send no body and client tests mock `authApi`.
- **Fix:** `authApi.logout` sends `{}`; `AuthContext.logout` clears local state only after the server confirms (or answers 401 = already signed out) and otherwise re-throws; `Sidebar` shows the error and re-enables the button; `requestLogger` moved to the top of the middleware chain (06-BACKEND §2 updated).
- **Affected modules:** `client/src/api/authApi.js`, `client/src/context/AuthContext.jsx`, `client/src/components/chat/Sidebar.jsx`, `server/src/app.js`.
- **Regression tests:** `client/src/api/authApi.test.js` (logout body is a JSON object that strict parsers accept); `ChatPage.test.jsx` "stays signed in and shows an error when logout fails on the server", "treats a 401 on logout as already signed out"; `server/tests/auth.test.js` "accepts the empty JSON object body", "rejects a literal JSON null body without ending the session"; `server/tests/app.test.js` "logs requests rejected by the JSON body parser". Server 125/125, client 58/58. Browser re-test: logout → `/me` 401, protected conversation 401; log line `POST /api/auth/logout 200`.

## ISS-003 · Phase 09 · Stale API process after restart (tooling)
- **Symptom:** After restarting the API to load a fix, the new process logged no requests while the browser kept working.
- **Root cause:** `Stop-Process` was applied to the PowerShell wrapper PID; its child `node src/server.js` kept running and kept serving port 5000 (Windows allowed the second listener to bind as well).
- **Fix:** Stop the `node.exe` process itself (`Get-CimInstance Win32_Process | Where-Object CommandLine -like '*src/server.js*'`) before restarting; verified only one API process remained and requests appeared in the new log.
- **Affected modules:** none (developer tooling only).

## ISS-004 · Phase 12 · HTTP client timeout deviated from the specification
- **Symptom:** Found while documenting Render cold starts: `client/src/api/http.js` used `timeout: 30000`, while 05-FRONTEND §API specifies `60000`.
- **Reproduction:** Code review against 05-FRONTEND; a free-tier Render instance can take ~30–60 s to wake, so the first `GET /api/auth/me` could time out and show the login page to a signed-in user.
- **Root cause:** Value typed during Phase 07 without re-checking the spec; no test pinned it.
- **Fix:** `timeout: 60000` (send keeps its 120 s per-request override, now documented in 05-FRONTEND).
- **Affected modules:** `client/src/api/http.js`.
- **Regression test:** `client/src/api/http.test.js` asserts `http.defaults.timeout === 60000`.

## ISS-005 · Post-delivery (local dev) · Login returned 502 during `npm run dev`
- **Symptom:** logging in on `http://localhost:5173` showed "Something went wrong"; browser console `POST /api/auth/login 502`.
- **Reproduction:** the owner's dev terminal showed `Change detected in '...server\node_modules\iconv-lite\encodings\dbcs-data.js'` → `Restarting 'src/server.js'` at the moment of the login; the Vite proxy returned 502 for the request cut off by the restart. Login against a fresh `node --watch` instance (port 5013) returned 200 twice, so the API code and credentials were not at fault.
- **Root cause:** `npm run dev` used `node --watch`, which watches every imported file including `node_modules`. Any write/timestamp change there (an `npm i`, antivirus scan, etc.) restarted the server and dropped in-flight requests.
- **Fix:** `server/package.json` → `"dev": "node --watch-path=src src/server.js"` (watch only application code).
- **Verification:** on port 5014: login 200 ×2; touching `node_modules/iconv-lite/encodings/dbcs-data.js` → 0 restarts; touching `src/app.js` → 1 restart and the API came back. Production (`npm start` / Render / Docker) never used `--watch` and is unaffected.
- **Regression test:** none automated (dev-only script); verification steps above.
- **Status:** RESOLVED.
