-- DEV ONLY. DESTRUCTIVE. Review and run in dedicated disposable DEV Supabase SQL editor.
-- This is a RESET OF APPLICATION SCHEMAS, NOT of Supabase-managed Auth, Storage, or project settings.
-- WARNING: Drops ALL public schema data including legacy profiles, SaaS organizations,
-- CRM, Tasks, and any other applications in those schemas. Also unschedules all pg_cron jobs.
-- Requires deliberate operator edit before execution. Never use on production.
BEGIN;
DO $guard$
BEGIN
 IF 'REPLACE_WITH_I_UNDERSTAND_DEV_DATA_LOSS' <> 'I_UNDERSTAND_DEV_DATA_LOSS' THEN
  RAISE EXCEPTION 'RESET REFUSED: confirm disposable DEV project, backup, then edit guard token';
 END IF;
END $guard$;
DO $cron$
DECLARE j record;
BEGIN
 IF to_regclass('cron.job') IS NOT NULL THEN
  FOR j IN SELECT jobid FROM cron.job LOOP
   PERFORM cron.unschedule(j.jobid);
  END LOOP;
 END IF;
END $cron$;
-- Drop SaaS first: its foreign keys, functions and triggers depend on application tables.
DROP SCHEMA IF EXISTS saas CASCADE;
DROP SCHEMA IF EXISTS ai CASCADE;
DROP SCHEMA IF EXISTS operations CASCADE;
DROP SCHEMA IF EXISTS tasks CASCADE;
DROP SCHEMA IF EXISTS connect CASCADE;
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT USAGE ON SCHEMA public TO postgres,anon,authenticated,service_role;
GRANT ALL ON SCHEMA public TO postgres,service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres,service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres,service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres,service_role;
COMMIT;
SELECT to_regnamespace('saas') IS NULL AS saas_absent,
       to_regnamespace('tasks') IS NULL AS tasks_absent,
       to_regnamespace('connect') IS NULL AS crm_absent,
       to_regclass('public.profiles') IS NULL AS legacy_profiles_absent;
-- Auth users: use reset-dev-auth-users.mjs separately AFTER checking their dependencies.
