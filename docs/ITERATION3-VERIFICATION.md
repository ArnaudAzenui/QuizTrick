# Iteration 3 — live setup, timings and security verification

Filled in by: Arnaud · Date: ____________ · Production URL: ____________________

Each row has what to do, what should happen, and a blank to record what did happen. Tick the box only when the recorded result matches the expected one. Keep this file in `docs/` once filled; the numbers feed the Iteration-3 demo, WPR2 and the final report.

## Part A — Live setup (WBS 1.3.4.2 – 1.3.4.4)

| # | Do | Expected | Result | OK |
|---|---|---|---|---|
| A1 | Supabase → SQL Editor → run `select policyname from pg_policies where tablename = 'preferences';` | Three rows: `preferences_select_own`, `preferences_insert_own`, `preferences_update_own`. No `preferences_all_own`. (Proves 0002 ran after 0001.) | | ☐ |
| A2 | Same editor: `select tgname from pg_trigger where tgname = 'study_sessions_validate';` | One row. | | ☐ |
| A3 | Supabase → Authentication → URL Configuration | Site URL is the Vercel production URL; Redirect URLs include it and `/auth/callback`. | | ☐ |
| A4 | Supabase → Authentication → Providers → Email | Enabled. "Confirm email" ON (re-enable if it was off for testing). | | ☐ |
| A5 | Vercel → Project → Settings → Environment Variables (Production) | All six present: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `AI_API_KEY`, `AI_MODEL`, `NEXT_PUBLIC_APP_URL`. `AI_BASE_URL` too if using Gemini. | | ☐ |
| A6 | Vercel → Deployments | Latest production deployment is from `main` at the retire-starter-frame merge or later, status Ready. | | ☐ |

## Part B — Timings (WBS 1.6.3.3, SOW §8.2)

Use Chrome, a normal home or campus connection, logged in. Open DevTools → Network, tick "Disable cache". Do each measurement three times and record all three; the SOW number is the ceiling each one must stay under.

| # | Do | Ceiling | Run 1 | Run 2 | Run 3 | OK |
|---|---|---|---|---|---|---|
| B1 | Load `/dashboard` cold. Read "Load" at the bottom of the Network panel. | 2.0 s | | | | ☐ |
| B2 | Load `/texts/<id>` for a saved text. | 2.0 s | | | | ☐ |
| B3 | Load `/history` with at least 5 attempts. | 2.0 s | | | | ☐ |
| B4 | On a text of about 2,000 characters, click Generate quiz (10 questions). Time from click to the quiz list updating. Use the `POST /api/generate` row's Time column. | 30 s | | | | ☐ |
| B5 | Same, on a text near the 20,000-character limit. | 30 s | | | | ☐ |

Connection used (Wi-Fi name or "campus"): ____________ · Browser version: ____________

## Part C — Security verification (WBS 1.7.1.5)

Use two accounts: **A** (your normal one) and **B** (a fresh account). Do everything while logged in as B unless stated. Where a row says "open the URL directly", paste it into the address bar.

### C1 Protected routes redirect (FR-1.4, SEC-4)

| # | Do | Expected | Result | OK |
|---|---|---|---|---|
| C1.1 | Log out. Open each of `/dashboard`, `/texts`, `/quizzes/x`, `/history`, `/tasks`, `/timer`, `/profile` directly. | Each redirects to `/login`. | | ☐ |
| C1.2 | Logged out, call `GET /api/profile` from DevTools console: `fetch('/api/profile').then(r => r.status)` | `401`. | | ☐ |

### C2 Users only see their own data (SEC-4, RLS)

As A, note one of each: a text id, a quiz id, an attempt id, a task id. Then as B:

| # | Do | Expected | Result | OK |
|---|---|---|---|---|
| C2.1 | Open `/texts/<A's text id>` | "could not be found" style message, not A's text. | | ☐ |
| C2.2 | Open `/quizzes/<A's quiz id>` | Not found. | | ☐ |
| C2.3 | Console: `fetch('/api/attempts/<A's attempt id>').then(r => r.status)` | `404`. | | ☐ |
| C2.4 | Console: `fetch('/api/tasks/<A's task id>', {method:'DELETE'}).then(r => r.status)` | `404`. As A afterwards, the task still exists. | | ☐ |
| C2.5 | Console: `fetch('/api/quizzes/<A's quiz id>', {method:'DELETE'}).then(r => r.status)` | `404`. As A afterwards, the quiz still exists. | | ☐ |
| C2.6 | `/history` as B | Only B's attempts. | | ☐ |

### C3 Input validation (SEC-5)

| # | Do | Expected | Result | OK |
|---|---|---|---|---|
| C3.1 | New text: paste 100 characters, Save. | Rejected, message about the 200-character minimum. | | ☐ |
| C3.2 | Upload a `.txt` over 100 KB. | Rejected before upload. | | ☐ |
| C3.3 | Console: `fetch('/api/sessions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({startTime:'2026-01-01T10:00:00Z',endTime:'2026-01-01T09:00:00Z'})}).then(r=>r.status)` | `400`. | | ☐ |
| C3.4 | Console: `fetch('/api/preferences',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({theme:'blue'})}).then(r=>r.status)` | `400`. | | ☐ |
| C3.5 | Take a quiz; in the console before submitting, edit nothing, just confirm the page never requested answer keys: Network → `GET /api/quizzes/<id>` → Response has no `correctOption` or `expectedAnswer`. | Absent. | | ☐ |

### C4 Secrets never reach the browser (SEC-3)

| # | Do | Expected | Result | OK |
|---|---|---|---|---|
| C4.1 | View page source on `/dashboard`, search for `service_role`, `SUPABASE_SERVICE_ROLE_KEY`, `AI_API_KEY`, `sk-`, `AIza`. | No matches. | | ☐ |
| C4.2 | Network → any `/_next/static/chunks/*.js` → search the same strings. | No matches. The anon key and Supabase URL are expected and fine. | | ☐ |
| C4.3 | Response headers on `/dashboard` | `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` all present. | | ☐ |
| C4.4 | Application → Cookies | Supabase auth cookies are `HttpOnly` and `Secure`. | | ☐ |

### C5 API abuse protection (SEC-6)

| # | Do | Expected | Result | OK |
|---|---|---|---|---|
| C5.1 | On one text, generate 20 quizzes within an hour (use 5 questions each to keep it quick), then try a 21st. | 21st returns a rate-limit message; Network shows `429`. | | ☐ |
| C5.2 | Console: `fetch('/api/nonsense').then(r => r.status)` | `404` in the JSON envelope, no stack trace. | | ☐ |
| C5.3 | Console: `fetch('/api/texts',{method:'POST',body:'{nope'}).then(r => r.status)` | `400`, no stack trace in the body. | | ☐ |

## Findings

Anything that did not match. One line each: row id, what happened, who fixes it.

- 
- 

## Sign-off

All rows ticked, or every unticked row has a finding above and a GitHub issue. Date: ____________
