-- Phase 3G: anonymous access checks against existing DEV/staging records.
-- READ ONLY. Uses dynamic samples, not hardcoded fixture identifiers.
-- Requires at least one student, course and trainer for meaningful coverage.
BEGIN READ ONLY;
DO $check$
DECLARE
 v_student uuid;
 v_course uuid;
 v_trainer uuid;
BEGIN
 SELECT id INTO v_student FROM public.students LIMIT 1;
 SELECT id INTO v_course FROM public.courses LIMIT 1;
 SELECT id INTO v_trainer FROM public.trainers LIMIT 1;
 IF v_student IS NULL OR v_course IS NULL OR v_trainer IS NULL THEN
   RAISE EXCEPTION 'Required real-record fixture missing; test cannot certify';
 END IF;
 -- Execute as anonymous, retaining an independent catalog sample selected above.
 EXECUTE 'SET LOCAL ROLE anon';
 IF auth.uid() IS NOT NULL
 OR coalesce(public.can_read_student(v_student),false)
 OR coalesce(public.can_read_course(v_course),false)
 OR coalesce(public.can_read_trainer(v_trainer),false)
 OR coalesce(public.is_own_student(v_student),false)
 OR coalesce(public.is_parent_of_student(v_student),false)
 THEN RAISE EXCEPTION 'Anonymous access regression: real Academy resource became accessible'; END IF;
 RAISE NOTICE 'PASS: anon denied sampled real student, course, trainer and ownership checks';
END $check$;
ROLLBACK;
-- Does not establish complete coverage of every row, API endpoint or role.
