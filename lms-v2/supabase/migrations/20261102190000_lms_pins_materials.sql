-- Simple PIN logins (admin PIN; students: WhatsApp number + PIN) and lesson file uploads.
create table lms_private.pins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pin_hash text not null,
  is_admin boolean not null default false,
  fails int not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);
revoke all on lms_private.pins from public, anon, authenticated;

-- Checks a PIN. Returns the user and a status: ok | wrong | locked | disabled | unknown.
-- 5 wrong tries lock the account for 15 minutes; 20 in a row disable the PIN until the admin sets a new one.
create or replace function public.lms_pin_check(p_role text, p_phone text, p_pin text)
returns table (user_id uuid, status text)
language plpgsql security definer set search_path = '' as $$
declare r lms_private.pins; v_digits text := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10); v_found boolean := false;
begin
  for r in
    select pn.* from lms_private.pins pn
    where (p_role = 'admin' and pn.is_admin)
       or (p_role = 'student' and not pn.is_admin and length(v_digits) = 10 and exists (
             select 1 from public.lms_profiles pr where pr.user_id = pn.user_id
             and right(regexp_replace(coalesce(pr.phone, ''), '\D', '', 'g'), 10) = v_digits))
    order by pn.updated_at desc
  loop
    v_found := true;
    if r.fails >= 20 then user_id := r.user_id; status := 'disabled'; return next; return; end if;
    if r.locked_until is not null and r.locked_until > now() then user_id := r.user_id; status := 'locked'; return next; return; end if;
    if r.pin_hash = extensions.crypt(coalesce(p_pin, ''), r.pin_hash) then
      update lms_private.pins set fails = 0, locked_until = null where lms_private.pins.user_id = r.user_id;
      user_id := r.user_id; status := 'ok'; return next; return;
    end if;
  end loop;
  if not v_found then user_id := null; status := 'unknown'; return next; return; end if;
  -- Wrong PIN: count it against every candidate account.
  update lms_private.pins pn set fails = pn.fails + 1,
    locked_until = case when (pn.fails + 1) % 5 = 0 then now() + interval '15 minutes' else pn.locked_until end
  where (p_role = 'admin' and pn.is_admin)
     or (p_role = 'student' and not pn.is_admin and exists (
           select 1 from public.lms_profiles pr where pr.user_id = pn.user_id
           and right(regexp_replace(coalesce(pr.phone, ''), '\D', '', 'g'), 10) = v_digits));
  user_id := null; status := 'wrong'; return next;
end $$;

create or replace function public.lms_pin_set(p_user uuid, p_pin text, p_admin boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_pin !~ '^\d{4,8}$' then raise exception 'PIN must be 4 to 8 digits'; end if;
  insert into lms_private.pins (user_id, pin_hash, is_admin, fails, locked_until, updated_at)
  values (p_user, extensions.crypt(p_pin, extensions.gen_salt('bf', 8)), p_admin, 0, null, now())
  on conflict (user_id) do update set pin_hash = excluded.pin_hash, is_admin = excluded.is_admin, fails = 0, locked_until = null, updated_at = now();
end $$;

revoke all on function public.lms_pin_check(text, text, text), public.lms_pin_set(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.lms_pin_check(text, text, text), public.lms_pin_set(uuid, text, boolean) to service_role;

-- Lesson files: private bucket, folder per lesson id. Admin manages; students read when the lesson is open for them.
insert into storage.buckets (id, name, public, file_size_limit)
values ('lms-materials', 'lms-materials', false, 52428800)
on conflict (id) do nothing;
create policy "lms materials admin all" on storage.objects for all to authenticated
  using (bucket_id = 'lms-materials' and (select lms_private.is_admin()))
  with check (bucket_id = 'lms-materials' and (select lms_private.is_admin()));
create policy "lms materials student read" on storage.objects for select to authenticated
  using (bucket_id = 'lms-materials'
         and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
         and lms_private.lesson_unlocked(((storage.foldername(name))[1])::uuid, (select auth.uid())));
