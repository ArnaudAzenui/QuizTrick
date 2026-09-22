# QuizTrick

AI-assisted study & quiz web application — CSC-4900 Advanced Software Project (Capstone), Fall 2026, UNC Pembroke.

Team: Hillary Agbele · Muhammad Fardin Islam · Arnaud Chenui Azenui · Isaiah Hammonds

Students paste or upload plain-text study material; QuizTrick generates a practice quiz from it (multiple-choice + short answer), grades it instantly, and keeps score history, study tasks and a study timer in one place. Scope, requirements and design live in the course documents (SOW, WBS, SRS, SDD).

## What this repo is right now

This is the **starter frame** (WBS 1.3.4.1): a Next.js app that installs, typechecks, tests, builds and runs today, with the project structure, contracts and database schema in place — and the feature logic deliberately left as `TODO` stubs for us to build across Iterations 1–3. Every unbuilt screen renders a placeholder saying what belongs there, and every `/api` route returns `501 Not implemented` with its contract documented above it.

**Already real (don't rebuild):**

- `supabase/migrations/` — full DB schema: tables, row-level security, triggers, atomic RPCs (WBS 1.3.1.5). Apply `0001` then `0002`, in that order (`supabase/README.md`)
- `supabase/tests/` — ~80 schema assertions (`npm run test:db`, needs Docker): ownership isolation, the atomic RPCs, every constraint
- `docs/API.md` — the API contract every route stub points at (WBS 1.3.2.2)
- `src/shared/constants.ts` — every SRS limit (text 200–20,000 chars, 100 KB .txt, 20 generations/hr, …) and all route paths
- `src/shared/types.ts` — the domain types from SDD §4 · `src/shared/utils/` — text cleaning/validation + formatting helpers
- `src/backend/validation/schemas.ts` — zod input schemas (SEC-5) · `src/backend/lib/` — error envelope + route wrapper
- `src/backend/supabase/` — server/admin clients + session middleware (FR-1.4/1.5; skipped gracefully until env vars exist)
- `src/frontend/lib/api-client.ts` — typed fetch wrapper · `globals.css` + `tailwind.config.ts` — WCAG-AA-checked theme tokens
- CI (`.github/workflows/ci.yml`): lint + typecheck + unit tests + build on every PR and push to main
- Unit tests for what's real: text validation, input schemas, the error envelope, formatters (`npm test`)

**To build (the actual coursework):**

| Where | What | WBS | Owner |
|---|---|---|---|
| `src/backend/services/*.service.ts` | auth, texts, quizzes, grading, attempts, tasks, sessions, preferences — each file lists its functions | 1.4–1.6 | Arnaud + Isaiah |
| `src/backend/services/quiz-generator/`, `ai/` | prompt, AI call, response validation, generation pipeline | 1.4.3 | Arnaud |
| `src/app/api/**/route.ts` | replace each 501 stub per `docs/API.md` | 1.4–1.6 | Arnaud + Isaiah |
| `src/frontend/components/` | all UI — see the build plan in `src/frontend/components/README.md` | 1.4–1.6 | Hillary + Fardin |
| `src/app/**/page.tsx` | swap each `<Placeholder>` for the real screen | 1.4–1.6 | per feature |

## Quick start

```bash
nvm use                      # picks Node 22 from .nvmrc (nvm install 22 first if missing)
npm install
cp .env.example .env.local   # optional at first — the skeleton runs without it
npm run dev                  # http://localhost:3000
npm run check                # typecheck + unit tests + production build (what CI runs)
npm run test:db              # schema tests against a throwaway Postgres (needs Docker)
```

Until the Supabase project exists, auth is skipped and every screen is reachable as a placeholder. Once Supabase and the AI key are set up (owners per the hosting plan), fill `.env.local` — full walkthrough in `docs/SETUP.md`.

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
