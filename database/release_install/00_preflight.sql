-- Robotronix manual SQL release: 00 read-only preflight.
-- Run on confirmed target BEFORE any installation. Requires existing Portal schema.
SELECT current_database() AS database_name, current_user AS sql_role, now() AS inspected_at,
  to_regclass('public.profiles') IS NOT NULL AS portal_profiles_present,
  to_regclass('public.onboarding_submissions') IS NOT NULL AS portal_onboarding_present,
  to_regnamespace('tasks') IS NULL AS tasks_not_installed,
  to_regnamespace('connect') IS NULL AS connect_not_installed,
  has_schema_privilege('service_role','public','USAGE') AS service_role_public_usage;
DO $preflight$ BEGIN
 IF to_regclass('public.profiles') IS NULL OR to_regclass('public.onboarding_submissions') IS NULL
 THEN RAISE EXCEPTION 'Portal foundation missing: use Portal fresh installer first'; END IF;
 IF to_regnamespace('tasks') IS NOT NULL OR to_regnamespace('connect') IS NOT NULL
 THEN RAISE EXCEPTION 'CRM or Tasks schema already exists: use an incremental migration, not this fresh-module bundle'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role')
 THEN RAISE EXCEPTION 'Supabase service_role is required'; END IF;
END $preflight$;
-- This script makes no schema or data changes.
