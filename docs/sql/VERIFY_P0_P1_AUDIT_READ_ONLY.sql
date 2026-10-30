-- Read-only P0/P1 audit readiness report. Safe on PROD and DEV.
WITH expected(table_name,priority) AS (
 VALUES
 ('onboarding_submissions','P0'),('enrollments','P0'),('enrollment_holds','P0'),
 ('schedule_events','P0'),('class_attendance','P0'),('trainer_availability','P0'),
 ('trainer_availability_overrides','P0'),('trainer_earnings','P0'),
 ('trainer_payouts','P0'),('student_fee_packages','P0'),('student_fee_payments','P0'),
 ('students','P1'),('parents','P1'),('profiles','P1'),('student_guardians','P1'),
 ('parent_students','P1'),('learning_observations','P1'),
 ('learning_observation_internal_notes','P1'),('courses','P1'),('cohorts','P1'),
 ('trainer_courses','P1'),('trainers','P1'),('zoom_meetings','P1'),
 ('zoom_recordings','P1'),('student_invoices','P1'),('portal_access_requests','P1')
)
SELECT e.priority,e.table_name,
       to_regclass('public.'||e.table_name) IS NOT NULL AS table_present,
       EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
              JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relname=e.table_name
                AND t.tgname='audit_'||e.table_name
                AND NOT t.tgisinternal AND t.tgenabled<>'D') AS audit_trigger_enabled
FROM expected e ORDER BY e.priority,e.table_name;

SELECT policyname,cmd,roles,qual,with_check
FROM pg_policies WHERE schemaname='public' AND tablename='portal_audit_log'
ORDER BY policyname;
