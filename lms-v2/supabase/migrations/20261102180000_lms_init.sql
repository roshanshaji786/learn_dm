-- Darts LMS v2: courses, lessons, students, fees, attendance, assignments, certificates, WhatsApp queue.
-- Everything is prefixed lms_ because the database is shared with other apps (EcoCart, learn v5).
-- Never touch tables without the lms_ prefix.

create schema if not exists lms_private;
revoke all on schema lms_private from public;
grant usage on schema lms_private to anon, authenticated;

-- Admin = a flag only the server can set (app_metadata), so a stranger who signs up gets nothing.
create or replace function lms_private.is_admin() returns boolean
language sql stable set search_path = '' as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'lms_admin')::boolean, false)
$$;
grant execute on function lms_private.is_admin() to anon, authenticated;

-- Settings shown in the app (academy name, WhatsApp, UPI).
create table public.lms_settings (
  key text primary key check (char_length(key) <= 40),
  value text not null check (char_length(value) <= 2000),
  updated_at timestamptz not null default now()
);
alter table public.lms_settings enable row level security;
grant select on public.lms_settings to anon, authenticated;
grant insert, update, delete on public.lms_settings to authenticated;
create policy "lms settings readable" on public.lms_settings for select to anon, authenticated using (true);
create policy "lms settings admin insert" on public.lms_settings for insert to authenticated with check ((select lms_private.is_admin()));
create policy "lms settings admin update" on public.lms_settings for update to authenticated using ((select lms_private.is_admin())) with check ((select lms_private.is_admin()));
create policy "lms settings admin delete" on public.lms_settings for delete to authenticated using ((select lms_private.is_admin()));

-- Courses, modules, lessons (public outline).
create table public.lms_courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,80}$'),
  title text not null check (char_length(title) between 2 and 120),
  subtitle text check (char_length(subtitle) <= 300),
  description text check (char_length(description) <= 5000),
  highlights text[] not null default '{}',
  fee numeric(10,2) not null default 0 check (fee >= 0),
  fee_note text check (char_length(fee_note) <= 200),
  cover_url text check (char_length(cover_url) <= 500),
  published boolean not null default false,
  cert_enabled boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create table public.lms_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.lms_courses(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  summary text check (char_length(summary) <= 1000),
  sort int not null default 0
);
create index lms_modules_course_idx on public.lms_modules (course_id, sort);
create table public.lms_lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.lms_courses(id) on delete cascade,
  module_id uuid not null references public.lms_modules(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  sort int not null default 0,
  live_start timestamptz,
  duration_min int not null default 60 check (duration_min between 5 and 600),
  unlock_mode text not null default 'open' check (unlock_mode in ('open', 'date', 'days', 'before_class')),
  unlock_at timestamptz,
  unlock_days int check (unlock_days between 0 and 1000),
  has_assignment boolean not null default false,
  assign_max numeric(6,2) check (assign_max > 0),
  assign_due_days int check (assign_due_days between 0 and 365),
  published boolean not null default true,
  created_at timestamptz not null default now()
);
create index lms_lessons_course_idx on public.lms_lessons (course_id, sort);
create index lms_lessons_module_idx on public.lms_lessons (module_id);
create index lms_lessons_live_idx on public.lms_lessons (live_start);

-- Lesson content only enrolled, paid-up students see (Meet link, recording, notes, assignment brief).
create table public.lms_lesson_content (
  lesson_id uuid primary key references public.lms_lessons(id) on delete cascade,
  notes text check (char_length(notes) <= 20000),
  meet_link text check (char_length(meet_link) <= 500),
  recording_url text check (char_length(recording_url) <= 500),
  assign_text text check (char_length(assign_text) <= 5000)
);

-- Students.
create table public.lms_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  email text not null check (char_length(email) <= 200),
  phone text check (char_length(phone) <= 20),
  lang text not null default 'en' check (lang in ('en', 'ml')),
  must_change_password boolean not null default false,
  note text check (char_length(note) <= 2000),
  created_at timestamptz not null default now()
);
create unique index lms_profiles_email_idx on public.lms_profiles (lower(email));

create table public.lms_enrolments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.lms_profiles(user_id) on delete cascade,
  course_id uuid not null references public.lms_courses(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  total_fee numeric(10,2) not null default 0 check (total_fee >= 0),
  due_date date,
  created_at timestamptz not null default now(),
  unique (user_id, course_id)
);
create index lms_enrolments_course_idx on public.lms_enrolments (course_id);

create sequence lms_private.receipt_seq;
create table public.lms_payments (
  id uuid primary key default gen_random_uuid(),
  enrolment_id uuid not null references public.lms_enrolments(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  paid_on date not null default ((now() at time zone 'Asia/Kolkata')::date),
  method text not null default 'UPI' check (char_length(method) <= 30),
  reference text check (char_length(reference) <= 100),
  receipt_no text unique,
  created_at timestamptz not null default now()
);
create index lms_payments_enrolment_idx on public.lms_payments (enrolment_id);

create table public.lms_progress (
  user_id uuid not null references public.lms_profiles(user_id) on delete cascade,
  lesson_id uuid not null references public.lms_lessons(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
create index lms_progress_lesson_idx on public.lms_progress (lesson_id);

create table public.lms_attendance (
  user_id uuid not null references public.lms_profiles(user_id) on delete cascade,
  lesson_id uuid not null references public.lms_lessons(id) on delete cascade,
  joined_at timestamptz not null default now(),
  source text not null default 'join' check (source in ('join', 'manual')),
  primary key (user_id, lesson_id)
);
create index lms_attendance_lesson_idx on public.lms_attendance (lesson_id);

create table public.lms_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.lms_profiles(user_id) on delete cascade,
  lesson_id uuid not null references public.lms_lessons(id) on delete cascade,
  answer text check (char_length(answer) <= 10000),
  link text check (char_length(link) <= 500),
  file_path text check (char_length(file_path) <= 300),
  status text not null default 'submitted' check (status in ('submitted', 'graded', 'redo')),
  marks numeric(6,2),
  feedback text check (char_length(feedback) <= 5000),
  submitted_at timestamptz not null default now(),
  graded_at timestamptz,
  unique (user_id, lesson_id)
);
create index lms_submissions_lesson_idx on public.lms_submissions (lesson_id);
create index lms_submissions_status_idx on public.lms_submissions (status);

create table public.lms_certificates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  user_id uuid not null references public.lms_profiles(user_id) on delete cascade,
  course_id uuid not null references public.lms_courses(id) on delete cascade,
  issued_at timestamptz not null default now(),
  revoked boolean not null default false,
  unique (user_id, course_id)
);

create table public.lms_wa_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  invite_url text check (char_length(invite_url) <= 300),
  created_at timestamptz not null default now()
);
create table public.lms_wa_queue (
  id uuid primary key default gen_random_uuid(),
  campaign uuid not null,
  kind text not null check (kind in ('user', 'group')),
  user_id uuid references public.lms_profiles(user_id) on delete set null,
  label text not null check (char_length(label) <= 120),
  target text check (char_length(target) <= 300),
  message text not null check (char_length(message) <= 4000),
  status text not null default 'pending' check (status in ('pending', 'sent', 'skipped', 'no_phone')),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index lms_wa_queue_campaign_idx on public.lms_wa_queue (campaign);

-- Helpers (security definer so policies can use them without leaking rows).
create or replace function lms_private.enrolment_of(p_user uuid, p_course uuid) returns public.lms_enrolments
language sql stable security definer set search_path = '' as $$
  select e.* from public.lms_enrolments e where e.user_id = p_user and e.course_id = p_course and e.status <> 'cancelled'
$$;

create or replace function lms_private.balance(p_enrolment uuid) returns numeric
language sql stable security definer set search_path = '' as $$
  select e.total_fee - coalesce((select sum(p.amount) from public.lms_payments p where p.enrolment_id = e.id), 0)
  from public.lms_enrolments e where e.id = p_enrolment
$$;

create or replace function lms_private.fee_locked(p_user uuid, p_course uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select lms_private.balance(e.id) > 0 and e.due_date is not null
       and e.due_date < (now() at time zone 'Asia/Kolkata')::date
    from public.lms_enrolments e where e.user_id = p_user and e.course_id = p_course and e.status <> 'cancelled'
  ), false)
$$;

-- When a lesson opens for a student (null = never: not enrolled).
create or replace function lms_private.opens_at(p_lesson uuid, p_user uuid) returns timestamptz
language sql stable security definer set search_path = '' as $$
  select case l.unlock_mode
           when 'open' then e.created_at
           when 'date' then coalesce(l.unlock_at, e.created_at)
           when 'days' then e.created_at + make_interval(days => coalesce(l.unlock_days, 0))
           when 'before_class' then coalesce(l.live_start - interval '1 hour', e.created_at)
         end
  from public.lms_lessons l
  join public.lms_enrolments e on e.course_id = l.course_id and e.user_id = p_user and e.status <> 'cancelled'
  where l.id = p_lesson and l.published
$$;

create or replace function lms_private.lesson_unlocked(p_lesson uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    lms_private.opens_at(p_lesson, p_user) <= now()
    and not lms_private.fee_locked(p_user, (select course_id from public.lms_lessons where id = p_lesson)),
    false)
$$;
revoke all on function lms_private.enrolment_of(uuid, uuid), lms_private.balance(uuid), lms_private.fee_locked(uuid, uuid),
  lms_private.opens_at(uuid, uuid), lms_private.lesson_unlocked(uuid, uuid) from public;
grant execute on function lms_private.enrolment_of(uuid, uuid), lms_private.balance(uuid), lms_private.fee_locked(uuid, uuid),
  lms_private.opens_at(uuid, uuid), lms_private.lesson_unlocked(uuid, uuid) to authenticated;

-- Receipt numbers LMS-2026-0001.
create or replace function lms_private.set_receipt_no() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.receipt_no is null then
    new.receipt_no := 'LMS-' || to_char(now() at time zone 'Asia/Kolkata', 'YYYY') || '-' || lpad(nextval('lms_private.receipt_seq')::text, 4, '0');
  end if;
  return new;
end $$;
revoke all on function lms_private.set_receipt_no() from public, anon, authenticated;
create trigger lms_payments_receipt before insert on public.lms_payments for each row execute function lms_private.set_receipt_no();

-- RLS: every table.
alter table public.lms_courses enable row level security;
alter table public.lms_modules enable row level security;
alter table public.lms_lessons enable row level security;
alter table public.lms_lesson_content enable row level security;
alter table public.lms_profiles enable row level security;
alter table public.lms_enrolments enable row level security;
alter table public.lms_payments enable row level security;
alter table public.lms_progress enable row level security;
alter table public.lms_attendance enable row level security;
alter table public.lms_submissions enable row level security;
alter table public.lms_certificates enable row level security;
alter table public.lms_wa_groups enable row level security;
alter table public.lms_wa_queue enable row level security;

grant select on public.lms_courses, public.lms_modules, public.lms_lessons to anon, authenticated;
grant insert, update, delete on public.lms_courses, public.lms_modules, public.lms_lessons, public.lms_lesson_content,
  public.lms_enrolments, public.lms_payments, public.lms_attendance, public.lms_certificates,
  public.lms_wa_groups, public.lms_wa_queue to authenticated;
grant select on public.lms_lesson_content, public.lms_profiles, public.lms_enrolments, public.lms_payments, public.lms_progress,
  public.lms_attendance, public.lms_submissions, public.lms_certificates, public.lms_wa_groups, public.lms_wa_queue to authenticated;
grant insert, delete on public.lms_progress to authenticated;
grant insert, update on public.lms_profiles to authenticated;
grant insert, update, delete on public.lms_submissions to authenticated;

-- Public outline.
create policy "lms courses public" on public.lms_courses for select to anon, authenticated using (published or (select lms_private.is_admin()));
create policy "lms courses admin ins" on public.lms_courses for insert to authenticated with check ((select lms_private.is_admin()));
create policy "lms courses admin upd" on public.lms_courses for update to authenticated using ((select lms_private.is_admin())) with check ((select lms_private.is_admin()));
create policy "lms courses admin del" on public.lms_courses for delete to authenticated using ((select lms_private.is_admin()));

create policy "lms modules public" on public.lms_modules for select to anon, authenticated using (true);
create policy "lms modules admin ins" on public.lms_modules for insert to authenticated with check ((select lms_private.is_admin()));
create policy "lms modules admin upd" on public.lms_modules for update to authenticated using ((select lms_private.is_admin())) with check ((select lms_private.is_admin()));
create policy "lms modules admin del" on public.lms_modules for delete to authenticated using ((select lms_private.is_admin()));

create policy "lms lessons public" on public.lms_lessons for select to anon, authenticated using (published or (select lms_private.is_admin()));
create policy "lms lessons admin ins" on public.lms_lessons for insert to authenticated with check ((select lms_private.is_admin()));
create policy "lms lessons admin upd" on public.lms_lessons for update to authenticated using ((select lms_private.is_admin())) with check ((select lms_private.is_admin()));
create policy "lms lessons admin del" on public.lms_lessons for delete to authenticated using ((select lms_private.is_admin()));

-- Private content: admin, or a student whose lesson is open and fees are not overdue.
create policy "lms content read" on public.lms_lesson_content for select to authenticated
  using ((select lms_private.is_admin()) or lms_private.lesson_unlocked(lesson_id, (select auth.uid())));
create policy "lms content admin ins" on public.lms_lesson_content for insert to authenticated with check ((select lms_private.is_admin()));
create policy "lms content admin upd" on public.lms_lesson_content for update to authenticated using ((select lms_private.is_admin())) with check ((select lms_private.is_admin()));
create policy "lms content admin del" on public.lms_lesson_content for delete to authenticated using ((select lms_private.is_admin()));

-- Profiles: own or admin. Students may change only name, phone, language and the password flag.
revoke update on public.lms_profiles from authenticated;
grant update (name, phone, lang, must_change_password, note, email) on public.lms_profiles to authenticated;
create policy "lms profiles read" on public.lms_profiles for select to authenticated
  using (user_id = (select auth.uid()) or (select lms_private.is_admin()));
create policy "lms profiles admin ins" on public.lms_profiles for insert to authenticated with check ((select lms_private.is_admin()));
create policy "lms profiles update" on public.lms_profiles for update to authenticated
  using (user_id = (select auth.uid()) or (select lms_private.is_admin()))
  with check (user_id = (select auth.uid()) or (select lms_private.is_admin()));
-- Students cannot change their own note or email (admin only).
create or replace function lms_private.guard_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not lms_private.is_admin() and (new.note is distinct from old.note or new.email is distinct from old.email) then
    raise exception 'Only the admin can change this';
  end if;
  return new;
end $$;
revoke all on function lms_private.guard_profile() from public, anon, authenticated;
create trigger lms_profiles_guard before update on public.lms_profiles for each row execute function lms_private.guard_profile();

create policy "lms enrolments read" on public.lms_enrolments for select to authenticated
  using (user_id = (select auth.uid()) or (select lms_private.is_admin()));
create policy "lms enrolments admin ins" on public.lms_enrolments for insert to authenticated with check ((select lms_private.is_admin()));
create policy "lms enrolments admin upd" on public.lms_enrolments for update to authenticated using ((select lms_private.is_admin())) with check ((select lms_private.is_admin()));
create policy "lms enrolments admin del" on public.lms_enrolments for delete to authenticated using ((select lms_private.is_admin()));

create policy "lms payments read" on public.lms_payments for select to authenticated
  using ((select lms_private.is_admin()) or exists (select 1 from public.lms_enrolments e where e.id = enrolment_id and e.user_id = (select auth.uid())));
create policy "lms payments admin ins" on public.lms_payments for insert to authenticated with check ((select lms_private.is_admin()));
create policy "lms payments admin upd" on public.lms_payments for update to authenticated using ((select lms_private.is_admin())) with check ((select lms_private.is_admin()));
create policy "lms payments admin del" on public.lms_payments for delete to authenticated using ((select lms_private.is_admin()));

create policy "lms progress read" on public.lms_progress for select to authenticated
  using (user_id = (select auth.uid()) or (select lms_private.is_admin()));
create policy "lms progress own ins" on public.lms_progress for insert to authenticated
  with check (user_id = (select auth.uid()) and lms_private.lesson_unlocked(lesson_id, (select auth.uid())));
create policy "lms progress own del" on public.lms_progress for delete to authenticated
  using (user_id = (select auth.uid()) or (select lms_private.is_admin()));

create policy "lms attendance read" on public.lms_attendance for select to authenticated
  using (user_id = (select auth.uid()) or (select lms_private.is_admin()));
create policy "lms attendance admin ins" on public.lms_attendance for insert to authenticated with check ((select lms_private.is_admin()));
create policy "lms attendance admin upd" on public.lms_attendance for update to authenticated using ((select lms_private.is_admin())) with check ((select lms_private.is_admin()));
create policy "lms attendance admin del" on public.lms_attendance for delete to authenticated using ((select lms_private.is_admin()));

-- Submissions: students create and edit their own until marked; admin marks.
create policy "lms submissions read" on public.lms_submissions for select to authenticated
  using (user_id = (select auth.uid()) or (select lms_private.is_admin()));
create policy "lms submissions own ins" on public.lms_submissions for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'submitted' and marks is null and feedback is null
              and lms_private.lesson_unlocked(lesson_id, (select auth.uid())));
create policy "lms submissions update" on public.lms_submissions for update to authenticated
  using ((select lms_private.is_admin()) or (user_id = (select auth.uid()) and status <> 'graded'))
  with check ((select lms_private.is_admin()) or (user_id = (select auth.uid()) and status = 'submitted'));
create policy "lms submissions admin del" on public.lms_submissions for delete to authenticated using ((select lms_private.is_admin()));
create or replace function lms_private.guard_submission() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not lms_private.is_admin() then
    new.marks := old.marks; new.feedback := old.feedback; new.graded_at := old.graded_at;
    new.user_id := old.user_id; new.lesson_id := old.lesson_id; new.status := 'submitted'; new.submitted_at := now();
  end if;
  return new;
end $$;
revoke all on function lms_private.guard_submission() from public, anon, authenticated;
create trigger lms_submissions_guard before update on public.lms_submissions for each row execute function lms_private.guard_submission();

create policy "lms certificates read" on public.lms_certificates for select to authenticated
  using (user_id = (select auth.uid()) or (select lms_private.is_admin()));
create policy "lms certificates admin ins" on public.lms_certificates for insert to authenticated with check ((select lms_private.is_admin()));
create policy "lms certificates admin upd" on public.lms_certificates for update to authenticated using ((select lms_private.is_admin())) with check ((select lms_private.is_admin()));
create policy "lms certificates admin del" on public.lms_certificates for delete to authenticated using ((select lms_private.is_admin()));

create policy "lms wa groups admin" on public.lms_wa_groups for all to authenticated using ((select lms_private.is_admin())) with check ((select lms_private.is_admin()));
create policy "lms wa queue admin" on public.lms_wa_queue for all to authenticated using ((select lms_private.is_admin())) with check ((select lms_private.is_admin()));

-- RPCs.
-- Per-lesson state for the signed-in student.
create or replace function public.lms_my_lessons(p_course uuid)
returns table (lesson_id uuid, opens_at timestamptz, unlocked boolean, fee_locked boolean, completed boolean, attended boolean)
language sql stable security definer set search_path = '' as $$
  select l.id,
         lms_private.opens_at(l.id, auth.uid()),
         lms_private.lesson_unlocked(l.id, auth.uid()),
         lms_private.fee_locked(auth.uid(), p_course),
         exists (select 1 from public.lms_progress p where p.lesson_id = l.id and p.user_id = auth.uid()),
         exists (select 1 from public.lms_attendance a where a.lesson_id = l.id and a.user_id = auth.uid())
  from public.lms_lessons l
  where l.course_id = p_course and l.published and auth.uid() is not null
$$;

-- Join a live class: logs attendance and returns the Meet link.
create or replace function public.lms_join(p_lesson uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v_link text;
begin
  if auth.uid() is null or not lms_private.lesson_unlocked(p_lesson, auth.uid()) then
    raise exception 'This class is not open for you yet';
  end if;
  select meet_link into v_link from public.lms_lesson_content where lesson_id = p_lesson;
  if v_link is null then raise exception 'No class link yet'; end if;
  insert into public.lms_attendance (user_id, lesson_id, source) values (auth.uid(), p_lesson, 'join')
    on conflict do nothing;
  return v_link;
end $$;

-- A student claims their certificate when every lesson is done and the fee is paid.
create or replace function public.lms_claim_certificate(p_course uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v_code text; v_e public.lms_enrolments;
begin
  select * into v_e from public.lms_enrolments where user_id = auth.uid() and course_id = p_course and status <> 'cancelled';
  if v_e.id is null then raise exception 'Not enrolled'; end if;
  if not (select cert_enabled from public.lms_courses where id = p_course) then raise exception 'No certificate for this course'; end if;
  select code into v_code from public.lms_certificates where user_id = auth.uid() and course_id = p_course;
  if v_code is not null then return v_code; end if;
  if lms_private.balance(v_e.id) > 0 then raise exception 'Clear the fee balance first'; end if;
  if not exists (select 1 from public.lms_lessons l where l.course_id = p_course and l.published) then
    raise exception 'Lessons are not added yet';
  end if;
  if exists (select 1 from public.lms_lessons l where l.course_id = p_course and l.published
             and not exists (select 1 from public.lms_progress p where p.lesson_id = l.id and p.user_id = auth.uid())) then
    raise exception 'Finish every lesson first';
  end if;
  v_code := 'DAA-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.lms_certificates (code, user_id, course_id) values (v_code, auth.uid(), p_course);
  update public.lms_enrolments set status = 'completed' where id = v_e.id;
  return v_code;
end $$;

-- Public certificate check.
create or replace function public.lms_verify(p_code text)
returns table (name text, course text, issued_at timestamptz, revoked boolean)
language sql stable security definer set search_path = '' as $$
  select pr.name, c.title, ce.issued_at, ce.revoked
  from public.lms_certificates ce
  join public.lms_profiles pr on pr.user_id = ce.user_id
  join public.lms_courses c on c.id = ce.course_id
  where ce.code = upper(trim(p_code))
$$;

revoke all on function public.lms_my_lessons(uuid), public.lms_join(uuid), public.lms_claim_certificate(uuid), public.lms_verify(text) from public;
grant execute on function public.lms_my_lessons(uuid), public.lms_join(uuid), public.lms_claim_certificate(uuid) to authenticated;
grant execute on function public.lms_verify(text) to anon, authenticated;

-- Storage: private bucket for assignment files. Each student writes only in their own folder.
insert into storage.buckets (id, name, public, file_size_limit)
values ('lms-submissions', 'lms-submissions', false, 10485760)
on conflict (id) do nothing;
create policy "lms files own read" on storage.objects for select to authenticated
  using (bucket_id = 'lms-submissions' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select lms_private.is_admin())));
create policy "lms files own insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'lms-submissions' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "lms files own update" on storage.objects for update to authenticated
  using (bucket_id = 'lms-submissions' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "lms files own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'lms-submissions' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select lms_private.is_admin())));

-- Seed: settings and the Advanced Digital Marketing course (same text as roshanshaji.com).
insert into public.lms_settings (key, value) values
  ('academy_name', 'Darts AI Academy'),
  ('whatsapp', '917012045854'),
  ('upi_id', '7012045854@apl');

with c as (
  insert into public.lms_courses (slug, title, subtitle, description, highlights, fee, fee_note, cover_url, published, sort)
  values ('advanced-digital-marketing-with-ai', 'Advanced Digital Marketing with AI',
    'My complete, mentor-led program for people who want a career in digital marketing or want to grow their own business.',
    'Every module uses AI tools the way agencies use them today.',
    array['Live, mentor-led classes with Roshan', 'Malayalam & English', 'AI tools in every module', 'Hands-on projects, not just theory'],
    99999, 'full program fee · talk to me before you enrol', '/img/adm-cover.jpg', true, 1)
  returning id
)
insert into public.lms_modules (course_id, title, summary, sort)
select c.id, m.title, m.summary, m.sort from c, (values
  ('Marketing strategy', 'Who you sell to, what you offer and how you reach them, with AI for research and planning.', 1),
  ('SEO', 'Get found on Google: keywords, on-page SEO and content, with AI to speed up the work.', 2),
  ('Meta Ads', 'Facebook and Instagram ads: targeting, creatives, budgets and reading results.', 3),
  ('Google Ads', 'Search and other Google campaigns, from keywords to conversions.', 4),
  ('Content & social', 'Posts, reels and a content plan, made faster with AI tools.', 5),
  ('Email & WhatsApp', 'Reach customers directly with email and WhatsApp marketing.', 6),
  ('Analytics', 'Measure what works and make decisions from the numbers.', 7),
  ('AI automation', 'Automate repeat marketing work with AI the way agencies do today.', 8)
) as m(title, summary, sort);
