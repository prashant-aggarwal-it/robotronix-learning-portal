-- Robotronix canonical install preflight. READ-ONLY. Execute before Tasks/CRM install.
-- Intended for an empty module setup inside an existing Portal database.
SELECT now() AS inspected_at,
 to_regclass('public.profiles') IS NOT NULL AS portal_profiles_present,
 to_regclass('public.onboarding_submissions') IS NOT NULL AS portal_onboarding_present,
 to_regnamespace('tasks') IS NULL AS tasks_absent,
 to_regnamespace('connect') IS NULL AS crm_absent;
DO $preflight$
BEGIN
 IF to_regclass('public.profiles') IS NULL OR to_regclass('public.onboarding_submissions') IS NULL
 THEN RAISE EXCEPTION 'Portal foundation must be installed first'; END IF;
 IF to_regnamespace('tasks') IS NOT NULL OR to_regnamespace('connect') IS NOT NULL
 THEN RAISE EXCEPTION 'Modules already exist. Do not rerun fresh installers'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role')
 THEN RAISE EXCEPTION 'Expected Supabase service_role not found'; END IF;
END $preflight$;
