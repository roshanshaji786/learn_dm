-- Registration form at /register: short sign-up plus audience questions.
-- Anyone can submit; only admins can read. Each submission also lands in learn_leads
-- (source 'register') so it shows up in the admin's lead list for follow-up.

create table public.learn_registrations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 80),
  phone text not null check (phone ~ '^[0-9]{8,15}$'),
  district text check (char_length(district) <= 40),
  who text not null check (char_length(who) <= 40),
  age text check (char_length(age) <= 20),
  interests text[] not null check (cardinality(interests) between 1 and 6),
  goal text check (char_length(goal) <= 40),
  budget text check (char_length(budget) <= 40),
  heard_from text check (char_length(heard_from) <= 40),
  note text check (char_length(note) <= 300),
  lang text not null default 'en' check (lang in ('en', 'ml')),
  utm text check (char_length(utm) <= 200)
);
create index learn_registrations_created_idx on public.learn_registrations (created_at desc);
alter table public.learn_registrations enable row level security;

revoke all on public.learn_registrations from anon, authenticated;
grant insert (name, phone, district, who, age, interests, goal, budget, heard_from, note, lang, utm)
  on public.learn_registrations to anon, authenticated;
grant select on public.learn_registrations to authenticated;

create policy "anyone can register" on public.learn_registrations
  for insert to anon, authenticated with check (true);
create policy "admins read registrations" on public.learn_registrations
  for select to authenticated using ((select learn_private.is_admin()));

create or replace function learn_private.registration_to_lead() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.learn_leads (name, phone, city, goal, lang, source, utm)
  values (
    new.name, new.phone, new.district,
    left(concat_ws(' · ', new.who, array_to_string(new.interests, ', '), new.goal, new.budget, nullif(new.note, '')), 300),
    new.lang, 'register', new.utm
  );
  return null;
end $$;
revoke all on function learn_private.registration_to_lead() from public, anon, authenticated;

create trigger learn_registrations_lead after insert on public.learn_registrations
  for each row execute function learn_private.registration_to_lead();
