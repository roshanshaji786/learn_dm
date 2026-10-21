-- DARTS AI learn v5: leads, admins and public settings.
-- Every object is prefixed learn_ so it can live beside another app's tables
-- and be moved to its own Supabase project later in one step.

create schema if not exists learn_private;
revoke all on schema learn_private from public;
grant usage on schema learn_private to anon, authenticated;

-- Who may use the admin. Rows are added from the SQL editor only.
create table public.learn_admins (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);
alter table public.learn_admins enable row level security;
revoke all on public.learn_admins from anon, authenticated;
grant select on public.learn_admins to authenticated;

create or replace function learn_private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.learn_admins a
    where a.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
$$;
revoke all on function learn_private.is_admin() from public;
grant execute on function learn_private.is_admin() to anon, authenticated;

create policy "admins read admins" on public.learn_admins
  for select to authenticated using ((select learn_private.is_admin()));

-- Leads and students. Anyone can submit the lead form; only admins can read or change.
create table public.learn_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 80),
  phone text not null check (phone ~ '^[0-9+ ]{8,16}$'),
  city text check (char_length(city) <= 60),
  goal text check (char_length(goal) <= 300),
  lang text not null default 'en' check (lang in ('en', 'ml')),
  source text not null default 'site' check (char_length(source) <= 40),
  utm text check (char_length(utm) <= 200),
  status text not null default 'new'
    check (status in ('new', 'contacted', 'interested', 'joined', 'continuing', 'dropped', 'lost')),
  paid_499 boolean not null default false,
  paid_500 boolean not null default false,
  paid_999 boolean not null default false,
  follow_up_on date,
  note text check (char_length(note) <= 2000)
);
create index learn_leads_created_idx on public.learn_leads (created_at desc);
create index learn_leads_status_idx on public.learn_leads (status);
alter table public.learn_leads enable row level security;

-- The public form may only set these columns, and only on insert.
revoke all on public.learn_leads from anon, authenticated;
grant insert (name, phone, city, goal, lang, source, utm) on public.learn_leads to anon, authenticated;
grant select, update, delete on public.learn_leads to authenticated;
grant insert (name, phone, city, goal, lang, source, utm, status, paid_499, paid_500, paid_999, follow_up_on, note)
  on public.learn_leads to authenticated;

create policy "anyone can submit a lead" on public.learn_leads
  for insert to anon, authenticated with check (status = 'new' and not (paid_499 or paid_500 or paid_999) or (select learn_private.is_admin()));
create policy "admins read leads" on public.learn_leads
  for select to authenticated using ((select learn_private.is_admin()));
create policy "admins update leads" on public.learn_leads
  for update to authenticated using ((select learn_private.is_admin())) with check ((select learn_private.is_admin()));
create policy "admins delete leads" on public.learn_leads
  for delete to authenticated using ((select learn_private.is_admin()));

-- Public settings shown on the sales page (seats, dates, links).
create table public.learn_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.learn_settings enable row level security;
revoke all on public.learn_settings from anon, authenticated;
grant select on public.learn_settings to anon, authenticated;
grant insert, update on public.learn_settings to authenticated;
create policy "anyone reads settings" on public.learn_settings for select to anon, authenticated using (true);
create policy "admins insert settings" on public.learn_settings
  for insert to authenticated with check ((select learn_private.is_admin()));
create policy "admins update settings" on public.learn_settings
  for update to authenticated using ((select learn_private.is_admin())) with check ((select learn_private.is_admin()));

insert into public.learn_settings (key, value) values
  ('seats_total', '25'),
  ('seats_taken', '0'),
  ('batch_start', '2026-10-24T21:00:00+05:30'),
  ('checkout_url', 'https://learn.dartsai.in/cart/49228679119031:1'),
  ('whatsapp', '917012045854');

-- Keep updated_at and the public seats_taken count in step with the leads table.
create or replace function learn_private.on_lead_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end $$;

create or replace function learn_private.refresh_seats() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.learn_settings
     set value = (select count(*)::text from public.learn_leads where paid_499 or paid_999),
         updated_at = now()
   where key = 'seats_taken';
  return null;
end $$;
revoke all on function learn_private.on_lead_change() from public, anon, authenticated;
revoke all on function learn_private.refresh_seats() from public, anon, authenticated;

create trigger learn_leads_touch before update on public.learn_leads
  for each row execute function learn_private.on_lead_change();
create trigger learn_leads_seats after insert or update of paid_499, paid_999 or delete on public.learn_leads
  for each statement execute function learn_private.refresh_seats();
