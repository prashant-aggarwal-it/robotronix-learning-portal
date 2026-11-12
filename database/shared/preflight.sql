-- Read-only Supabase database prerequisite check for independent Tasks / CRM installs.
-- Each module's CREATE SCHEMA script independently rejects an existing module schema.
SELECT now() AS inspected_at,
 to_regclass('auth.users') IS NOT NULL AS supabase_auth_present,
 EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') AS server_role_present,
 to_regnamespace('tasks') IS NOT NULL AS tasks_already_installed,
 to_regnamespace('connect') IS NOT NULL AS crm_already_installed;
DO $preflight$ BEGIN
 IF to_regclass('auth.users') IS NULL THEN
  RAISE EXCEPTION 'Supabase Auth schema required';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  RAISE EXCEPTION 'Supabase service_role required';
 END IF;
END $preflight$;
-- No Portal public tables are needed for standalone Tasks/CRM installation.
