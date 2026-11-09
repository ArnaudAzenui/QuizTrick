# QuizTrick — Progress and remaining work

Snapshot taken 2026-10-29 (Week 11 of the CSC-4900 calendar; Iteration 3 runs Weeks 11–12, Iteration-3 demo is due Week 12, Nov 2).
Twenty PRs merged, last on Oct 20. `npm run check` is green on `main`: lint, typecheck, 338 unit tests in 27 files, production build.

## Status update — Nov 2, 2026 (Iteration-3 demo day)

Merged since the Oct 29 snapshot (PRs 21–28), all deployed to production:

- Isaiah: sessions API (#21), preferences API (#22). Timer saves now work.
- Arnaud: delete quiz API (#23), starter-frame cleanup (#24). No 501 routes remain.
- Hillary: theme synced to account, dashboard summary cards, landing page + signed-in redirect, contrast fixes, flag-for-review, plus an unplanned custom question mix with true/false questions and migration 0003 (#25). 0003 is applied on production.
- Fardin: delete-quiz button (#26), feedback-state cleanup (#27), A/B/C/D shortcuts + progress bar (#28).

Section 2 (MVP gaps) is closed. From section 8, still open: Isaiah I-3/I-4, Arnaud A-3/A-4/A-5 (verification checklist in docs/ITERATION3-VERIFICATION.md, demo, WPR2), Hillary H-2 audit report/H-3/H-6, Fardin F-5 (external testers). Scope note for the final report: true/false questions and the custom mix were added beyond the SOW.

## Status update — Nov 7, 2026 (Canvas extension decided)

Dr Mohan asked whether QuizTrick could pull study text out of Canvas. The team decided on a small Chrome/Edge extension, loaded unpacked: the student clicks the QuizTrick icon on a Canvas page and the page text (or whatever they highlighted) opens in Add study text, ready to review, save and quiz on. No Canvas admin approval, no API or database change on our side. The Canvas API was ruled out because it needs a developer key from the school's Canvas admin.

**Scope.** Canvas pages, assignment descriptions, the syllabus, and highlighted text on any page. Chrome and Edge. **Not doing:** PDFs, slides, Firefox/Safari, Web Store publishing, auto-save.

**Done:** A-6, the `extension/` skeleton (manifest, config, handoff, delivery script, stub popup, README, 16 unit tests), merged Nov 6 as #29. The contract every other piece codes against is in `extension/config.js` and `extension/README.md`.

| # | Who | Work | Branch | Due | Done when |
|---|---|---|---|---|---|
| A-6 | Arnaud | Extension skeleton: manifest, `config.js`, `lib/handoff.js`, `content/deliver.js`, stub popup, README | `feat/ext-skeleton` | Sat Nov 7 | Merged (#29) |
| I-5 | Isaiah | `extension/lib/extract.js`: `extractFromPage()` reads the Canvas page (selection, then page, assignment, syllabus, `#content`); unit tests on saved Canvas pages in `tests/fixtures/canvas/` with jsdom | `feat/ext-extract` | Wed Nov 11 | Returns `{ kind, title, body, sourceUrl }` for each fixture; one self-contained function |
| H-7 | Hillary | Popup: preview, character count, Send to QuizTrick, light and dark; states ready / too short / too long / can't read this page | `feat/ext-popup` | Wed Nov 11 | Send disabled under 200 chars, warning over 20,000, calls `sendToQuizTrick()` |
| F-6 | Fardin | `StudyTextEditor.tsx` receives the import when the URL has `?from=extension`; message checks as pure functions in `extension-import.ts` with unit tests; one extension task in the external tester sessions | `feat/ext-import-editor` | Wed Nov 11 | Title and text appear, "Imported from Canvas" note shows, typed text is never overwritten |
| A-7 | Arnaud | Integration of the three pieces, a full run on a real Canvas page, demo script | `docs/ext-integration` | Fri Nov 13 | Every row in `docs/EXTENSION-INTEGRATION.md` ticked |

Dependencies: H-7 needed A-6 (merged, so Hillary is unblocked). I-5 and F-6 depend on nothing. A-7 waits on all three. The checklist, the run record and the demo script live in `docs/EXTENSION-INTEGRATION.md`.

## Status update — Nov 9, 2026 (PR #31 reviewed, demo tomorrow)

Hillary opened PR #31 (`feat/quiz-practice-document-uploads`): Word/PDF/PowerPoint uploads parsed server-side with officeparser, a quiz setup screen with a practice mode (server-checked answers and hints via `POST /api/quizzes/:id/check`), best-score badges grouped by study text instead of by quiz, a redirect to Add study text after saving a task, and content-quality checks before generation. 33 files; typecheck, lint, 442 tests and the build pass; the Vercel preview deploys and both new routes answer correctly.

Reviewed by Arnaud. Verdict: everything in it runs on the current setup. No new infrastructure, no migration, fits Vercel's body and function limits, Supabase and Gemini handle the extra load. The cost is team hours in weeks 13–15: each feature needs acceptance-test rows, a security row, a user-manual section and a cross-browser pass.

Decision:
- Demo on Nov 10 comes first. Main stays as it is until the Canvas extension has been presented. The PR stays open; no rework from Hillary for now.
- After the demo, PR #31 merges with two conditions: a per-user rate limit on `POST /api/texts/extract` (a 4 MB file can take 20 s of server time per call, and the route has no cap), and both new routes documented in `docs/API.md`, noting that the check endpoint reveals right/wrong before submission. Team decision pending: whether attempts record practice vs standard mode so history can tell them apart (would need a small migration).
- Scope note for the final report: these features are beyond the SOW, same as true/false questions and the custom mix.
- Conflict to expect: the PR rewrites the file-note area of `StudyTextEditor.tsx`, where F-6 adds the "Imported from Canvas" note. Whichever lands second rebases.

Extension status: skeleton (A-6, #29) and the A-7 checklist (#30) are on main. I-5, H-7 and F-6 have no branches yet. Without F-6 the editor does not receive the text, so an end-to-end demo on Nov 10 depends on it landing first.

## 1. What is done (per WBS)

| WBS | Element | State |
|---|---|---|
| 1.3.4 | Dev environment: Next.js scaffold, Supabase schema (2 migrations, ~80 schema tests), CI on PRs | Done |
| 1.4.1 | Auth: register, login, logout, forgot/update password, callback, middleware, protected routes, profile page + `/api/profile` | Done |
| 1.4.2 | Text input: paste + .txt upload, validation, save/list/view/delete texts | Done |
| 1.4.3 | Quiz generation: prompt, AI provider, parser, `/api/generate`, regenerate + error handling, unit tests | Done |
| 1.4.4 | Quiz taking: QuizRunner, server-side grading, `submitAttempt`, results screen with per-question review | Done |
| 1.5.1 | Study tasks: tasks table, CRUD API, form, today's list, complete/delete, tests | Done |
| 1.5.2 | Study timer: stopwatch + countdown, survives navigation (TimerProvider + header indicator), link to a task | UI done — saving is broken, see 2.1 |
| 1.6.1 | Score tracking: `/api/history`, History page with expandable attempts and incorrect-answer review | Done |
| 1.6.2 | Theme: tokens, toggle in header, pre-paint script, localStorage persistence | Done except server-side preference, see 2.2 |

## 2. MVP gaps — must be closed for the Iteration-3 demo

These are the only places where the app still returns `501 Not implemented` or where a WBS work package has no code.

### 2.1 Study sessions API (WBS 1.5.2.3, FR-7.4) — **blocking**
- `src/backend/services/session.service.ts` is an empty stub (`listSessions`, `saveSession`).
- `src/app/api/sessions/route.ts` returns 501 for GET and POST.
- The timer already calls `POST /api/sessions` when a session ends, so today every timer run ends with a save error. The SOW acceptance test "the study timer starts and stops correctly and tracks elapsed study time" fails until this lands.
- Schema (`study_sessions` table, duration trigger) and the zod schema already exist. Owner: backend.

### 2.2 Theme preference API (WBS 1.6.2.3, FR-8.3)
- `src/backend/services/preference.service.ts` is an empty stub (`getPreference`, `setTheme`).
- `src/app/api/preferences/route.ts` returns 501 for GET and PUT.
- The toggle persists in localStorage, so the SOW criterion "preference persists across sessions" holds on one browser. The API contract (docs/API.md) still calls for the server-side preference so it follows the account. Wire the toggle to PUT and read the preference after login. Owner: backend + Hillary.

### 2.3 Delete quiz (SEC-10)
- `DELETE /api/quizzes/:id` returns 501; `deleteQuiz` is listed in `quiz.service.ts` but not written. Add the service function, the route, and a delete control on the text detail page. Owner: backend + frontend.

### 2.4 Cleanup once 2.1–2.3 land
- Delete `src/backend/lib/not-implemented.ts` (no route will use it).
- Delete `src/frontend/components/Placeholder.tsx` and `tests/unit/placeholder.test.tsx` (no page uses it).
- Rewrite `README.md` "What this repo is right now" and `src/frontend/components/README.md` — both still describe the starter frame.

## 3. Iteration 3 work packages not started (WBS 1.6.2.4, 1.6.3)

- **1.6.2.4 WCAG AA contrast audit** across every screen in both themes, with a written contrast report (tokens are pre-checked, screens are not).
- **1.6.3.1 Responsive layout pass** at common desktop/laptop sizes, every screen.
- **1.6.3.2 Loading, empty and error states** — review every async action; dashboard still shows no task/timer/history summaries (page comment says they come "as those features land").
- **1.6.3.3 Performance measurement** — record page load (< 2 s) and quiz generation (< 30 s) timings against the deployed site. `/api/generate` already sets `maxDuration = 60`.
- **Public landing page** (`src/app/page.tsx`) still carries the TODO for the Figma design pass and for redirecting signed-in users to the dashboard.
- **1.6.4** Integrate, regression-test, deploy and demo Iteration 3 (with WPR2).

## 4. Not verifiable from the repo — someone confirm

- Supabase project has both migrations applied (`supabase/README.md`).
- Vercel project is connected to the repo, env vars set (`AI_API_KEY`, Supabase keys, `NEXT_PUBLIC_APP_URL`), Supabase redirect URLs include the Vercel URL (docs/SETUP.md §3).
- Iteration-2 demo (Week 10, Oct 19) and WPR1 were delivered.
- Implementation plan (1.1.3.4), ethics quiz (1.1.4.1), individual midterm reports (1.1.3.3) submitted.

## 5. System testing and release (WBS 1.7, Weeks 13–15)

Nothing here has started. Acceptance test cases (1.2.2) must exist first.
- 1.7.1.1 End-to-end integration test report
- 1.7.1.2 Execute every acceptance test case, record pass/fail
- 1.7.1.3 Load test, 20 concurrent users
- 1.7.1.4 Cross-browser matrix (Chrome, Firefox, Safari, Edge)
- 1.7.1.5 Security verification: protected routes, cross-user isolation, validation, secrets, abuse protection (rate limit on `/api/generate` exists; verify the rest)
- 1.7.2 Recruit 2+ external student testers, run sessions, write findings
- 1.7.3 Fix defects, final regression, tag release, final deploy

## 6. Documentation and closeout (WBS 1.8, Weeks 13–16)

- 1.8.1 User manual with screenshots (getting started, each feature, FAQ)
- 1.8.2 Final group report, final slides (TG week Nov 25–27), final demo, upload program + minutes + reports to GitHub by Dec 4, 5:00 pm
- 1.8.3 Individual final report + slides (Dec 7), individual presentation (Dec 10, 10:45 AM)
- Weekly meeting minutes (1.1.3.1) — not in this repo; confirm where they live and that they are up to date.

## 7. Fardin's suggestions (Google Chat, Oct 28) — triage

Not in the SOW scope. None should be picked up before section 2 is closed. Sized against the current code:

| Idea | Size | Notes |
|---|---|---|
| Progress bar at the top of the quiz | Small | QuizRunner already computes `answered` / `total` and shows the text; add a visual bar bound to the same numbers. |
| Flag a question to come back to | Small | Client-only state in QuizRunner; show a marker in the question nav. Nothing is stored. |
| Keyboard shortcuts A/B/C/D | Small | QuizRunner already has an `onKeyDown` handler; map letter keys to options on MCQ questions only, and never while a text input is focused. Also an accessibility win (NFR-U3). |
| "Retry the ones I missed" on results | Medium | Needs either a quiz-from-subset concept server-side or a client-side mode that pre-filters questions and still submits a full attempt. Touches grading and history semantics; design before coding. |
| Score chart in History | Medium | SOW §3.2 lists "long-term study-history analytics and progress trends over time" as out of scope. A simple per-quiz attempt-score sparkline is defensible as polish; anything more is scope creep. Decide as a team before anyone builds it. |

Suggested order after section 2: keyboard shortcuts → progress bar → flag button, then decide on the two medium items.

## 8. Who does what

Same split as before: backend = Arnaud + Isaiah, frontend = Hillary + Fardin, tests sit beside the feature and anyone else can review. One branch per row, PR against `main`, CI green, one review from the other side where the row touches `src/shared` or `docs/API.md`.

### Isaiah — backend (Iteration-3 blockers)

| # | Work | WBS | Branch | Done when |
|---|---|---|---|---|
| I-1 | `session.service.ts`: `listSessions`, `saveSession`; `GET`/`POST /api/sessions` per docs/API.md; unit tests | 1.5.2.3 | `feat/1.5.2.3-sessions-api` | Timer save succeeds in the browser; `/api/sessions` returns the last 20 |
| I-2 | `preference.service.ts`: `getPreference`, `setTheme` (upsert); `GET`/`PUT /api/preferences`; unit tests | 1.6.2.3 | `feat/1.6.2.3-preferences-api` | Both routes return `Preference`; invalid theme → 400 |
| I-3 | Load test, 20 concurrent users against the Vercel URL; write results | 1.7.1.3 | — | Results table in `docs/` |
| I-4 | Execute functional acceptance test cases with Fardin; record pass/fail | 1.7.1.2 | — | ATC results sheet |

I-1 first, it is the only thing that is visibly broken today.

### Arnaud — backend, integration, release

| # | Work | WBS | Branch | Done when |
|---|---|---|---|---|
| A-1 | `deleteQuiz` in `quiz.service.ts` + `DELETE /api/quizzes/:id`; unit tests | SEC-10 | `feat/delete-quiz` | Owner can delete, other users get 404 |
| A-2 | Remove `not-implemented.ts` once I-1, I-2, A-1 merge; rewrite `README.md` and `src/frontend/components/README.md` to describe the real app | 2.4 | `chore/retire-starter-frame` | No 501 routes; README matches the code |
| A-3 | Confirm live Supabase has both migrations and Vercel env vars are set; measure page load (< 2 s) and generation (< 30 s) on the deployed site | 1.6.3.3 | — | Timings written into `docs/` |
| A-4 | Security verification: protected routes, cross-user isolation, validation, secrets, rate limiting | 1.7.1.5 | — | Checklist with evidence |
| A-5 | Integrate, regression-test, deploy and demo Iteration 3; WPR2 | 1.6.4, 1.1.3.6 | — | Demo on Nov 2 |

### Hillary — frontend (theme, layout, dashboard)

| # | Work | WBS | Branch | Done when |
|---|---|---|---|---|
| H-1 | Wire `ThemeToggle` to `PUT /api/preferences` and read the preference after login, keeping the localStorage pre-paint. Depends on I-2 | 1.6.2.3 | `feat/1.6.2.3-theme-sync` | Theme follows the account across browsers |
| H-2 | WCAG AA contrast audit, every screen, both themes; fix failures; write the contrast report | 1.6.2.4 | `fix/1.6.2.4-contrast` | Report in `docs/`, all screens pass |
| H-3 | Responsive layout pass at common desktop/laptop sizes | 1.6.3.1 | `fix/1.6.3.1-responsive` | No overflow or clipped controls at 1280, 1440, 1920 |
| H-4 | Dashboard summaries: today's tasks count, last session, latest score | 1.6.3.2 | `feat/dashboard-summaries` | Cards render real data with loading/empty states |
| H-5 | Landing page design pass; redirect signed-in users to the dashboard | — | `feat/landing-page` | Matches Figma; signed-in visit lands on `/dashboard` |
| H-6 | Cross-browser matrix (Chrome, Firefox, Safari, Edge) | 1.7.1.4 | — | Matrix in `docs/` |

### Fardin — frontend (quiz flow, feedback states, user testing)

| # | Work | WBS | Branch | Done when |
|---|---|---|---|---|
| F-1 | Delete-quiz control on the text detail page with a confirm step. Depends on A-1 | SEC-10 | `feat/delete-quiz-ui` | Quiz disappears from the list after confirm |
| F-2 | Loading, empty and error state review across every async action; fix gaps; remove `Placeholder.tsx` and its test | 1.6.3.2 | `fix/1.6.3.2-feedback-states` | Every fetch shows a state; no Placeholder in the tree |
| F-3 | Keyboard shortcuts A/B/C/D in QuizRunner (MCQ only, never while an input is focused), with a visible hint | polish | `feat/quiz-keyboard` | Letters select options; tests cover the input-focused case |
| F-4 | Progress bar bound to `answered / total`; flag-for-review marker on the question nav (client state only) | polish | `feat/quiz-progress-flag` | Bar and flags render; flags cleared on submit |
| F-5 | Recruit 2+ external student testers, run sessions, summarize findings | 1.7.2 | — | Tester task sheets + findings list |

F-1 and F-2 come before F-3/F-4. The two medium ideas (retry missed, score chart) wait for a team decision.

### Shared course deliverables (Weeks 13–16)

| Deliverable | Lead | Others |
|---|---|---|
| User manual with screenshots (1.8.1) | Hillary | Fardin screenshots per screen |
| Final group report (1.8.2.1) | Arnaud | one section per member |
| Final group slides (1.8.2.2) | Fardin | all |
| Final demo (1.8.2.3) | Isaiah drives, all present | |
| Repo upload: program, minutes, reports by Dec 4 (1.8.2.4) | Arnaud | |
| Defect fixing (1.7.3) | whoever owns the area the defect is in | |
| Individual report + presentation (1.8.3) | each member | |

### Dependencies

- H-1 waits on I-2. F-1 waits on A-1. A-2 waits on I-1, I-2, A-1.
- Everything in 1.7 waits on the Iteration-3 build being deployed (A-5).
