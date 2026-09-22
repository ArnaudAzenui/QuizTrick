# Supabase (database + auth)

This folder holds everything that lives in the Supabase project (WBS 1.3.4.2).

| File | Purpose |
|---|---|
| `migrations/0001_initial_schema.sql` | Tables for every SRS §3.4 entity, RLS policies (SEC-4), triggers, and the `create_quiz_with_questions` / `submit_attempt` / `count_recent_generations` RPCs. |
| `migrations/0002_harden_rls_and_constraints.sql` | Closes the gaps 0001 left: column-level privileges, CHECK constraints and validation the API alone can't enforce. See "Why 0002 exists" below. |
| `tests/` | A schema test suite (`npm run test:db`) — stub Supabase roles plus ~80 assertions. |
| `seed.sql` | Optional local seed data for manual testing. |

## Applying the schema

**Run the migrations in numerical order.** 0001 recreates the permissive policies
and the older trigger, so re-running it on its own after 0002 quietly undoes the
hardening — and leaves registration failing, because 0001's trigger can write a
`display_name` longer than the constraint 0002 adds. If in doubt, run both again
in order; they are all idempotent.

**Option A — SQL editor (quickest):** open your Supabase project → SQL Editor → paste `migrations/0001_initial_schema.sql` → Run → then the same for `0002_harden_rls_and_constraints.sql`.

**Option B — Supabase CLI:**

```bash
npm i -g supabase
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

## Testing the schema

```bash
npm run test:db          # needs Docker; applies the migrations to a throwaway Postgres and asserts
KEEP=1 npm run test:db   # leave the container running to poke at it
```

It runs the suite twice: on a fresh database, and on one where every migration
has been applied twice — the normal state of a shared project. It is not part of
`npm run check` or CI, because it needs a container; run it after touching
anything in `migrations/`.

## Why 0002 exists

0001 enforced ownership but trusted the API for everything else. The browser
holds the anon key, so a signed-in user can write to their own rows with the
Supabase client directly and never touch our server — which means any rule that
only lived in `src/backend/validation` wasn't a rule. Confirmed by testing
against a real Postgres: a user could store a 999,999,999-second study session,
one that ended before it started, one attached to another user's task, rewrite
their own `profiles.email` and `created_at`, and delete their own preferences
row. 0002 moves each of those into the database.

## Security notes

- `questions` has **no** client policies. Answer keys are only reachable through the server with the service-role key (SDD decision 2).
- `attempts` are inserted only via the `submit_attempt()` RPC so a stored attempt is always complete (NFR-R3).
- `quizzes` likewise: clients can only SELECT and DELETE their own. Creation goes through `create_quiz_with_questions()` so a quiz row never exists without its questions (NFR-R2).
- `profiles`: only `display_name` is user-writable (column-level grant). Changing an email is an auth operation, not an update to this table.
- `study_texts` are immutable once saved — a quiz generated from a text must keep meaning what it meant.
- `study_sessions.duration_seconds` is derived by a trigger, so a tampered client value can't inflate study history (SEC-5).
- Both RPCs raise only documented SQLSTATEs (`P0002`, `23503`, `23514`); the services map those to `AppError`. A raw `23505` or `22P02` reaching a route means the contract drifted.
- The migrations are idempotent — re-running them **in order** is the fix for accounts that existed before they were applied (they backfill `profiles` + `preferences`).
- Never put `SUPABASE_SERVICE_ROLE_KEY` in anything prefixed `NEXT_PUBLIC_` (SEC-3).
