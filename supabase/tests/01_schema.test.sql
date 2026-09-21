-- ============================================================================
-- Schema test suite — run with scripts/test-db.sh (needs Docker).
--
-- Asserts the guarantees the app relies on but cannot enforce from the client:
-- ownership isolation (SEC-4), answer keys never reaching the browser, the
-- atomic RPCs (NFR-R2, NFR-R3), and every constraint added in 0002.
--
-- Every check raises on failure, and the runner uses ON_ERROR_STOP, so a
-- regression fails the run with a non-zero exit code.
-- ============================================================================

\set ON_ERROR_STOP on
\set VERBOSITY terse
\pset format unaligned
\pset tuples_only on

\set A '11111111-1111-4111-8111-111111111111'
\set B '22222222-2222-4222-8222-222222222222'
\set TEXT_A 'aaaaaaaa-0000-4000-8000-000000000001'
\set TEXT_B 'bbbbbbbb-0000-4000-8000-000000000001'
\set TASK_A 'cccccccc-0000-4000-8000-000000000001'
\set TASK_B 'dddddddd-0000-4000-8000-000000000001'

-- ---------------------------------------------------------------------------
-- Assertion helpers
-- ---------------------------------------------------------------------------
create schema if not exists qt_test;
-- Half of these assertions run after `set role authenticated`, so the harness
-- itself has to stay reachable from a restricted role.
grant usage on schema qt_test to public;

create table if not exists qt_test.counter (n integer not null);
truncate qt_test.counter;
insert into qt_test.counter values (0);

-- Runs a statement and returns the SQLSTATE it raised, or 'NO ERROR'.
-- SECURITY INVOKER (the default) is the whole point: it must hit exactly the
-- privileges and policies of whichever role the test has assumed.
create or replace function qt_test.err(p_sql text) returns text language plpgsql as $$
begin
  execute p_sql;
  return 'NO ERROR';
exception when others then
  return sqlstate;
end $$;

-- Runs a statement and returns how many rows it affected. Also invoker: RLS
-- hides rows from UPDATE/DELETE rather than raising, so the count is the test.
create or replace function qt_test.affected(p_sql text) returns integer language plpgsql as $$
declare n integer;
begin
  execute p_sql;
  get diagnostics n = ROW_COUNT;
  return n;
end $$;

-- Bookkeeping only, so this one runs as the owner — a test role has no business
-- writing to the counter table.
create or replace function qt_test.check(p_cond boolean, p_label text) returns void
language plpgsql security definer set search_path = qt_test, public as $$
declare n integer;
begin
  update qt_test.counter set n = counter.n + 1 returning counter.n into n;
  if p_cond is not true then
    raise exception 'FAIL %: %', n, p_label;
  end if;
  raise notice 'ok % - %', n, p_label;
end $$;

-- Asserts a statement fails with an expected SQLSTATE.
create or replace function qt_test.check_err(p_sql text, p_code text, p_label text) returns void language plpgsql as $$
declare actual text;
begin
  actual := qt_test.err(p_sql);
  perform qt_test.check(actual = p_code, p_label || ' (expected ' || p_code || ', got ' || actual || ')');
end $$;

\echo
\echo '=== 1. Signup trigger (FR-1.1, FR-8.3) ==='

insert into auth.users (id, email, raw_user_meta_data) values (:'A', 'alice@example.com', '{"display_name":"  Alice  "}');
insert into auth.users (id, email) values (:'B', 'bob@example.com');

select qt_test.check((select display_name from public.profiles where id = :'A') = 'Alice',
  'display_name from signup metadata is trimmed');
select qt_test.check((select display_name from public.profiles where id = :'B') = 'bob',
  'display_name falls back to the email local part');
select qt_test.check((select count(*) from public.preferences) = 2,
  'a preferences row is created for every new user');

-- 0002: neither of these may break registration by rolling back the auth insert.
select qt_test.check_err(
  $$insert into auth.users (id, email) values ('33333333-3333-4333-8333-333333333333', null)$$,
  'NO ERROR', 'a user with no email can still register (phone / anonymous sign-in)');
select qt_test.check(
  (select count(*) from public.profiles where id = '33333333-3333-4333-8333-333333333333') = 1,
  'the null-email user still gets a profile row');

insert into auth.users (id, email, raw_user_meta_data)
values ('44444444-4444-4444-8444-444444444444', 'long@example.com', jsonb_build_object('display_name', repeat('x', 5000)));
select qt_test.check(
  (select char_length(display_name) from public.profiles where id = '44444444-4444-4444-8444-444444444444') = 60,
  'an over-long display_name in signup metadata is truncated, not rejected');

\echo
\echo '=== 2. profiles: only display_name is user-writable (0002) ==='

select qt_test.check(has_column_privilege('authenticated', 'public.profiles', 'display_name', 'update'),
  'authenticated may update profiles.display_name');
select qt_test.check(not has_column_privilege('authenticated', 'public.profiles', 'email', 'update'),
  'authenticated may NOT update profiles.email');
select qt_test.check(not has_column_privilege('authenticated', 'public.profiles', 'created_at', 'update'),
  'authenticated may NOT update profiles.created_at');

set role authenticated;
select set_config('request.jwt.claim.sub', :'B', false) \g /dev/null

select qt_test.check(qt_test.affected($$update public.profiles set display_name = 'Bobby' where id = auth.uid()$$) = 1,
  'a user can rename themselves');
select qt_test.check_err($$update public.profiles set email = 'spoofed@evil.test' where id = auth.uid()$$,
  '42501', 'a user cannot rewrite their own email');
select qt_test.check_err($$update public.profiles set created_at = '2000-01-01' where id = auth.uid()$$,
  '42501', 'a user cannot backdate their own account');
select qt_test.check_err($$update public.profiles set display_name = repeat('x', 10000) where id = auth.uid()$$,
  '23514', 'a 10,000-character display_name is rejected by the database, not just the API');
select qt_test.check(qt_test.affected($$update public.profiles set display_name = 'Mallory' where id <> auth.uid()$$) = 0,
  'a user cannot rename anybody else');
reset role;

\echo
\echo '=== 3. study_texts: char_count is honest, texts are immutable (0002) ==='

insert into public.study_texts (id, owner_id, title, body, char_count)
values (:'TEXT_A', :'A', 'Bio ch. 4', repeat('a', 250), 250);
insert into public.study_texts (id, owner_id, title, body, char_count)
values (:'TEXT_B', :'B', 'Bob notes', repeat('b', 250), 250);

select qt_test.check_err(
  format($$insert into public.study_texts (owner_id, body, char_count) values (%L, repeat('z', 250), 7)$$, :'A'),
  '23514', 'char_count that disagrees with the body is rejected');

-- 100 emoji: JS String.length says 200, Postgres char_length says 100 — below
-- the 200-char minimum. src/shared/utils/text.ts must count the same way.
select qt_test.check(char_length(repeat('😀', 100)) = 100,
  'Postgres counts an emoji as one character (JS String.length counts two)');
select qt_test.check_err(
  format($$insert into public.study_texts (owner_id, body, char_count) values (%L, repeat('😀', 100), 100)$$, :'A'),
  '23514', '100 emoji is under the 200-character minimum in the database');

set role authenticated;
select set_config('request.jwt.claim.sub', :'A', false) \g /dev/null
select qt_test.check(qt_test.affected(format($$update public.study_texts set body = repeat('q', 250) where id = %L$$, :'TEXT_A')) = 0,
  'a saved study text cannot be edited (quizzes generated from it would drift)');
reset role;

\echo
\echo '=== 4. study_sessions: the database derives duration and orders time (0002) ==='

insert into public.study_tasks (id, owner_id, subject, estimated_minutes) values (:'TASK_A', :'A', 'A private task', 30);
insert into public.study_tasks (id, owner_id, subject, estimated_minutes) values (:'TASK_B', :'B', 'Bob task', 30);

set role authenticated;
select set_config('request.jwt.claim.sub', :'B', false) \g /dev/null

-- SEC-5: a client-sent duration is ignored even when the client writes directly.
insert into public.study_sessions (owner_id, task_id, start_time, end_time, duration_seconds)
values (:'B', :'TASK_B', now() - interval '30 minutes', now(), 999999999);
select qt_test.check(
  (select duration_seconds from public.study_sessions where owner_id = :'B') = 1800,
  'duration_seconds is derived from the timestamps, not taken from the client');

select qt_test.check_err(
  format($$insert into public.study_sessions (owner_id, start_time, end_time, duration_seconds)
           values (%L, now(), now() - interval '1 day', 5)$$, :'B'),
  '23514', 'a session ending before it starts is rejected');
select qt_test.check_err(
  format($$insert into public.study_sessions (owner_id, start_time, end_time, duration_seconds)
           values (%L, now() - interval '30 hours', now(), 5)$$, :'B'),
  '23514', 'a session longer than 24 hours is rejected');
select qt_test.check_err(
  format($$insert into public.study_sessions (owner_id, start_time, end_time, duration_seconds)
           values (%L, now() + interval '1 day', now() + interval '2 days', 5)$$, :'B'),
  '23514', 'a session starting in the future is rejected');
select qt_test.check_err(
  format($$insert into public.study_sessions (owner_id, task_id, start_time, end_time, duration_seconds)
           values (%L, %L, now() - interval '5 minutes', now(), 5)$$, :'B', :'TASK_A'),
  'P0002', 'a session cannot be attached to another user''s task');
reset role;

delete from public.study_tasks where id = :'TASK_B';
select qt_test.check((select task_id from public.study_sessions where owner_id = :'B') is null,
  'deleting a task detaches its sessions instead of deleting them');

\echo
\echo '=== 5. preferences: a user cannot delete their own row (0002) ==='

set role authenticated;
select set_config('request.jwt.claim.sub', :'B', false) \g /dev/null
select qt_test.check(qt_test.affected($$delete from public.preferences where owner_id = auth.uid()$$) = 0,
  'a user cannot delete their own preferences row');
select qt_test.check(qt_test.affected($$update public.preferences set theme = 'dark' where owner_id = auth.uid()$$) = 1,
  'a user can change their own theme');
reset role;
select qt_test.check((select updated_at >= now() - interval '5 seconds' from public.preferences where owner_id = :'B'),
  'updated_at is bumped on every preferences update');

\echo
\echo '=== 6. questions: answer keys are well-formed (0002) ==='

set role service_role;
select public.create_quiz_with_questions(:'A', :'TEXT_A',
  $$[{"position":1,"type":"mcq","text":"Which organelle makes ATP?","options":["Nucleus","Mitochondrion","Ribosome","Golgi"],"correct_option":1,"expected_answer":null},
     {"position":2,"type":"short_answer","text":"Name the powerhouse of the cell.","options":[],"correct_option":null,"expected_answer":"mitochondria"}]$$::jsonb) as quiz_id \gset
reset role;

select qt_test.check((select count(*) from public.questions where quiz_id = :'quiz_id') = 2,
  'a valid quiz is created with all of its questions');
select qt_test.check((select question_count from public.quizzes where id = :'quiz_id') = 2,
  'question_count matches the questions actually stored');

select qt_test.check_err(
  format($$insert into public.questions (quiz_id, position, type, text, options, correct_option)
           values (%L, 9, 'mcq', 'Bad', '["a","b","c"]'::jsonb, 0)$$, :'quiz_id'),
  '23514', 'an MCQ with 3 options is rejected');
select qt_test.check_err(
  format($$insert into public.questions (quiz_id, position, type, text, options, correct_option)
           values (%L, 9, 'mcq', 'Bad', '["a","a","b","c"]'::jsonb, 0)$$, :'quiz_id'),
  '23514', 'an MCQ with duplicate options is rejected');
select qt_test.check_err(
  format($$insert into public.questions (quiz_id, position, type, text, options, correct_option)
           values (%L, 9, 'mcq', 'Bad', '["a","","b","c"]'::jsonb, 0)$$, :'quiz_id'),
  '23514', 'an MCQ with a blank option is rejected');
select qt_test.check_err(
  format($$insert into public.questions (quiz_id, position, type, text, options, correct_option)
           values (%L, 9, 'mcq', 'Bad', '[1,"a","b","c"]'::jsonb, 0)$$, :'quiz_id'),
  '23514', 'an MCQ whose options are not all strings is rejected');
select qt_test.check_err(
  format($$insert into public.questions (quiz_id, position, type, text, options, expected_answer)
           values (%L, 9, 'short_answer', 'Bad', '[]'::jsonb, '   ')$$, :'quiz_id'),
  '23514', 'a short answer with a blank answer key is rejected');

\echo
\echo '=== 7. create_quiz_with_questions: documented SQLSTATEs only (NFR-R2) ==='

set role service_role;
select qt_test.check_err(format($$select public.create_quiz_with_questions(%L, %L, %L::jsonb)$$, :'B', :'TEXT_A', '[{"position":1,"type":"short_answer","text":"Q","options":[],"expected_answer":"x"}]'),
  'P0002', 'generating from another user''s text is refused');
select qt_test.check_err(format($$select public.create_quiz_with_questions(%L, %L, '[]'::jsonb)$$, :'A', :'TEXT_A'),
  '23514', 'an empty question list is refused');
select qt_test.check_err(format($$select public.create_quiz_with_questions(%L, %L, '{"a":1}'::jsonb)$$, :'A', :'TEXT_A'),
  '23514', 'a JSON object instead of an array is refused cleanly');
select qt_test.check_err(format($$select public.create_quiz_with_questions(%L, %L, null)$$, :'A', :'TEXT_A'),
  '23514', 'a null payload is refused cleanly');
select qt_test.check_err(format($$select public.create_quiz_with_questions(%L, %L, %L::jsonb)$$, :'A', :'TEXT_A',
  '[{"position":1,"type":"essay","text":"Q","options":[],"expected_answer":"x"}]'),
  '23514', 'an unknown question type is refused cleanly (not a raw enum cast error)');
select qt_test.check_err(format($$select public.create_quiz_with_questions(%L, %L, %L::jsonb)$$, :'A', :'TEXT_A',
  '[{"position":1,"type":"short_answer","text":"   ","options":[],"expected_answer":"x"}]'),
  '23514', 'a blank question text is refused');
select qt_test.check_err(format($$select public.create_quiz_with_questions(%L, %L, %L::jsonb)$$, :'A', :'TEXT_A',
  '[{"position":1,"type":"short_answer","text":"a","options":[],"expected_answer":"x"},{"position":1,"type":"short_answer","text":"b","options":[],"expected_answer":"y"}]'),
  '23514', 'duplicate positions are refused cleanly (not a raw unique violation)');
select qt_test.check_err(format($$select public.create_quiz_with_questions(%L, %L, %L::jsonb)$$, :'A', :'TEXT_A',
  '[{"position":1,"type":"short_answer","text":"a","options":[],"expected_answer":"x"},{"position":7,"type":"short_answer","text":"b","options":[],"expected_answer":"y"}]'),
  '23514', 'gaps in question positions are refused');
select qt_test.check_err(format($$select public.create_quiz_with_questions(%L, %L, %L::jsonb)$$, :'A', :'TEXT_A',
  '[{"position":1,"type":"mcq","text":"ok","options":["a","b","c","d"],"correct_option":0},{"position":2,"type":"mcq","text":"bad","options":["a","b","c"],"correct_option":0}]'),
  '23514', 'one malformed question rejects the whole quiz');
reset role;

select qt_test.check((select count(*) from public.quizzes where owner_id = :'A') = 1,
  'a failed generation leaves no orphan quiz behind (NFR-R2)');

\echo
\echo '=== 8. submit_attempt: atomic and completely graded (NFR-R3) ==='

select id as q1 from public.questions where quiz_id = :'quiz_id' and position = 1 \gset
select id as q2 from public.questions where quiz_id = :'quiz_id' and position = 2 \gset

set role service_role;
select public.submit_attempt(:'A', :'quiz_id', now() - interval '5 minutes', 50, jsonb_build_array(
  jsonb_build_object('question_id', :'q1', 'response', '1', 'is_correct', true),
  jsonb_build_object('question_id', :'q2', 'response', 'nucleus', 'is_correct', false))) as attempt_id \gset

select qt_test.check_err(format($$select public.submit_attempt(%L, %L, now(), 50, '[]'::jsonb)$$, :'B', :'quiz_id'),
  'P0002', 'submitting against another user''s quiz is refused');
select qt_test.check_err(format($$select public.submit_attempt(%L, %L, now(), 50, jsonb_build_array(jsonb_build_object('question_id', %L, 'response', '1', 'is_correct', true)))$$, :'A', :'quiz_id', :'q1'),
  '23514', 'a partial submission is refused');
select qt_test.check_err(format($$select public.submit_attempt(%L, %L, now(), 50, jsonb_build_array(
    jsonb_build_object('question_id', %L, 'response', '1', 'is_correct', true),
    jsonb_build_object('question_id', %L, 'response', '1', 'is_correct', true)))$$, :'A', :'quiz_id', :'q1', :'q1'),
  '23514', 'the same question answered twice is refused cleanly (not a raw 23505)');
select qt_test.check_err(format($$select public.submit_attempt(%L, %L, now(), 101, jsonb_build_array(
    jsonb_build_object('question_id', %L, 'response', '1', 'is_correct', true),
    jsonb_build_object('question_id', %L, 'response', '', 'is_correct', false)))$$, :'A', :'quiz_id', :'q1', :'q2'),
  '23514', 'a score above 100 is refused');
select qt_test.check_err(format($$select public.submit_attempt(%L, %L, now(), 50, '{"a":1}'::jsonb)$$, :'A', :'quiz_id'),
  '23514', 'a non-array answers payload is refused cleanly');
select qt_test.check_err(format($$select public.submit_attempt(%L, %L, now(), 50, '[{"question_id":"not-a-uuid","response":"","is_correct":false}]'::jsonb)$$, :'A', :'quiz_id'),
  '23514', 'a malformed question id is refused cleanly (not a raw cast error)');

-- A question from another quiz must be caught even when the count is right.
select public.create_quiz_with_questions(:'B', :'TEXT_B',
  $$[{"position":1,"type":"short_answer","text":"Bob Q","options":[],"expected_answer":"x"}]$$::jsonb) as quiz_b \gset
select id as foreign_q from public.questions where quiz_id = :'quiz_b' \gset
select qt_test.check_err(format($$select public.submit_attempt(%L, %L, now(), 50, jsonb_build_array(
    jsonb_build_object('question_id', %L, 'response', '1', 'is_correct', true),
    jsonb_build_object('question_id', %L, 'response', '', 'is_correct', false)))$$, :'A', :'quiz_id', :'q1', :'foreign_q'),
  '23503', 'an answer referencing another quiz''s question is refused');

-- A skewed client clock must not cost a student their finished attempt.
select public.submit_attempt(:'A', :'quiz_id', now() + interval '10 years', 0, jsonb_build_array(
  jsonb_build_object('question_id', :'q1', 'response', '', 'is_correct', false),
  jsonb_build_object('question_id', :'q2', 'response', '', 'is_correct', false))) as skewed_attempt \gset
reset role;

select qt_test.check((select started_at <= submitted_at from public.attempts where id = :'skewed_attempt'),
  'a started_at from the future is clamped, not rejected');
select qt_test.check((select count(*) from public.attempts where owner_id = :'A') = 2,
  'only the two accepted attempts were stored — no partials from the refusals');
select qt_test.check((select count(*) from public.answer_records) = 4,
  'every stored attempt has one answer record per question');

\echo
\echo '=== 9. RLS isolation (SEC-4) ==='

set role authenticated;
select set_config('request.jwt.claim.sub', :'B', false) \g /dev/null

select qt_test.check((select count(*) from public.profiles) = 1, 'a user sees only their own profile');
select qt_test.check((select count(*) from public.study_texts where owner_id = :'A') = 0, 'a user sees none of another user''s texts');
select qt_test.check((select count(*) from public.questions) = 0, 'answer keys are invisible to every client (SDD decision 2)');
select qt_test.check((select count(*) from public.attempts) = 0, 'a user sees none of another user''s attempts');
select qt_test.check((select count(*) from public.answer_records) = 0, 'a user sees none of another user''s answers');
select qt_test.check((select count(*) from public.generation_requests) = 0, 'the rate-limit log is server-only (SEC-6)');

select qt_test.check_err(format($$insert into public.study_texts (owner_id, body, char_count) values (%L, repeat('z', 250), 250)$$, :'A'),
  '42501', 'a user cannot create a text owned by somebody else');
select qt_test.check_err(format($$insert into public.quizzes (owner_id, text_id) values (%L, %L)$$, :'B', :'TEXT_B'),
  '42501', 'a user cannot insert a quiz directly (NFR-R2)');
select qt_test.check_err(format($$insert into public.attempts (owner_id, quiz_id, score) values (%L, %L, 100)$$, :'B', :'quiz_b'),
  '42501', 'a user cannot insert an attempt directly (NFR-R3)');
select qt_test.check_err(format($$insert into public.questions (quiz_id, position, type, text, options, expected_answer) values (%L, 2, 'short_answer', 'x', '[]'::jsonb, 'y')$$, :'quiz_b'),
  '42501', 'a user cannot write their own answer keys');

select qt_test.check_err(format($$select public.submit_attempt(%L, %L, now(), 100, '[]'::jsonb)$$, :'B', :'quiz_b'),
  '42501', 'submit_attempt is not callable by a client');
select qt_test.check_err(format($$select public.create_quiz_with_questions(%L, %L, '[]'::jsonb)$$, :'B', :'TEXT_B'),
  '42501', 'create_quiz_with_questions is not callable by a client');
select qt_test.check_err(format($$select public.count_recent_generations(%L)$$, :'B'),
  '42501', 'count_recent_generations is not callable by a client');

select qt_test.check(qt_test.affected(format($$delete from public.quizzes where id = %L$$, :'quiz_id')) = 0,
  'a user cannot delete another user''s quiz');
reset role;

set role anon;
select set_config('request.jwt.claim.sub', '', false) \g /dev/null
select qt_test.check((select count(*) from public.profiles) = 0, 'a signed-out visitor sees no profiles');
select qt_test.check((select count(*) from public.questions) = 0, 'a signed-out visitor sees no questions');
select qt_test.check((select count(*) from public.study_texts) = 0, 'a signed-out visitor sees no study texts');
reset role;

\echo
\echo '=== 10. Function privileges ==='

select qt_test.check(not has_function_privilege('authenticated', 'public.handle_new_user()', 'execute'),
  'the signup trigger function is not callable by a client');
select qt_test.check(not has_function_privilege('authenticated', 'public.set_updated_at()', 'execute'),
  'the updated_at trigger function is not callable by a client');
select qt_test.check(has_function_privilege('service_role', 'public.submit_attempt(uuid, uuid, timestamptz, integer, jsonb)', 'execute'),
  'the server can still call submit_attempt');

\echo
\echo '=== 11. Deletion cascades (SEC-10) ==='

set role authenticated;
select set_config('request.jwt.claim.sub', :'A', false) \g /dev/null
select qt_test.check(qt_test.affected(format($$delete from public.attempts where id = %L$$, :'attempt_id')) = 1,
  'a user can delete their own attempt');
reset role;
select qt_test.check((select count(*) from public.answer_records where attempt_id = :'attempt_id') = 0,
  'deleting an attempt removes its answer records');

set role authenticated;
select qt_test.check(qt_test.affected(format($$delete from public.study_texts where id = %L$$, :'TEXT_A')) = 1,
  'a user can delete their own study text');
reset role;
select qt_test.check((select count(*) from public.quizzes where owner_id = :'A') = 0
                 and (select count(*) from public.questions where quiz_id = :'quiz_id') = 0
                 and (select count(*) from public.attempts where owner_id = :'A') = 0,
  'deleting a text cascades to its quizzes, questions and attempts');

delete from auth.users where id = :'A';
select qt_test.check((select count(*) from public.profiles where id = :'A') = 0
                 and (select count(*) from public.preferences where owner_id = :'A') = 0
                 and (select count(*) from public.study_tasks where owner_id = :'A') = 0,
  'deleting an account removes every row that belonged to it (SEC-10)');

\echo
select 'ALL ' || n || ' ASSERTIONS PASSED' from qt_test.counter;
