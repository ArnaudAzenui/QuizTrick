-- ============================================================================
-- QuizTrick — initial schema (WBS 1.3.1.5 / 1.3.4.2)
-- One table per entity in SRS §3.4 plus AnswerRecord from SDD §4 and a
-- generation_requests table for the SEC-6 rate limit.
-- Every user-owned row carries owner_id and is protected by RLS (SEC-4).
-- All timestamps are UTC (timestamptz).
-- Apply with: supabase db push   (or paste into the Supabase SQL editor)
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enumerations (SDD §4: QuestionType, Theme)
-- ---------------------------------------------------------------------------
do $$ begin
  create type question_type as enum ('mcq', 'short_answer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type theme_choice as enum ('light', 'dark');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- profiles  (UserProfile) — 1:1 with auth.users
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text not null,
  display_name text not null default '',
  created_at   timestamptz not null default now()
);

-- Auto-create a profile + default preference row when a user registers (FR-1.1, FR-8.3).
-- Idempotent: if either row already exists (migration re-run, manual repair), the
-- trigger must not raise — a raised trigger rolls back the auth.users insert and
-- the user sees an opaque registration failure.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  insert into public.preferences (owner_id) values (new.id)
  on conflict (owner_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- preferences  (Preference) — one per user
-- ---------------------------------------------------------------------------
create table if not exists public.preferences (
  owner_id   uuid primary key references public.profiles (id) on delete cascade,
  theme      theme_choice not null default 'light',
  updated_at timestamptz not null default now()
);

-- `default now()` only fires on insert; keep updated_at honest on every update.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists preferences_set_updated_at on public.preferences;
create trigger preferences_set_updated_at
  before update on public.preferences
  for each row execute function public.set_updated_at();

-- Backfill for accounts that existed before this migration ran: the signup
-- trigger never fired for them, so they would have no profile and every page
-- would say "could not be found" (docs/SETUP.md §5). Safe to re-run.
insert into public.profiles (id, email, display_name)
select u.id, u.email, coalesce(nullif(trim(u.raw_user_meta_data ->> 'display_name'), ''), split_part(u.email, '@', 1))
from auth.users u
on conflict (id) do nothing;

insert into public.preferences (owner_id)
select p.id from public.profiles p
on conflict (owner_id) do nothing;

-- ---------------------------------------------------------------------------
-- study_texts  (StudyText)
-- ---------------------------------------------------------------------------
create table if not exists public.study_texts (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  title      text,
  body       text not null check (char_length(body) between 200 and 20000),
  char_count integer not null,
  created_at timestamptz not null default now()
);
create index if not exists study_texts_owner_idx on public.study_texts (owner_id, created_at desc);

-- ---------------------------------------------------------------------------
-- quizzes  (Quiz)
-- ---------------------------------------------------------------------------
create table if not exists public.quizzes (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references public.profiles (id) on delete cascade,
  text_id        uuid not null references public.study_texts (id) on delete cascade,
  question_count integer not null default 10 check (question_count between 1 and 30),
  created_at     timestamptz not null default now()
);
create index if not exists quizzes_owner_idx on public.quizzes (owner_id, created_at desc);
create index if not exists quizzes_text_idx on public.quizzes (text_id);

-- ---------------------------------------------------------------------------
-- questions  (Question) — answer keys live here. No client SELECT policy:
-- the browser only ever receives Question.withoutAnswerKey() via the API.
-- ---------------------------------------------------------------------------
create table if not exists public.questions (
  id              uuid primary key default gen_random_uuid(),
  quiz_id         uuid not null references public.quizzes (id) on delete cascade,
  position        integer not null check (position >= 1),
  type            question_type not null,
  text            text not null check (char_length(text) > 0),
  options         jsonb not null default '[]'::jsonb,
  correct_option  integer check (correct_option between 0 and 3),
  expected_answer text check (expected_answer is null or char_length(expected_answer) <= 50),
  unique (quiz_id, position),
  -- MCQ: exactly 4 options + a correct index. Short answer: no options + expected answer.
  check (
    (type = 'mcq' and jsonb_array_length(options) = 4 and correct_option is not null and expected_answer is null)
    or
    (type = 'short_answer' and jsonb_array_length(options) = 0 and correct_option is null and expected_answer is not null)
  )
);
create index if not exists questions_quiz_idx on public.questions (quiz_id, position);

-- ---------------------------------------------------------------------------
-- attempts  (Attempt)
-- ---------------------------------------------------------------------------
create table if not exists public.attempts (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  quiz_id      uuid not null references public.quizzes (id) on delete cascade,
  started_at   timestamptz not null default now(),
  submitted_at timestamptz not null default now(),
  score        integer not null check (score between 0 and 100)
);
create index if not exists attempts_owner_idx on public.attempts (owner_id, submitted_at desc);
create index if not exists attempts_quiz_idx on public.attempts (quiz_id);

-- ---------------------------------------------------------------------------
-- answer_records  (AnswerRecord)
-- ---------------------------------------------------------------------------
create table if not exists public.answer_records (
  id          uuid primary key default gen_random_uuid(),
  attempt_id  uuid not null references public.attempts (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  response    text not null default '',
  is_correct  boolean not null,
  unique (attempt_id, question_id)
);

-- ---------------------------------------------------------------------------
-- study_tasks  (StudyTask)
-- ---------------------------------------------------------------------------
create table if not exists public.study_tasks (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references public.profiles (id) on delete cascade,
  subject           text not null check (char_length(subject) between 1 and 100),
  description       text check (description is null or char_length(description) <= 500),
  estimated_minutes integer not null check (estimated_minutes between 1 and 600),
  is_complete       boolean not null default false,
  created_at        timestamptz not null default now()
);
create index if not exists study_tasks_owner_idx on public.study_tasks (owner_id, created_at desc);

-- ---------------------------------------------------------------------------
-- study_sessions  (StudySession)
-- ---------------------------------------------------------------------------
create table if not exists public.study_sessions (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references public.profiles (id) on delete cascade,
  task_id          uuid references public.study_tasks (id) on delete set null,
  start_time       timestamptz not null,
  end_time         timestamptz,
  duration_seconds integer not null check (duration_seconds >= 0),
  created_at       timestamptz not null default now()
);
create index if not exists study_sessions_owner_idx on public.study_sessions (owner_id, start_time desc);

-- ---------------------------------------------------------------------------
-- generation_requests — SEC-6 rate limit (20 per user per hour). Written by
-- the server on every generation attempt, successful or not.
-- ---------------------------------------------------------------------------
create table if not exists public.generation_requests (
  id         bigserial primary key,
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists generation_requests_owner_idx on public.generation_requests (owner_id, created_at desc);

-- ============================================================================
-- Row-Level Security (SEC-4): every row reachable only by its owner.
-- ============================================================================
alter table public.profiles            enable row level security;
alter table public.preferences         enable row level security;
alter table public.study_texts         enable row level security;
alter table public.quizzes             enable row level security;
alter table public.questions           enable row level security;
alter table public.attempts            enable row level security;
alter table public.answer_records      enable row level security;
alter table public.study_tasks         enable row level security;
alter table public.study_sessions      enable row level security;
alter table public.generation_requests enable row level security;

-- profiles: read/update own row (FR-1.6). Inserts happen via trigger.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- preferences
drop policy if exists "preferences_all_own" on public.preferences;
create policy "preferences_all_own" on public.preferences for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- study_texts
drop policy if exists "study_texts_all_own" on public.study_texts;
create policy "study_texts_all_own" on public.study_texts for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- quizzes: read + delete only. No client INSERT/UPDATE — creation goes through
-- create_quiz_with_questions() (service role) so a quiz row can never exist
-- without its questions (NFR-R2). The `quizzes_all_own` drop clears the older
-- policy on databases that ran an earlier version of this file.
drop policy if exists "quizzes_all_own" on public.quizzes;
drop policy if exists "quizzes_select_own" on public.quizzes;
create policy "quizzes_select_own" on public.quizzes for select using (auth.uid() = owner_id);
drop policy if exists "quizzes_delete_own" on public.quizzes;
create policy "quizzes_delete_own" on public.quizzes for delete using (auth.uid() = owner_id);

-- questions: NO policies for authenticated users on purpose. Only the
-- server (service role, which bypasses RLS) reads or writes answer keys.
-- The browser gets questions through GET /api/quizzes/:id, key stripped.

-- attempts
drop policy if exists "attempts_select_own" on public.attempts;
create policy "attempts_select_own" on public.attempts for select using (auth.uid() = owner_id);
drop policy if exists "attempts_delete_own" on public.attempts;
create policy "attempts_delete_own" on public.attempts for delete using (auth.uid() = owner_id);
-- Inserts go through submit_attempt() below so an attempt is always complete (NFR-R3).

-- answer_records: readable if the parent attempt is mine
drop policy if exists "answer_records_select_own" on public.answer_records;
create policy "answer_records_select_own" on public.answer_records for select
  using (exists (select 1 from public.attempts a where a.id = attempt_id and a.owner_id = auth.uid()));

-- study_tasks
drop policy if exists "study_tasks_all_own" on public.study_tasks;
create policy "study_tasks_all_own" on public.study_tasks for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- study_sessions
drop policy if exists "study_sessions_all_own" on public.study_sessions;
create policy "study_sessions_all_own" on public.study_sessions for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- generation_requests: server-only (service role). No client policies.

-- ============================================================================
-- RPC: submit_attempt — atomic insert of an attempt with all its answer
-- records (NFR-R3). Grading is done server-side in TypeScript; this function
-- guarantees "all rows or none" AND that the rows are coherent: every
-- question_id must belong to p_quiz_id, and there must be exactly one record
-- per question of the quiz (the grader submits unanswered questions as
-- response '' / is_correct false). Called with the service role.
-- Errors: P0002 quiz not owned · 23503 question outside quiz · 23514 wrong count.
-- ============================================================================
create or replace function public.submit_attempt(
  p_owner_id  uuid,
  p_quiz_id   uuid,
  p_started_at timestamptz,
  p_score     integer,
  p_answers   jsonb   -- [{ "question_id": uuid, "response": text, "is_correct": bool }, ...]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt_id uuid;
  v_expected   integer;
  v_matched    integer;
begin
  if not exists (select 1 from public.quizzes q where q.id = p_quiz_id and q.owner_id = p_owner_id) then
    raise exception 'quiz not found for owner' using errcode = 'P0002';
  end if;

  -- Every submitted question_id must be a question of THIS quiz …
  select count(*) into v_matched
  from jsonb_array_elements(p_answers) as a
  join public.questions q on q.id = (a ->> 'question_id')::uuid and q.quiz_id = p_quiz_id;
  if v_matched <> jsonb_array_length(p_answers) then
    raise exception 'answer references a question outside this quiz' using errcode = '23503';
  end if;

  -- … and every question of the quiz must be answered exactly once
  -- (duplicates are rejected by the unique (attempt_id, question_id) constraint).
  select count(*) into v_expected from public.questions q where q.quiz_id = p_quiz_id;
  if v_matched <> v_expected then
    raise exception 'expected % answer records for this quiz, got %', v_expected, v_matched using errcode = '23514';
  end if;

  insert into public.attempts (owner_id, quiz_id, started_at, submitted_at, score)
  values (p_owner_id, p_quiz_id, coalesce(p_started_at, now()), now(), p_score)
  returning id into v_attempt_id;

  insert into public.answer_records (attempt_id, question_id, response, is_correct)
  select v_attempt_id,
         (a ->> 'question_id')::uuid,
         coalesce(a ->> 'response', ''),
         (a ->> 'is_correct')::boolean
  from jsonb_array_elements(p_answers) as a;

  return v_attempt_id;
end $$;

revoke all on function public.submit_attempt(uuid, uuid, timestamptz, integer, jsonb) from public, anon, authenticated;

-- ============================================================================
-- RPC: create_quiz_with_questions — atomic insert of a quiz and all of its
-- questions (NFR-R2: a partial quiz is never visible). Server-only; the
-- caller has already verified that p_text_id belongs to p_owner_id.
-- p_questions: [{ "position": 1, "type": "mcq", "text": "...", "options": [...4],
--                 "correct_option": 0, "expected_answer": null }, ...]
-- ============================================================================
create or replace function public.create_quiz_with_questions(
  p_owner_id  uuid,
  p_text_id   uuid,
  p_questions jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quiz_id uuid;
  v_count   integer;
begin
  if not exists (select 1 from public.study_texts t where t.id = p_text_id and t.owner_id = p_owner_id) then
    raise exception 'study text not found for owner' using errcode = 'P0002';
  end if;

  v_count := jsonb_array_length(p_questions);
  if v_count < 1 then
    raise exception 'quiz must have at least one question' using errcode = '23514';
  end if;

  insert into public.quizzes (owner_id, text_id, question_count)
  values (p_owner_id, p_text_id, v_count)
  returning id into v_quiz_id;

  insert into public.questions (quiz_id, position, type, text, options, correct_option, expected_answer)
  select v_quiz_id,
         (q ->> 'position')::integer,
         (q ->> 'type')::question_type,
         q ->> 'text',
         coalesce(q -> 'options', '[]'::jsonb),
         (q ->> 'correct_option')::integer,
         q ->> 'expected_answer'
  from jsonb_array_elements(p_questions) as q;

  return v_quiz_id;
end $$;

revoke all on function public.create_quiz_with_questions(uuid, uuid, jsonb) from public, anon, authenticated;

-- ============================================================================
-- RPC: count_recent_generations — SEC-6 helper (server-only).
-- ============================================================================
create or replace function public.count_recent_generations(p_owner_id uuid, p_window interval default interval '1 hour')
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::integer from public.generation_requests
  where owner_id = p_owner_id and created_at > now() - p_window;
$$;

revoke all on function public.count_recent_generations(uuid, interval) from public, anon, authenticated;
