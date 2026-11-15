-- Phase 3G anonymous authorization-helper smoke test. DEV/staging only.
-- No persistent changes: all statements run in a read-only transaction.
-- A successful result requires every check to be true.
BEGIN READ ONLY;
SET LOCAL ROLE anon;
SELECT 'anonymous auth.uid absent' AS check_name, auth.uid() IS NULL AS passed
UNION ALL SELECT 'current role absent',public.current_role() IS NULL
UNION ALL SELECT 'admin denied',coalesce(NOT public.is_admin(),true)
UNION ALL SELECT 'parent absent',public.current_parent_id() IS NULL
UNION ALL SELECT 'trainer absent',public.current_trainer_id() IS NULL
UNION ALL SELECT 'student access denied',NOT coalesce(public.can_read_student('00000000-0000-0000-0000-000000000000'::uuid),false)
UNION ALL SELECT 'course access denied',NOT coalesce(public.can_read_course('00000000-0000-0000-0000-000000000000'::uuid),false)
UNION ALL SELECT 'trainer access denied',NOT coalesce(public.can_read_trainer('00000000-0000-0000-0000-000000000000'::uuid),false)
UNION ALL SELECT 'own student denied',NOT coalesce(public.is_own_student('00000000-0000-0000-0000-000000000000'::uuid),false)
UNION ALL SELECT 'parent student denied',NOT coalesce(public.is_parent_of_student('00000000-0000-0000-0000-000000000000'::uuid),false)
UNION ALL SELECT 'trainer student denied',NOT coalesce(public.is_trainer_of_student('00000000-0000-0000-0000-000000000000'::uuid),false)
UNION ALL SELECT 'trainer course denied',NOT coalesce(public.is_trainer_assigned_to_course('00000000-0000-0000-0000-000000000000'::uuid),false)
UNION ALL SELECT 'student course denied',NOT coalesce(public.is_student_enrolled_in_course('00000000-0000-0000-0000-000000000000'::uuid),false)
UNION ALL SELECT 'student trainer denied',NOT coalesce(public.is_student_linked_to_trainer('00000000-0000-0000-0000-000000000000'::uuid),false)
UNION ALL SELECT 'parent trainer denied',NOT coalesce(public.is_parent_linked_to_trainer('00000000-0000-0000-0000-000000000000'::uuid),false)
UNION ALL SELECT 'parent course denied',NOT coalesce(public.is_parent_linked_to_course('00000000-0000-0000-0000-000000000000'::uuid),false);
ROLLBACK;
-- This tests zero-identity behavior only; it does not prove a valid foreign record cannot be accessed.
