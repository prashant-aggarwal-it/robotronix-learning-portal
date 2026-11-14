-- Phase 3C security hardening: deterministic search paths for invoker-only
-- legacy trigger functions; protect trigger-only DEFINER routines from RPC EXECUTE.
ALTER FUNCTION public.guard_course_delete() SET search_path = pg_catalog, public;
ALTER FUNCTION public.guard_student_delete() SET search_path = pg_catalog, public;
ALTER FUNCTION public.guard_enrollment_delete() SET search_path = pg_catalog, public;
ALTER FUNCTION public.guard_cohort_delete() SET search_path = pg_catalog, public;
ALTER FUNCTION public.guard_trainer_delete() SET search_path = pg_catalog, public;
ALTER FUNCTION public.guard_schedule_delete() SET search_path = pg_catalog, public;
ALTER FUNCTION public.enforce_new_enrollment_start_date() SET search_path = pg_catalog, public;
ALTER FUNCTION public.recalc_trainer_earning_manual() SET search_path = pg_catalog, public;
ALTER FUNCTION public.set_family_introduction_benefit() SET search_path = pg_catalog, public;
DO $privileges$
DECLARE f record;
BEGIN
 FOR f IN SELECT p.oid::regprocedure AS identity
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.prosecdef
    AND p.prorettype='pg_catalog.trigger'::regtype
 LOOP
  EXECUTE pg_catalog.format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated',f.identity);
 END LOOP;
END $privileges$;
-- Keep authenticated access for intentional trainer/Admin functions, never anonymous RPC access.
REVOKE EXECUTE ON FUNCTION public.review_trainer_finance_request(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_trainer_finance_request(uuid,text,text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.update_own_trainer_profile(text,text,text,text,text,text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_own_trainer_profile(text,text,text,text,text,text[]) TO authenticated;