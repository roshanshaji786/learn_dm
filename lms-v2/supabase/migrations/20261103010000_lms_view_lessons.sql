-- Admin "view as student": lesson states for any student, or for a brand-new student (p_user null = course preview).
create or replace function public.lms_view_lessons(p_course uuid, p_user uuid)
returns table (lesson_id uuid, opens_at timestamptz, unlocked boolean, fee_locked boolean, completed boolean, attended boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not lms_private.is_admin() then raise exception 'Admins only'; end if;
  if p_user is null then
    return query
      select x.id, x.o, x.o <= now(), false, false, false
      from (
        select l.id, l.sort, l.module_id,
          case l.unlock_mode
            when 'open' then now()
            when 'date' then coalesce(l.unlock_at, now())
            when 'days' then now() + make_interval(days => coalesce(l.unlock_days, 0))
            when 'before_class' then coalesce(l.live_start - interval '1 hour', now())
          end as o
        from public.lms_lessons l where l.course_id = p_course and l.published
      ) x;
  else
    return query
      select l.id,
             lms_private.opens_at(l.id, p_user),
             lms_private.lesson_unlocked(l.id, p_user),
             lms_private.fee_locked(p_user, p_course),
             exists (select 1 from public.lms_progress p where p.lesson_id = l.id and p.user_id = p_user),
             exists (select 1 from public.lms_attendance a where a.lesson_id = l.id and a.user_id = p_user)
      from public.lms_lessons l where l.course_id = p_course and l.published;
  end if;
end $$;
revoke all on function public.lms_view_lessons(uuid, uuid) from public, anon;
grant execute on function public.lms_view_lessons(uuid, uuid) to authenticated;
