# Supabase (database + auth)

This folder holds everything that lives in the Supabase project (WBS 1.3.4.2).

| File | Purpose |
|---|---|
| `migrations/0001_initial_schema.sql` | Tables for every SRS §3.4 entity, RLS policies (SEC-4), triggers, and the `create_quiz_with_questions` / `submit_attempt` / `count_recent_generations` RPCs. |
| `seed.sql` | Optional local seed data for manual testing. |

## Applying the schema

**Option A — SQL editor (quickest):** open your Supabase project → SQL Editor → paste `migrations/0001_initial_schema.sql` → Run.

**Option B — Supabase CLI:**

```bash
npm i -g supabase
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

## Auth settings to check (Authentication → Providers / Settings)

- Email provider **enabled**; "Confirm email" on (the SRS assumes users can receive email).
- Minimum password length **8** (FR-1.2).
- JWT expiry / refresh-token rotation so sessions last at most **7 days** (FR-1.5, SEC-8).
- Rate limits left at defaults or tighter (SEC-9 — Supabase throttles failed sign-ins).

## Security notes

- `questions` has **no** client policies. Answer keys are only reachable through the server with the service-role key (SDD decision 2).
- `attempts` are inserted only via the `submit_attempt()` RPC so a stored attempt is always complete (NFR-R3).
- `quizzes` likewise: clients can only SELECT and DELETE their own. Creation goes through `create_quiz_with_questions()` so a quiz row never exists without its questions (NFR-R2).
- The migration is idempotent — re-running it is the fix for accounts that existed before it was applied (it backfills `profiles` + `preferences`).
- Never put `SUPABASE_SERVICE_ROLE_KEY` in anything prefixed `NEXT_PUBLIC_` (SEC-3).
