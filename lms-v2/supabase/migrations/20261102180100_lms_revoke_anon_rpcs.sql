-- Supabase grants EXECUTE to anon by default; these RPCs are for signed-in students only.
revoke execute on function public.lms_my_lessons(uuid), public.lms_join(uuid), public.lms_claim_certificate(uuid) from anon;
revoke execute on function lms_private.enrolment_of(uuid, uuid), lms_private.balance(uuid), lms_private.fee_locked(uuid, uuid),
  lms_private.opens_at(uuid, uuid), lms_private.lesson_unlocked(uuid, uuid) from anon;
