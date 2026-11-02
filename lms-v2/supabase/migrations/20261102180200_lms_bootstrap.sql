-- One-time admin bootstrap tokens. RLS on with no policies, so only the service role (edge function) can read them.
create table if not exists public.lms_bootstrap (token text primary key, created_at timestamptz not null default now());
alter table public.lms_bootstrap enable row level security;
revoke all on public.lms_bootstrap from anon, authenticated;
