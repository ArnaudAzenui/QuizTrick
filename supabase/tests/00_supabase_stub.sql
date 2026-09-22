-- ============================================================================
-- Minimal stand-in for the parts of Supabase that the migrations depend on, so
-- the schema can be tested against a plain Postgres container (scripts/test-db.sh).
-- This file is NEVER applied to a real Supabase project — it already has all of
-- this, and more faithfully.
-- ============================================================================

create extension if not exists "pgcrypto";

-- The three roles PostgREST connects as.
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;

create schema if not exists auth;

-- Only the columns the signup trigger reads.
create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

-- Supabase derives this from the request JWT; the tests set the claim directly.
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Supabase grants these by default, which is exactly why RLS has to carry the
-- weight — and why 0002 has to revoke at the column level to restrict a column.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
