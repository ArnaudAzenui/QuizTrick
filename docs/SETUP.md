# QuizTrick — Setup & Deployment (WBS 1.3.4)

## 1. Prerequisites

- Node.js 22+ and npm
- A Supabase project (free tier) — https://supabase.com
- An API key for an OpenAI-compatible chat-completions service (the SOW proposes OpenAI; `gpt-4o-mini` is a cheap default)
- A Vercel account (free Hobby plan) connected to the team GitHub repo

## 2. Local development

```bash
git clone <team-repo> quiztrick && cd quiztrick
npm install
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Where to find it | Client-visible? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | yes (safe) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same page → `anon` `public` key | yes (safe, RLS-protected) |
| `SUPABASE_SERVICE_ROLE_KEY` | same page → `service_role` key | **NO — server only** |
| `AI_API_KEY` | your AI provider dashboard | **NO — server only** |
| `AI_MODEL`, `AI_BASE_URL`, `AI_PROVIDER` | optional overrides — see "Using a different AI vendor" below | no |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` locally; your Vercel URL in production | yes |

### Using a different AI vendor

The provider in `src/backend/services/ai/openai.provider.ts` speaks the OpenAI chat-completions wire format, which several vendors also expose. Only the env vars change — no code:

| Vendor | `AI_BASE_URL` | Example `AI_MODEL` |
|---|---|---|
| OpenAI (default) | `https://api.openai.com/v1` | `gpt-4o-mini` |
| Google Gemini (OpenAI-compatible endpoint) | `https://generativelanguage.googleapis.com/v1beta/openai` | `gemini-2.0-flash` |

`AI_API_KEY` is whichever vendor's key. If the free-tier budget is a concern for the usability tests, Gemini's free quota is usually the more generous of the two.

Then apply the database schema: open Supabase → SQL Editor → paste `supabase/migrations/0001_initial_schema.sql` → Run, then do the same for `supabase/migrations/0002_harden_rls_and_constraints.sql`. **Run them in order** — 0002 closes gaps that 0001 recreates, so applying 0001 on its own afterwards undoes them. (Or use the Supabase CLI — see `supabase/README.md`.)

In Supabase → Authentication → Providers, make sure **Email** is enabled. For quick local testing you may disable "Confirm email"; re-enable it before the usability tests.

```bash
npm run dev      # http://localhost:3000
npm run check    # typecheck + unit tests + production build (what CI runs)
npm run test:db  # schema tests against a throwaway Postgres — needs Docker
```

## 3. Deploy to Vercel (WBS 1.3.4.3 / 1.3.4.4)

1. Vercel → **Add New Project** → import the GitHub repo. Framework preset: Next.js (auto-detected). Root directory: the folder containing `package.json`.
2. **Environment Variables** → add every variable from the table above (Production + Preview). `SUPABASE_SERVICE_ROLE_KEY` and `AI_API_KEY` are never exposed to the browser because they are not prefixed `NEXT_PUBLIC_` and are only read in `src/backend`.
3. Set `NEXT_PUBLIC_APP_URL` to the Vercel production URL.
4. In Supabase → Authentication → URL Configuration, add the Vercel URL to **Site URL** / **Redirect URLs** so email confirmation and password-reset links work.
5. Push to `main` → Vercel deploys automatically; every PR gets a preview URL (NFR-M2).

`/api/generate` declares `maxDuration = 60` so Vercel gives it enough time for the 30-second generation ceiling (PR-2).

## 4. CI

`.github/workflows/ci.yml` runs two jobs on every PR and push to `main`: **check** (lint, typecheck, unit tests, production build) and **schema** (`npm run test:db` — applies the migrations to a throwaway Postgres and asserts ~80 rules about ownership, the atomic RPCs and every constraint). Protect `main` in GitHub settings so both must pass before merge.

## 5. Common problems

| Symptom | Fix |
|---|---|
| `Missing required environment variable …` at startup | Copy `.env.example` → `.env.local` and fill it in; restart `npm run dev`. |
| Login works but every page says "could not be found" | The schema was not applied, or the account predates the migration so the `handle_new_user` trigger never ran for it. Re-run **both** migrations in order (`0001` then `0002`) — they are safe to re-run and backfill a profile + preferences row for every existing user. Running `0001` alone would revert `0002`. |
| Generation returns "unusable quiz" repeatedly | Try a different `AI_MODEL`, or inspect server logs for `[generator] attempt N rejected: …` to see which validation rule the model breaks. |
| Generation returns 401 from the provider | `AI_API_KEY` is wrong or missing on Vercel. |
| Registration fails with an opaque error after applying the schema | `0001` was applied (or re-applied) without `0002`. Run `0002_harden_rls_and_constraints.sql`. |
| Supabase calls fail in the browser with a Content-Security-Policy error | The CSP in `next.config.mjs` allows `*.supabase.co`. If your project is on a custom domain, add it to `connect-src` there. |
