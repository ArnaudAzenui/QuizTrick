-- ============================================================================
-- QuizTrick — hardening pass on 0001 (WBS 1.3.4.2)
--
-- 0001 trusted the API layer for rules the database never checked. But the
-- browser holds the anon key and every `for all` policy, so a signed-in user
-- can write to their own rows directly and skip the server entirely. Anything
-- the API promises has to be enforced here too, or it is not enforced at all.
--
-- What this migration changes:
--   1. profiles  — email / created_at are no longer user-writable; display_name
--                  is capped at 60 chars; the signup trigger can't break
--                  registration (null email, over-long metadata name).
--   2. study_texts — char_count must match the body; no client UPDATE.
--   3. study_sessions — duration is derived by the database, timestamps must be
--                  ordered, within 24 h, not from the future, and a linked task
--                  must belong to the same owner.
--   4. preferences — a user can no longer delete their own row.
--   5. questions  — MCQ options must be 4 distinct non-blank strings; a short
--                  answer key can't be blank.
--   6. attempts   — submitted_at >= started_at.
--   7. RPCs       — validate their JSON input and raise documented SQLSTATEs
--                  instead of letting raw 23505 / 22P02 reach the client.
--
-- Safe to re-run. Apply after 0001: supabase db push (or paste into the SQL editor).
--
-- ORDER MATTERS. 0001 recreates the permissive policies and the old trigger, so
-- running it on its own afterwards silently undoes everything below — and leaves
-- registration broken, because 0001's trigger can write a display_name longer
-- than the constraint this file adds. Always run 0001 then 0002, in that order.
-- `npm run test:db` checks exactly that.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. profiles
-- ---------------------------------------------------------------------------

-- Existing rows first: the constraint below would reject them otherwise.
update public.profiles set display_name = left(display_name, 60) where char_length(display_name) > 60;

alter table public.profiles drop constraint if exists profiles_display_name_len;
alter table public.profiles add constraint profiles_display_name_len check (char_length(display_name) <= 60);

-- RLS said "your own row"; it never said "only this column". A user could
-- rewrite their own email and created_at, which are auth's to own, not theirs.
-- Column-level privileges are what actually restrict this (a policy can't).
-- NOTE: re-running Supabase's `grant all on all tables in schema public to
-- authenticated` would undo this. Re-run this migration if that ever happens.
revoke update on public.profiles from authenticated, anon;
grant update (display_name) on public.profiles to authenticated;

-- Registration must never fail because of profile creation. Two ways it could:
-- a null email (phone / anonymous sign-in) hitting the not-null column, and a
-- display_name in the signup metadata longer than the new 60-char constraint.
-- Both are now neutralised rather than raised — a raised trigger rolls back the
-- auth.users insert and the user just sees "registration failed".
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_email text := coalesce(new.email, '');
  v_name  text;
begin
  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(split_part(v_email, '@', 1), ''),
    'Student'
  );

  insert into public.profiles (id, email, display_name)
  values (new.id, v_email, left(v_name, 60))
  on conflict (id) do nothing;

  insert into public.preferences (owner_id) values (new.id)
  on conflict (owner_id) do nothing;

  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 2. study_texts
-- ---------------------------------------------------------------------------

-- char_count is what list views and the generator read; nothing kept it honest.
-- (JavaScript's String.length counts an emoji as 2 and Postgres counts it as 1,
--  so the app must count code points — see src/shared/utils/text.ts.)
update public.study_texts set char_count = char_length(body) where char_count <> char_length(body);

alter table public.study_texts drop constraint if exists study_texts_char_count_matches;
alter table public.study_texts add constraint study_texts_char_count_matches check (char_count = char_length(body));

-- There is no update-a-text endpoint (docs/API.md); a text is created once and
-- deleted. Quizzes generated from it would silently misrepresent an edited body.
drop policy if exists "study_texts_all_own" on public.study_texts;
drop policy if exists "study_texts_select_own" on public.study_texts;
create policy "study_texts_select_own" on public.study_texts for select using (auth.uid() = owner_id);
drop policy if exists "study_texts_insert_own" on public.study_texts;
create policy "study_texts_insert_own" on public.study_texts for insert with check (auth.uid() = owner_id);
drop policy if exists "study_texts_delete_own" on public.study_texts;
create policy "study_texts_delete_own" on public.study_texts for delete using (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- 3. study_sessions
-- ---------------------------------------------------------------------------

-- The client can write here directly, so "the server derives durationSeconds"
-- (SEC-5) only holds if the database derives it too. A trigger rather than a
-- CHECK because these rules need now() and a lookup, neither allowed in a CHECK.
create or replace function public.validate_study_session()
returns trigger language plpgsql as $$
declare
  v_span numeric;
begin
  if new.end_time is null then
    -- A session still running has no duration yet.
    new.duration_seconds := 0;
  else
    if new.end_time < new.start_time then
      raise exception 'session end time must be at or after its start time' using errcode = '23514';
    end if;

    v_span := extract(epoch from (new.end_time - new.start_time));
    if v_span > 86400 then
      raise exception 'a single session cannot be longer than 24 hours' using errcode = '23514';
    end if;

    -- Derived, never trusted from the caller (SEC-5).
    new.duration_seconds := round(v_span);
  end if;

  -- Tolerate client clock skew, but not a fabricated future session.
  if new.start_time > now() + interval '5 minutes' then
    raise exception 'session start time cannot be in the future' using errcode = '23514';
  end if;

  -- A session may only point at a task the same user owns. Under RLS the
  -- subquery sees only the caller's own tasks; the explicit owner_id match is
  -- what protects the service role, which bypasses RLS.
  if new.task_id is not null
     and not exists (select 1 from public.study_tasks t where t.id = new.task_id and t.owner_id = new.owner_id) then
    raise exception 'study task not found for this user' using errcode = 'P0002';
  end if;

  return new;
end $$;

drop trigger if exists study_sessions_validate on public.study_sessions;
create trigger study_sessions_validate
  before insert or update on public.study_sessions
  for each row execute function public.validate_study_session();

-- ---------------------------------------------------------------------------
-- 4. preferences
-- ---------------------------------------------------------------------------

-- `for all` included DELETE. A user who deleted their preferences row would hit
-- "could not be found" on every themed page. Insert stays (the signup trigger
-- inserts as the definer, but a repair/upsert from the API needs it too).
drop policy if exists "preferences_all_own" on public.preferences;
drop policy if exists "preferences_select_own" on public.preferences;
create policy "preferences_select_own" on public.preferences for select using (auth.uid() = owner_id);
drop policy if exists "preferences_insert_own" on public.preferences;
create policy "preferences_insert_own" on public.preferences for insert with check (auth.uid() = owner_id);
drop policy if exists "preferences_update_own" on public.preferences;
create policy "preferences_update_own" on public.preferences for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- 5. questions
-- ---------------------------------------------------------------------------

-- 0001 only counted the options. A quiz with options ["", "a", "a", 7] or a
-- blank answer key passed, and the taking screen would render it.
create or replace function public.valid_mcq_options(p jsonb)
returns boolean language sql immutable as $$
  select jsonb_typeof(p) = 'array'
     and jsonb_array_length(p) = 4
     and not exists (
           select 1 from jsonb_array_elements(p) e
           where jsonb_typeof(e.value) <> 'string' or btrim(e.value #>> '{}') = ''
         )
     and (select count(distinct btrim(lower(e.value #>> '{}'))) from jsonb_array_elements(p) e) = 4
$$;

revoke all on function public.valid_mcq_options(jsonb) from public, anon, authenticated;
grant execute on function public.valid_mcq_options(jsonb) to postgres, service_role, authenticated;

alter table public.questions drop constraint if exists questions_check;
alter table public.questions drop constraint if exists questions_type_shape_check;
alter table public.questions add constraint questions_type_shape_check check (
  (type = 'mcq'
     and public.valid_mcq_options(options)
     and correct_option is not null
     and expected_answer is null)
  or
  (type = 'short_answer'
     and jsonb_array_length(options) = 0
     and correct_option is null
     and expected_answer is not null
     and btrim(expected_answer) <> '')
);

-- ---------------------------------------------------------------------------
-- 6. attempts
-- ---------------------------------------------------------------------------

alter table public.attempts drop constraint if exists attempts_time_order;
alter table public.attempts add constraint attempts_time_order check (submitted_at >= started_at);

-- ---------------------------------------------------------------------------
-- 7. RPCs — validate input, raise only documented SQLSTATEs
-- ---------------------------------------------------------------------------

-- Errors: P0002 quiz not owned · 23503 question outside quiz · 23514 anything
-- else the caller got wrong (count, duplicates, score, malformed payload).
-- Every raise here is a bug in the server, not something a user can trigger —
-- the API validates first — but a clean SQLSTATE beats a 500 from a raw 23505.
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
  v_distinct   integer;
  v_bad        integer;
  v_started_at timestamptz;
begin
  if jsonb_typeof(p_answers) <> 'array' then
    raise exception 'answers payload must be a JSON array' using errcode = '23514';
  end if;

  -- Checked before the cast below, which would otherwise raise 22P02.
  select count(*) into v_bad
  from jsonb_array_elements(p_answers) as a
  where coalesce(a ->> 'question_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  if v_bad > 0 then
    raise exception 'every answer must name a valid question id' using errcode = '23514';
  end if;

  if p_score is null or p_score < 0 or p_score > 100 then
    raise exception 'score must be between 0 and 100' using errcode = '23514';
  end if;

  if not exists (select 1 from public.quizzes q where q.id = p_quiz_id and q.owner_id = p_owner_id) then
    raise exception 'quiz not found for owner' using errcode = 'P0002';
  end if;

  -- Reject duplicates here: the unique (attempt_id, question_id) constraint
  -- would raise 23505, which is not in this function's documented contract and
  -- would surface as an opaque 500.
  select count(*), count(distinct (a ->> 'question_id'))
    into v_matched, v_distinct
  from jsonb_array_elements(p_answers) as a;
  if v_matched <> v_distinct then
    raise exception 'each question can only be answered once' using errcode = '23514';
  end if;

  -- Every submitted question_id must be a question of THIS quiz …
  select count(*) into v_matched
  from jsonb_array_elements(p_answers) as a
  join public.questions q on q.id = (a ->> 'question_id')::uuid and q.quiz_id = p_quiz_id;
  if v_matched <> jsonb_array_length(p_answers) then
    raise exception 'answer references a question outside this quiz' using errcode = '23503';
  end if;

  -- … and every question of the quiz must be answered exactly once.
  select count(*) into v_expected from public.questions q where q.quiz_id = p_quiz_id;
  if v_matched <> v_expected then
    raise exception 'expected % answer records for this quiz, got %', v_expected, v_matched using errcode = '23514';
  end if;

  -- started_at comes from the browser. A skewed clock must not cost a student
  -- their finished attempt (and would violate attempts_time_order), so clamp
  -- rather than reject.
  v_started_at := least(coalesce(p_started_at, now()), now());

  insert into public.attempts (owner_id, quiz_id, started_at, submitted_at, score)
  values (p_owner_id, p_quiz_id, v_started_at, now(), p_score)
  returning id into v_attempt_id;

  insert into public.answer_records (attempt_id, question_id, response, is_correct)
  select v_attempt_id,
         (a ->> 'question_id')::uuid,
         coalesce(a ->> 'response', ''),
         coalesce((a ->> 'is_correct')::boolean, false)
  from jsonb_array_elements(p_answers) as a;

  return v_attempt_id;
end $$;

revoke all on function public.submit_attempt(uuid, uuid, timestamptz, integer, jsonb) from public, anon, authenticated;

-- Errors: P0002 text not owned · 23514 malformed or invalid question payload.
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
  v_bad     integer;
begin
  if jsonb_typeof(p_questions) <> 'array' then
    raise exception 'questions payload must be a JSON array' using errcode = '23514';
  end if;

  v_count := jsonb_array_length(p_questions);
  if v_count < 1 then
    raise exception 'quiz must have at least one question' using errcode = '23514';
  end if;
  if v_count > 30 then
    raise exception 'quiz cannot have more than 30 questions' using errcode = '23514';
  end if;

  if not exists (select 1 from public.study_texts t where t.id = p_text_id and t.owner_id = p_owner_id) then
    raise exception 'study text not found for owner' using errcode = 'P0002';
  end if;

  -- A bad `type` would otherwise fail as 22P02 from the enum cast, and gaps or
  -- duplicates in `position` as 23505 — neither is in the documented contract.
  select count(*) into v_bad
  from jsonb_array_elements(p_questions) as q
  where coalesce(q ->> 'type', '') not in ('mcq', 'short_answer')
     or btrim(coalesce(q ->> 'text', '')) = '';
  if v_bad > 0 then
    raise exception 'every question needs a non-empty text and a type of mcq or short_answer' using errcode = '23514';
  end if;

  if not exists (
    select 1
    from (select array_agg(distinct (q ->> 'position')::integer order by (q ->> 'position')::integer) as positions
          from jsonb_array_elements(p_questions) as q) s
    where s.positions = (select array_agg(i order by i) from generate_series(1, v_count) i)
  ) then
    raise exception 'question positions must be 1..% with no gaps or duplicates', v_count using errcode = '23514';
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

-- Trigger functions are called by the trigger, never by a client (0001 left
-- these executable by anon / authenticated).
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.validate_study_session() from public, anon, authenticated;
grant execute on function public.validate_study_session() to postgres, service_role, authenticated;
