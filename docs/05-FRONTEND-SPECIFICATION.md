# 05 — Frontend Specification

React 19 + Vite, JavaScript, Tailwind CSS v4, React Router DOM, Axios, Context API. Markdown rendering via `react-markdown` + `remark-gfm`.

## 1. Routes
| Path | Component | Guard |
|---|---|---|
| `/` | redirect → `/chat` | – |
| `/login` | `LoginPage` | `PublicOnlyRoute` (logged-in → `/chat`) |
| `/signup` | `SignupPage` | `PublicOnlyRoute` |
| `/chat` | `ChatPage` (new conversation state) | `ProtectedRoute` |
| `/chat/:conversationId` | `ChatPage` (selected conversation; refresh restores it) | `ProtectedRoute` |
| `*` | `NotFoundPage` | – |

`ProtectedRoute`: while `AuthContext.status === "loading"` render full-screen spinner; if anonymous → `<Navigate to="/login" state={{ from }} replace/>`. After login the user returns to `from` (default `/chat`).

## 2. API layer (`src/api`)
- `http.js`: Axios instance `baseURL = import.meta.env.VITE_API_BASE_URL || "/api"`, `withCredentials: true`, `timeout: 60000`.
  - Request interceptor: for mutating methods, ensure a CSRF token (lazy `GET /auth/csrf-token`, cached in module memory, single shared promise) and set `X-CSRF-Token`.
  - Response interceptor: on 403 `CSRF_INVALID`, clear token, fetch a new one and retry the request **once**. On 401 from a non-auth endpoint, invoke the registered `onUnauthorized` handler (AuthContext sets user to null → redirect to login).
- `authApi.js`: `signup`, `login`, `logout`, `me`.
- `chatApi.js`: `sendMessage` (per-request timeout 120 s, matching Nginx `proxy_read_timeout`, because one send may include several AI attempts), `getHistory`, `getConversation`, `getMessages`, `deleteConversation`.
- `utils/errors.js`: `getErrorMessage(err)` maps `error.code` to friendly text (network error, timeout, AI errors, rate limit).

## 3. State
### AuthContext
`{ user, status: "loading"|"authenticated"|"anonymous", login(email,pw), signup(name,email,pw), logout() }`. On mount calls `me()`.
### ChatContext (provided inside ChatPage)
State: `conversations`, `historyStatus`, `historyMeta`, `activeConversationId` (from URL), `messages`, `messagesStatus`, `messagesError`, `hasMore`, `nextCursor`, `isSending`, `sendError`.
Actions: `loadHistory()`, `loadMoreHistory()`, `selectConversation(id)`, `loadOlderMessages()`, `sendMessage(text)`, `retryMessage(tempId)`, `deleteConversation(id)`, `startNewConversation()`.
Rules:
- Message loads use an `AbortController` + request sequence id; stale responses are ignored (rapid switching).
- `sendMessage` is ignored while `isSending` (duplicate prevention). Each send gets a `clientMessageId` (`crypto.randomUUID`-based); retry reuses it.
- Optimistic user message `{ id: tempId, role: "user", content, status: "sending" }`; on success replaced by server message + assistant appended; on failure `status: "failed"`, `error` text, Retry button.
- If the user switches conversation while a send is pending, the response updates the sidebar but does not inject messages into the other conversation.
- After the first send in a new conversation, URL is replaced with `/chat/:id` without refetching (messages already in state).
- Deleting the active conversation navigates to `/chat`.

## 4. Components
| Component | Responsibility |
|---|---|
| `AuthLayout` | Centered card, product name/logo, children |
| `FormField` | Label, input, error text (`aria-invalid`, `aria-describedby`) |
| `Sidebar` | New chat button, conversation list (loading skeleton / empty / error + retry), "Load more", user name/email, logout. On mobile: off-canvas drawer with backdrop, toggled from chat header |
| `ConversationItem` | Title, relative time, active highlight, delete icon button (`aria-label="Delete conversation <title>"`) |
| `ConfirmDialog` | Accessible modal (`role="dialog"`, `aria-modal`), Cancel/Delete, Escape closes |
| `ChatWindow` | Header (title, mobile menu button), `MessageList`, error banner, `ChatInput` |
| `MessageList` | Scrollable list, auto-scroll to bottom on new messages, "Load earlier messages", empty state with `SuggestedPrompts` |
| `MessageBubble` | User (right, brand color) vs assistant (left, neutral) bubbles; assistant uses `MarkdownContent`; copy button for assistant; failed state with Retry |
| `MarkdownContent` | `react-markdown` + GFM; links open in new tab with `rel="noopener noreferrer"`; code blocks in styled `<pre>` with language label and copy button; no raw HTML rendering |
| `ChatInput` | Auto-growing textarea, char counter (max 4000), Enter = send, Shift+Enter = newline, disabled while sending, send button with accessible name |
| `TypingIndicator` | Three animated dots + "Assistant is typing…" (sr-only text) |
| `SuggestedPrompts` | 4 customer-support starter prompts; click sends |
| `Spinner`, `ErrorBanner` | Shared feedback UI (`role="status"` / `role="alert"`) |

## 5. Validation (client-side, mirrors server)
- Email: basic RFC-like regex; required.
- Password (signup): 8–128, ≥1 letter, ≥1 digit; confirm password must match.
- Name: 2–60 chars.
Server remains authoritative; server `details` are mapped back to fields.

## 6. UX states
Loading (auth bootstrap spinner, history skeleton, messages spinner, typing indicator, button spinners), empty (no conversations; new conversation with suggested prompts), error (banner + retry for history/messages; failed message retry; auth form error alert), responsive (`md` breakpoint: sidebar static ≥768px, drawer below).

## 7. Environment
| Var | Default | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `/api` | API base (keep `/api` when proxied) |
| `VITE_PROXY_TARGET` | `http://localhost:5000` | Dev-server proxy target (vite.config only) |
