-- WhatsApp auto-sender: a small program on Roshan's laptop (a WhatsApp "linked device") sends queued messages itself.
-- The laptop never gets an admin login. It holds a "sender key" that only lets it read and update the send queue,
-- through the three lms_wa_* functions below. Revoke it from the admin app at any time (new key = old one stops working).

alter table public.lms_wa_queue drop constraint if exists lms_wa_queue_status_check;
alter table public.lms_wa_queue add constraint lms_wa_queue_status_check
  check (status in ('pending', 'sending', 'sent', 'skipped', 'no_phone', 'failed'));
alter table public.lms_wa_queue add column if not exists auto boolean not null default false;
alter table public.lms_wa_queue add column if not exists error text check (char_length(error) <= 300);
alter table public.lms_wa_queue add column if not exists attempts int not null default 0;
alter table public.lms_wa_queue add column if not exists claimed_at timestamptz;
create index if not exists lms_wa_queue_auto_idx on public.lms_wa_queue (created_at) where auto and status = 'pending';

-- Sender status, shown in the admin app.
create table if not exists public.lms_wa_worker (
  id text primary key default 'main' check (id = 'main'),
  state text not null default 'offline' check (state in ('offline', 'starting', 'need_link', 'ready', 'paused')),
  linked_phone text check (char_length(linked_phone) <= 30),
  info text check (char_length(info) <= 300),
  sent_today int not null default 0,
  last_seen timestamptz
);
alter table public.lms_wa_worker enable row level security;
grant select on public.lms_wa_worker to authenticated;
create policy "lms wa worker admin read" on public.lms_wa_worker for select to authenticated using ((select lms_private.is_admin()));
insert into public.lms_wa_worker (id) values ('main') on conflict do nothing;

-- Sender keys (only the hash is stored).
create table if not exists lms_private.wa_keys (
  hash text primary key,
  created_at timestamptz not null default now()
);
revoke all on lms_private.wa_keys from public, anon, authenticated;

-- Admin: make a new sender key. Returns it once; every older key stops working.
create or replace function public.lms_wa_new_key() returns text
language plpgsql security definer set search_path = '' as $$
declare k text;
begin
  if not lms_private.is_admin() then raise exception 'Admins only'; end if;
  k := 'wa_' || encode(extensions.gen_random_bytes(24), 'hex');
  delete from lms_private.wa_keys;
  insert into lms_private.wa_keys (hash) values (encode(extensions.digest(k, 'sha256'), 'hex'));
  return k;
end $$;
revoke execute on function public.lms_wa_new_key() from public, anon;
grant execute on function public.lms_wa_new_key() to authenticated;

-- Admin: stop the sender (deletes the key).
create or replace function public.lms_wa_revoke_key() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not lms_private.is_admin() then raise exception 'Admins only'; end if;
  delete from lms_private.wa_keys;
  update public.lms_wa_worker set state = 'offline', info = 'Sender key removed' where id = 'main';
end $$;
revoke execute on function public.lms_wa_revoke_key() from public, anon;
grant execute on function public.lms_wa_revoke_key() to authenticated;

create or replace function lms_private.wa_key_ok(p_key text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from lms_private.wa_keys where hash = encode(extensions.digest(coalesce(p_key, ''), 'sha256'), 'hex'))
$$;
revoke execute on function lms_private.wa_key_ok(text) from public, anon, authenticated;

-- Sender: report status.
create or replace function public.lms_wa_beat(p_key text, p_state text, p_phone text, p_info text, p_sent_today int) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not lms_private.wa_key_ok(p_key) then raise exception 'Not allowed'; end if;
  update public.lms_wa_worker
     set state = case when p_state in ('offline', 'starting', 'need_link', 'ready', 'paused') then p_state else 'starting' end,
         linked_phone = left(p_phone, 30), info = left(p_info, 300), sent_today = greatest(coalesce(p_sent_today, 0), 0), last_seen = now()
   where id = 'main';
  -- Rows stuck in 'sending' for 10 minutes (laptop closed mid-send) go back to the queue.
  update public.lms_wa_queue set status = 'pending' where status = 'sending' and claimed_at < now() - interval '10 minutes' and attempts < 3;
  update public.lms_wa_queue set status = 'failed', error = 'Gave up after 3 tries' where status = 'sending' and claimed_at < now() - interval '10 minutes' and attempts >= 3;
  return true;
end $$;

-- Sender: take the next message to send (oldest first). Returns no row when there is nothing to do.
create or replace function public.lms_wa_next(p_key text)
returns table (id uuid, kind text, target text, message text)
language plpgsql security definer set search_path = '' as $$
begin
  if not lms_private.wa_key_ok(p_key) then raise exception 'Not allowed'; end if;
  return query
  update public.lms_wa_queue q set status = 'sending', claimed_at = now(), attempts = q.attempts + 1
   where q.id = (select q2.id from public.lms_wa_queue q2 where q2.auto and q2.status = 'pending'
                  order by q2.created_at, q2.id limit 1 for update skip locked)
  returning q.id, q.kind, q.target, q.message;
end $$;

-- Sender: report the result of one message. p_status: sent | failed | pending (try again later).
create or replace function public.lms_wa_done(p_key text, p_id uuid, p_status text, p_error text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not lms_private.wa_key_ok(p_key) then raise exception 'Not allowed'; end if;
  if p_status not in ('sent', 'failed', 'pending') then raise exception 'Bad status'; end if;
  -- A retry ('pending') becomes 'failed' after 3 tries.
  update public.lms_wa_queue
     set status = case when p_status = 'pending' and attempts >= 3 then 'failed' else p_status end,
         error = left(p_error, 300), sent_at = case when p_status = 'sent' then now() else sent_at end
   where id = p_id and status = 'sending';
  return found;
end $$;

revoke execute on function public.lms_wa_beat(text, text, text, text, int), public.lms_wa_next(text), public.lms_wa_done(text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.lms_wa_beat(text, text, text, text, int), public.lms_wa_next(text), public.lms_wa_done(text, uuid, text, text) to anon, authenticated;
