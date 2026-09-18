# QuizTrick — API Contract (WBS 1.3.2.2)

All routes live under `/api`, accept and return JSON, and require the Supabase session cookie unless marked *public*. Every response uses one envelope:

```json
{ "ok": true,  "data": … }
{ "ok": false, "error": { "code": "VALIDATION", "message": "Plain-language message.", "fields": { "email": "…" } } }
```

Error codes → HTTP status: `VALIDATION` 400 · `UNAUTHENTICATED` 401 · `FORBIDDEN` 403 · `NOT_FOUND` 404 · `CONFLICT` 409 · `RATE_LIMITED` 429 · `AI_BAD_OUTPUT` 502 · `AI_UNAVAILABLE` 503 · `INTERNAL` 500. Messages are safe to show to users verbatim (NFR-U2).

## Auth (public)

| Method & path | Body | Returns | Req. |
|---|---|---|---|
| `POST /api/auth/register` | `{ email, password, displayName? }` | `{ userId, needsEmailConfirmation }` (201) | FR-1.1, FR-1.2 |
| `POST /api/auth/login` | `{ email, password }` | `{ userId, email }` + sets session cookie | FR-1.3 |
| `POST /api/auth/logout` | — | `{ loggedOut: true }` | FR-1.3, SEC-8 |
| `POST /api/auth/reset-password` | `{ email }` | `{ sent: true }` (always) | FR-1.7 |

## Profile

| Method & path | Body | Returns | Req. |
|---|---|---|---|
| `GET /api/profile` | — | `UserProfile` | FR-1.6 |
| `PATCH /api/profile` | `{ displayName }` (1–60) | `UserProfile` | FR-1.6 |

## Study texts

| Method & path | Body | Returns | Req. |
|---|---|---|---|
| `GET /api/texts` | — | `StudyTextSummary[]` (newest first, with `quizCount`) | FR-2.6 |
| `POST /api/texts` | `{ title?, body }` — body 200–20,000 chars after cleaning | `StudyText` (201) | FR-2.4–2.7 |
| `GET /api/texts/:id` | — | `StudyText` | |
| `DELETE /api/texts/:id` | — | `{ deleted: true }` (cascades to quizzes/attempts) | SEC-10 |
| `GET /api/texts/:id/quizzes` | — | `Quiz[]` newest first | FR-3.7 |

## Quiz generation

| Method & path | Body | Returns | Req. |
|---|---|---|---|
| `POST /api/generate` | `{ textId, questionCount?: 5 \| 10 \| 15 }` (default 10) | `Quiz` (201) | FR-3.1–3.9, SEC-6, SEC-7 |

Failure modes: `RATE_LIMITED` after 20/hour; `AI_UNAVAILABLE` on network/timeout (30 s); `AI_BAD_OUTPUT` when the model's reply fails schema validation after retries. No partial quiz is ever stored.

## Taking & results

| Method & path | Body | Returns | Req. |
|---|---|---|---|
| `GET /api/quizzes/:id` | — | `QuizForTaking` — `questions[]` **without** `correctOption` / `expectedAnswer` | FR-4.1 |
| `DELETE /api/quizzes/:id` | — | `{ deleted: true }` | SEC-10 |
| `POST /api/quizzes/:id/attempts` | `{ startedAt?, answers: [{ questionId, response }] }` — MCQ response is the option index as a string (`"0"`–`"3"`); short answer ≤ 200 chars; each `questionId` at most once. Unanswered questions are graded as incorrect. | `Attempt` (201) with `score` 0–100 | FR-4.3–4.5, NFR-R3 |
| `GET /api/attempts/:id` | — | `AttemptReview` — includes correct answers and per-question `isCorrect` | FR-4.6 |
| `GET /api/history` | — | `HistoryEntry[]` newest first, `isBest` flag | FR-5.2, FR-5.4 |

## Tasks

| Method & path | Body | Returns | Req. |
|---|---|---|---|
| `GET /api/tasks?scope=today\|all` | — | `StudyTask[]` (today = created today OR still incomplete) | FR-6.3 |
| `POST /api/tasks` | `{ subject (1–100), description? (≤500), estimatedMinutes (1–600) }` | `StudyTask` (201) | FR-6.1, FR-6.2 |
| `PATCH /api/tasks/:id` | any of `{ subject, description, estimatedMinutes, isComplete }` | `StudyTask` | FR-6.4 |
| `DELETE /api/tasks/:id` | — | `{ deleted: true }` | FR-6.5 |

## Timer sessions

| Method & path | Body | Returns | Req. |
|---|---|---|---|
| `GET /api/sessions` | — | `StudySession[]` (last 20) | |
| `POST /api/sessions` | `{ taskId?, startTime, endTime }` (ISO timestamps; `endTime` ≥ `startTime`, span ≤ 24 h). `durationSeconds` is derived server-side from the timestamps — a client-sent value is ignored. | `StudySession` (201) | FR-7.4 |

## Preferences

| Method & path | Body | Returns | Req. |
|---|---|---|---|
| `GET /api/preferences` | — | `Preference` | FR-8.3 |
| `PUT /api/preferences` | `{ theme: "light" \| "dark" }` | `Preference` | FR-8.3 |

Type definitions for every payload: `src/shared/types.ts`.
