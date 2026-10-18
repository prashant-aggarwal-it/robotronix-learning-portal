-- ARCHIVED LEGACY SCRIPT. DO NOT EXECUTE AS PART OF CURRENT INSTALLATION.
-- ============================================================================
-- Robotronix™ Learning Portal — PRODUCTION SANITY CLEANUP
-- Removes the deterministic synthetic records created by 01_PROD_SANITY_SEED.sql.
-- Run this BEFORE `npm run sanity:delete-users`.
-- This does not touch real production records or connected Zoom host accounts.
-- ============================================================================

-- Robotronix™ Learning Portal — Production v1.0.0
-- PRODUCTION SANITY CLEANUP.

-- Robotronix Learning Portal — Production sanity cleanup (corrected)
-- Use ONLY if this tested Supabase project will become the real production project.
--
-- Why this order matters:
-- Deleting class_attendance fires the trainer-earning sync trigger for conducted
-- classes. Therefore attendance/progress must be removed BEFORE trainer_earnings.
--
-- Order after this SQL:
--   npm run sanity:delete-users

begin;

-- ------------------------------------------------------------
-- 1) Remove learner/progress records first
-- ------------------------------------------------------------

delete from public.learning_observation_internal_notes
where enrollment_id='e0000000-0000-4000-8000-000000000001'
   or student_id='d0000000-0000-4000-8000-000000000001'
   or schedule_event_id in (
     'f0000000-0000-4000-8000-000000000001',
     'f0000000-0000-4000-8000-000000000002'
   );

delete from public.learning_observations
where enrollment_id='e0000000-0000-4000-8000-000000000001'
   or student_id='d0000000-0000-4000-8000-000000000001'
   or schedule_event_id in (
     'f0000000-0000-4000-8000-000000000001',
     'f0000000-0000-4000-8000-000000000002'
   );

delete from public.trainer_feedback
where enrollment_id='e0000000-0000-4000-8000-000000000001'
   or student_id='d0000000-0000-4000-8000-000000000001';

delete from public.learner_projects
where enrollment_id='e0000000-0000-4000-8000-000000000001'
   or student_id='d0000000-0000-4000-8000-000000000001';

delete from public.session_records
where enrollment_id='e0000000-0000-4000-8000-000000000001'
   or student_id='d0000000-0000-4000-8000-000000000001';

delete from public.enrollment_holds
where enrollment_id='e0000000-0000-4000-8000-000000000001';

-- ------------------------------------------------------------
-- 2) Attendance BEFORE earnings
--    Attendance deletion may recreate/recalculate an earning.
-- ------------------------------------------------------------

delete from public.class_attendance
where enrollment_id='e0000000-0000-4000-8000-000000000001'
   or student_id='d0000000-0000-4000-8000-000000000001'
   or schedule_event_id in (
     'f0000000-0000-4000-8000-000000000001',
     'f0000000-0000-4000-8000-000000000002'
   );

-- Now remove any earning recreated by the attendance trigger.
delete from public.trainer_earnings
where schedule_event_id in (
  'f0000000-0000-4000-8000-000000000001',
  'f0000000-0000-4000-8000-000000000002'
)
or trainer_id='a0000000-0000-4000-8000-000000000001';

delete from public.trainer_payouts
where trainer_id='a0000000-0000-4000-8000-000000000001';

-- ------------------------------------------------------------
-- 3) Portal access and scheduled classes
-- ------------------------------------------------------------

delete from public.portal_access_requests
where (target_type='trainer' and target_id='a0000000-0000-4000-8000-000000000001')
   or (target_type='student' and target_id='d0000000-0000-4000-8000-000000000001')
   or login_email in (
     'prod-sanity-admin@robotronix.local',
     'prod-sanity-trainer@robotronix.local',
     'prod-sanity-parent@robotronix.local',
     'prod-sanity-student@robotronix.local'
   );

delete from public.schedule_events
where id in (
  'f0000000-0000-4000-8000-000000000001',
  'f0000000-0000-4000-8000-000000000002'
)
or enrollment_id='e0000000-0000-4000-8000-000000000001';

-- Payroll defaults can be auto-created when earnings are generated.
delete from public.trainer_compensation_plans
where trainer_id='a0000000-0000-4000-8000-000000000001';

delete from public.trainer_finance
where trainer_id='a0000000-0000-4000-8000-000000000001';

-- ------------------------------------------------------------
-- 4) Relationship records
-- ------------------------------------------------------------

delete from public.parent_students
where parent_id='b0000000-0000-4000-8000-000000000001'
   or student_id='d0000000-0000-4000-8000-000000000001';

delete from public.student_guardians
where student_id='d0000000-0000-4000-8000-000000000001';

delete from public.trainer_courses
where trainer_id='a0000000-0000-4000-8000-000000000001'
   or course_id='c0000000-0000-4000-8000-000000000001';

-- ------------------------------------------------------------
-- 5) Core operational records
-- ------------------------------------------------------------

delete from public.enrollments
where id='e0000000-0000-4000-8000-000000000001'
   or student_id='d0000000-0000-4000-8000-000000000001';

delete from public.students
where id='d0000000-0000-4000-8000-000000000001';

delete from public.parents
where id='b0000000-0000-4000-8000-000000000001';

delete from public.trainers
where id='a0000000-0000-4000-8000-000000000001';

delete from public.courses
where id='c0000000-0000-4000-8000-000000000001';

-- ------------------------------------------------------------
-- 6) Production sanity profiles
--    Auth users are removed separately with npm run sanity:delete-users
-- ------------------------------------------------------------

delete from public.profiles
where id in (
  select id
  from auth.users
  where email in (
    'prod-sanity-admin@robotronix.local',
    'prod-sanity-trainer@robotronix.local',
    'prod-sanity-parent@robotronix.local',
    'prod-sanity-student@robotronix.local'
  )
);

-- ------------------------------------------------------------
-- 7) Remove deterministic Production sanity audit traces
-- ------------------------------------------------------------

delete from public.portal_audit_log
where entity_id in (
  'a0000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000001',
  'c0000000-0000-4000-8000-000000000001',
  'd0000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000001',
  'f0000000-0000-4000-8000-000000000001',
  'f0000000-0000-4000-8000-000000000002'
)
or coalesce(before_data::text,'') ilike '%qa-%@robotronix.local%'
or coalesce(after_data::text,'') ilike '%qa-%@robotronix.local%';

commit;

-- ------------------------------------------------------------
-- Verification
-- ------------------------------------------------------------

select 'profiles' as item, count(*)::int as remaining
from public.profiles
where id in (
  select id from auth.users
  where email in (
    'prod-sanity-admin@robotronix.local',
    'prod-sanity-trainer@robotronix.local',
    'prod-sanity-parent@robotronix.local',
    'prod-sanity-student@robotronix.local'
  )
)

union all
select 'trainer', count(*)::int
from public.trainers
where id='a0000000-0000-4000-8000-000000000001'

union all
select 'parent', count(*)::int
from public.parents
where id='b0000000-0000-4000-8000-000000000001'

union all
select 'student', count(*)::int
from public.students
where id='d0000000-0000-4000-8000-000000000001'

union all
select 'course', count(*)::int
from public.courses
where id='c0000000-0000-4000-8000-000000000001'

union all
select 'enrollment', count(*)::int
from public.enrollments
where id='e0000000-0000-4000-8000-000000000001'

union all
select 'classes', count(*)::int
from public.schedule_events
where id in (
  'f0000000-0000-4000-8000-000000000001',
  'f0000000-0000-4000-8000-000000000002'
)

union all
select 'earnings', count(*)::int
from public.trainer_earnings
where trainer_id='a0000000-0000-4000-8000-000000000001';


-- Deterministic QA/SANITY cleanup safety net.
DELETE FROM public.student_invoices WHERE fee_package_id = 'b0000000-0000-4000-8000-000000000099';
DELETE FROM public.student_fee_packages WHERE id = 'b0000000-0000-4000-8000-000000000099';

-- Auth users are removed separately with: npm run sanity:delete-users
SELECT 'Production sanity database cleanup complete; remove sanity Auth users separately' AS status;
