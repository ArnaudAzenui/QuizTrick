# QuizTrick — API Contract (WBS 1.3.2.2)

All routes live under `/api`, accept and return JSON, and require the Supabase session cookie unless marked *public*. Every response uses one envelope:

```json
{ "ok": true,  "data": … }
{ "ok": false, "error": { "code": "VALIDATION", "message": "Plain-language message.", "fields": { "email": "…" } } }
```

Error codes → HTTP status: `VALIDATION` 400 · `UNAUTHENTICATED` 401 · `FORBIDDEN` 403 · `NOT_FOUND` 404 · `CONFLICT` 409 · `RATE_LIMITED` 429 · `AI_BAD_OUTPUT` 502 · `AI_UNAVAILABLE` 503 · `INTERNAL` 500. Messages are safe to show to users verbatim (NFR-U2).

Every path under `/api` returns this envelope, including unknown ones (`NOT_FOUND`, 404) — never an HTML error page. On a `VALIDATION` error, `error.message` always repeats `error.fields`' first entry, so a banner and an inline field message can't disagree.

The same rules are enforced again in the database (`supabase/migrations/0002`), because the browser holds the anon key and can write to its own rows without going through these routes.

## Auth (public)

| Method & path | Body | Returns | Req. |
|---|---|---|---|
| `POST /api/auth/register` | `{ email, password, displayName? }` | `{ userId, needsEmailConfirmation }` (201) | FR-1.1, FR-1.2 |
| `POST /api/auth/login` | `{ email, password }` | `{ userId, email }` + sets session cookie | FR-1.3 |
| `POST /api/auth/logout` | — | `{ loggedOut: true }` | FR-1.3, SEC-8 |
| `POST /api/auth/reset-password` | `{ email }` | `{ sent: true }` (always) | FR-1.7 |
| `POST /api/auth/update-password` | `{ password }` (8–72) | `{ updated: true }` | FR-1.7 |

`register` answers `CONFLICT` (409) for an address that already has an account. Supabase reports a duplicate two different ways depending on whether email confirmation is enabled — an explicit error, or a success carrying an obfuscated user — and both are mapped to the same 409, so the answer does not change when that setting does.

`update-password` is not public: it is authenticated by the session that `GET /auth/callback` establishes from the emailed link, and takes no current password because following the link already proved control of the mailbox. `reset-password` stays silent about whether an address is registered, so it can't be used to enumerate accounts — unlike `register`, where a clear message was judged worth the trade.

`GET /auth/callback` is a page route, not an API one: it accepts either `?code=` (PKCE) or `?token_hash=&type=`, sets the session cookie and redirects to `?next=` — rejecting any `next` that is not a same-origin path. A dead link lands on `/login?error=link_expired|link_invalid` rather than a blank page.

## Profile

| Method & path | Body | Returns | Req. |
|---|---|---|---|
| `GET /api/profile` | — | `UserProfile` | FR-1.6 |
| `PATCH /api/profile` | `{ displayName }` (1–60) | `UserProfile` | FR-1.6 |

Only `displayName` is writable. Changing an email or password is a Supabase auth operation, not a profile update.

## Study texts

| Method & path | Body | Returns | Req. |
|---|---|---|---|
| `GET /api/texts` | — | `StudyTextSummary[]` (newest first, with `quizCount`) | FR-2.6 |
| `POST /api/texts` | `{ title?, body }` — body 200–20,000 **characters** after cleaning, counted by code point (an emoji is 1, as in Postgres) | `StudyText` (201) | FR-2.4–2.7 |
| `GET /api/texts/:id` | — | `StudyText` | |
| `GET /api/texts/:id/quizzes` | — | `Quiz[]` newest first | FR-3.7 |
| `DELETE /api/texts/:id` | — | `{ deleted: true }` (cascades to its quizzes, questions and attempts — score history included) | SEC-10 |

There is no edit endpoint: a saved text is immutable, because quizzes generated from it would otherwise stop matching the material they were written from. Deleting a text deletes that material's score history with it — worth a confirmation step in the UI.

## Quiz generation

| Method & path | Body | Returns | Req. |
|---|---|---|---|
| `POST /api/generate` | `{ textId, questionCount?: 5 \| 10 \| 15 }` (default 10; a digits-only string is accepted, for `<select>` values) | `Quiz` (201) | FR-3.1–3.9, SEC-6, SEC-7 |

Failure modes: `RATE_LIMITED` after 20/hour; `AI_UNAVAILABLE` on network/timeout (30 s); `AI_BAD_OUTPUT` when the model's reply fails schema validation after retries. No partial quiz is ever stored.

## Taking & results

| Method & path | Body | Returns | Req. |
|---|---|---|---|
| `GET /api/quizzes/:id` | — | `QuizForTaking` — `questions[]` **without** `correctOption` / `expectedAnswer` | FR-4.1 |
| `DELETE /api/quizzes/:id` | — | `{ deleted: true }` | SEC-10 |
| `POST /api/quizzes/:id/attempts` | `{ startedAt?, answers: [{ questionId, response }] }` — MCQ response is the option index as a string (`"0"`–`"3"`); short answer ≤ 200 chars; each `questionId` at most once (case-insensitive). Unanswered questions are graded as incorrect. A `startedAt` in the future is ignored rather than rejected, so a wrong device clock can't cost a student their attempt. | `Attempt` (201) with `score` 0–100 | FR-4.3–4.5, NFR-R3 |
| `GET /api/attempts/:id` | — | `AttemptReview` — includes correct answers and per-question `isCorrect` | FR-4.6 |
| `GET /api/history` | — | `HistoryEntry[]` newest first, `isBest` flag | FR-5.2, FR-5.4 |

## Tasks

| Method & path | Body | Returns | Req. |
|---|---|---|---|
| `GET /api/tasks?scope=today\|all` | — | `StudyTask[]` (today = created today OR still incomplete) | FR-6.3 |
| `POST /api/tasks` | `{ subject (1–100), description?: string \| null (≤500), estimatedMinutes (1–600, whole number) }` | `StudyTask` (201) | FR-6.1, FR-6.2 |
| `PATCH /api/tasks/:id` | any of `{ subject, description, estimatedMinutes, isComplete }` — omitted fields are left alone; `description: null` clears it | `StudyTask` | FR-6.4 |
| `DELETE /api/tasks/:id` | — | `{ deleted: true }` | FR-6.5 |

## Timer sessions

| Method & path | Body | Returns | Req. |
|---|---|---|---|
| `GET /api/sessions` | — | `StudySession[]` (last 20) | |
| `POST /api/sessions` | `{ taskId?, startTime, endTime }` (ISO timestamps, `Z` or an offset; `endTime` ≥ `startTime`, span ≤ 24 h, neither more than 5 min ahead of the server). `durationSeconds` is derived server-side from the timestamps — a client-sent value is ignored. `taskId` must be one of your own tasks. | `StudySession` (201) | FR-7.4 |

## Preferences

| Method & path | Body | Returns | Req. |
|---|---|---|---|
| `GET /api/preferences` | — | `Preference` | FR-8.3 |
| `PUT /api/preferences` | `{ theme: "light" \| "dark" }` | `Preference` | FR-8.3 |

Type definitions for every payload: `src/shared/types.ts`.
