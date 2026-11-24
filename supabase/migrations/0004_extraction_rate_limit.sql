-- SEC-6 for document uploads: POST /api/texts/extract can spend up to 20 s of
-- server time parsing one file, so each user gets a fixed number an hour
-- (LIMITS.EXTRACTIONS_PER_HOUR). Same shape as generation_requests in 0001:
-- the server logs every parse attempt and counts the last hour before the next.
begin;

create table if not exists public.extraction_requests (
  id         bigserial primary key,
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists extraction_requests_owner_idx on public.extraction_requests (owner_id, created_at desc);

-- Server-only (service role): RLS on with no client policies, and no table privileges either.
alter table public.extraction_requests enable row level security;
revoke all on table public.extraction_requests from public, anon, authenticated;
revoke all on sequence public.extraction_requests_id_seq from public, anon, authenticated;

create or replace function public.count_recent_extractions(p_owner_id uuid, p_window interval default interval '1 hour')
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::integer from public.extraction_requests
  where owner_id = p_owner_id and created_at > now() - p_window;
$$;

revoke all on function public.count_recent_extractions(uuid, interval) from public, anon, authenticated;

commit;
