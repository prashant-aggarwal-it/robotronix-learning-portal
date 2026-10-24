-- Robotronix production parity audit — READ ONLY.
-- Run in Supabase SQL Editor against the EXISTING project before any QA seed.
-- Inspect results and compare with the effective schema, including later ALTER TABLEs.
-- This query does not alter any data or permissions.
WITH targets(table_name) AS (
  VALUES ('profiles'),('parents'),('parent_students'),('trainers'),('students'),
    ('student_guardians'),('courses'),('trainer_courses'),('cohorts'),
    ('enrollments'),('schedule_events'),('trainer_availability'),
    ('class_attendance'),('learning_observations'),('trainer_feedback'),
    ('learner_projects'),('onboarding_submissions'),('communication_threads'),
    ('communication_messages'),('portal_notifications'),('student_fee_packages'),
    ('trainer_compensation_plans')
)
SELECT t.table_name,
       CASE WHEN c.table_name IS NULL THEN 'MISSING_TABLE'
            WHEN c.is_nullable='NO' AND c.column_default IS NULL
                 AND c.is_identity='NO' AND c.is_generated='NEVER'
            THEN 'MANDATORY_EXPLICIT_VALUE'
            ELSE 'OTHER_COLUMN' END AS audit_status,
       c.ordinal_position,c.column_name,c.data_type,c.udt_name,
       c.is_nullable,c.column_default,c.is_identity,c.is_generated
FROM targets t
LEFT JOIN information_schema.columns c
 ON c.table_schema='public' AND c.table_name=t.table_name
ORDER BY t.table_name,c.ordinal_position NULLS FIRST;

-- The complete constraints on these tables, including CHECK and FK constraints.
SELECT con.conrelid::regclass::text AS table_name,con.conname AS constraint_name,
       con.contype AS constraint_type,pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
WHERE con.connamespace='public'::regnamespace
  AND con.conrelid::regclass::text = ANY(ARRAY[
    'courses','enrollments','students','trainers','schedule_events',
    'communication_threads','student_fee_packages','onboarding_submissions',
    'public.courses','public.enrollments','public.students','public.trainers',
    'public.schedule_events','public.communication_threads',
    'public.student_fee_packages','public.onboarding_submissions'
  ])
ORDER BY table_name,constraint_name;

-- IMPORTANT: This checks presence, NOT correctness of function definitions.
SELECT to_regprocedure('public.notify_admin_on_onboarding_submission()') AS onboarding_notification_function,
       EXISTS(SELECT 1 FROM pg_trigger
              WHERE tgrelid=to_regclass('public.onboarding_submissions')
                AND tgname='onboarding_submission_admin_notification_trg'
                AND NOT tgisinternal) AS onboarding_notification_trigger;
