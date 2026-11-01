# QuizTrick

AI-assisted study & quiz web application — CSC-4900 Advanced Software Project (Capstone), Fall 2026, UNC Pembroke.

Team: Hillary Agbele · Muhammad Fardin Islam · Arnaud Chenui Azenui · Isaiah Hammonds

Students paste or upload plain-text study material; QuizTrick generates a practice quiz from it (multiple-choice + short answer), grades it instantly, and keeps score history, study tasks and a study timer in one place. Scope, requirements and design live in the course documents (SOW, WBS, SRS, SDD).

## What's built

Every feature in the SOW scope is implemented end to end (Iterations 1–3, WBS 1.4–1.6). Every `/api` route follows the contract in `docs/API.md`, and every screen is real.

| Area | Where | What |
|---|---|---|
| Auth (WBS 1.4.1) | `src/app/(auth)/`, `src/app/api/auth/`, `auth.service.ts` | register, login, logout, forgot/update password, session middleware, protected routes, profile |
| Study texts (1.4.2) | `src/app/(app)/texts/`, `components/texts/`, `text.service.ts` | paste or upload a `.txt`, validation, save, list, view, delete (cascades) |
| Quiz generation (1.4.3) | `components/quiz/GeneratePanel.tsx`, `services/quiz-generator/`, `services/ai/` | prompt, AI call behind a swappable provider, response validation, regenerate, rate limit |
| Quiz taking + grading (1.4.4) | `components/quiz/QuizRunner.tsx`, `grading.service.ts`, `attempt.service.ts` | one question at a time, server-side grading, answer keys never leave the server, results review |
| Tasks (1.5.1) | `components/tasks/`, `task.service.ts` | create, today's list, complete, delete |
| Study timer (1.5.2) | `components/timer/`, `session.service.ts` | stopwatch and countdown, survives navigation, links a session to a task, saved to the database |
| Score history (1.6.1) | `components/history/`, `history.service.ts` | every attempt, best-score flag, expandable incorrect-answer review |
| Theme (1.6.2) | `components/ThemeToggle.tsx`, `preference.service.ts` | light/dark toggle, pre-paint script, saved per account and in the browser |

Supporting pieces:

- `supabase/migrations/` — schema, row-level security, triggers, atomic RPCs (WBS 1.3.1.5). Apply `0001` then `0002`, in that order (`supabase/README.md`)
- `supabase/tests/` — ~80 schema assertions (`npm run test:db`, needs Docker): ownership isolation, the atomic RPCs, every constraint
- `docs/API.md` — the API contract every route implements (WBS 1.3.2.2) · `docs/SETUP.md` — local setup and Vercel deployment
- `src/shared/constants.ts` — every SRS limit and all route paths · `src/shared/types.ts` — the domain types from SDD §4
- `src/backend/validation/schemas.ts` — zod input schemas (SEC-5) · `src/backend/lib/` — error envelope + route wrapper
- CI (`.github/workflows/ci.yml`): lint + typecheck + unit tests + build on every PR and push to main, plus the schema tests
- `tests/unit/` — vitest, one file per module (`npm test`)

Still open for Iteration 3 polish: WCAG AA audit of every screen, responsive pass, dashboard summaries, landing-page design pass, measured timings. Then system testing (WBS 1.7) and the user manual (1.8).

## Quick start

```bash
nvm use                      # picks Node 22 from .nvmrc (nvm install 22 first if missing)
npm install
cp .env.example .env.local   # fill in Supabase + AI keys (docs/SETUP.md)
npm run dev                  # http://localhost:3000
npm run check                # typecheck + unit tests + production build (what CI runs)
npm run test:db              # schema tests against a throwaway Postgres (needs Docker)
```

The app needs a Supabase project and an AI key to do anything useful. Fill `.env.local` from `.env.example` — full walkthrough, including the Vercel deployment, in `docs/SETUP.md`.

## How we work

- **Branches:** never push to `main` directly. Branch per work package (`feat/1.4.2-text-input`), open a PR, CI must pass, one teammate reviews.
- **Deploys:** `main` auto-deploys to Vercel; every PR gets a preview URL (NFR-M2). Repo stays **public** on a personal account — Vercel Hobby blocks collaborators' deploys on private repos.
- **Secrets:** only in `.env.local` (git-ignored) and Vercel env vars — never in code or commits (SEC-3).
- **Conventions:** limits come from `@shared/constants` (never hardcode); services throw `AppError`; routes wrap handlers with `handle()`; answer keys never reach the browser (admin client only).
- **Validation goes in two places.** The browser holds the Supabase anon key, so it can write to its own rows without touching our API. A rule that only lives in `src/backend/validation` is not enforced — add the matching constraint in a migration, and an assertion in `supabase/tests/`.

## Layout

```
src/app/        routes only — thin pages + /api handlers
src/frontend/   components, client lib, styles        (Hillary + Fardin)
src/backend/    services, validation, supabase, lib   (Arnaud + Isaiah)
src/shared/     constants, types, pure utils          (everyone; changes = quick PR review)
supabase/       SQL migrations + schema tests + seed
docs/           API contract, setup guide
tests/unit/     vitest — add tests beside the module you implement
```
