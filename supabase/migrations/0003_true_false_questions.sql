-- True/false uses the existing choice-question grading path.
-- Only canonical True/False pairs are allowed as two-option questions.
begin;

create or replace function public.valid_mcq_options(p jsonb)
returns boolean language sql immutable as $$
  select case when jsonb_typeof(p) <> 'array' then false
    when p = '["True","False"]'::jsonb then true
    when jsonb_array_length(p) <> 4 then false
    else not exists (
      select 1 from jsonb_array_elements(p) e
      where jsonb_typeof(e.value) <> 'string' or btrim(e.value #>> '{}') = ''
    ) and (select count(distinct btrim(lower(e.value #>> '{}'))) from jsonb_array_elements(p) e) = 4
  end
$$;

alter table public.questions drop constraint if exists questions_choice_index_check;
alter table public.questions add constraint questions_choice_index_check check (
  type <> 'mcq' or (correct_option >= 0 and correct_option < jsonb_array_length(options))
);

commit;
