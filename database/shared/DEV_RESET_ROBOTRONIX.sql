-- ROBOTRONIX DEV RESET — APP DATABASE OBJECTS + ALL pg_cron JOBS
-- DO NOT RUN IN PRODUCTION OR A SHARED SUPABASE PROJECT.
-- This deletes ALL objects/data inside public, tasks, connect.
-- It also unschedules ALL pg_cron jobs in this DEV database, including unrelated jobs.
-- It does NOT delete Auth users, Storage buckets/files, Edge Functions, Netlify jobs,
-- project secrets, or external integrations. Use the relevant admin APIs for those.
-- IMPORTANT: dropping public CASCADE can remove public-schema extensions / other apps.
--
-- STEP 1: Verify your Supabase SQL Editor is connected to your disposable DEV.
-- STEP 2: Back up needed data. Disable all Netlify / external workers.
-- STEP 3: Replace REPLACE_TO_CONFIRM_DEV_RESET below with RESET_ROBOTRONIX_DEV.
-- STEP 4: Run the entire file. Never run it in Production.
BEGIN;

DO $dev_reset_confirmation$
BEGIN
 IF 'REPLACE_TO_CONFIRM_DEV_RESET' <> 'RESET_ROBOTRONIX_DEV' THEN
  RAISE EXCEPTION 'DEV reset refused: edit the explicit confirmation token in this SQL file';
 END IF;
END $dev_reset_confirmation$;

-- Unschedule DB-owned cron jobs via supported pg_cron API; never DROP cron schema.
DO $reset_jobs$
DECLARE job record;
BEGIN
 IF to_regclass('cron.job') IS NOT NULL THEN
  FOR job IN SELECT jobid FROM cron.job LOOP
   PERFORM cron.unschedule(job.jobid);
  END LOOP;
 END IF;
END $reset_jobs$;

-- Drop app schemas and their dependent objects, including app triggers
-- attached to other tables (where PostgreSQL tracks dependencies).
DROP SCHEMA IF EXISTS tasks CASCADE;
DROP SCHEMA IF EXISTS connect CASCADE;
DROP SCHEMA IF EXISTS public CASCADE;

CREATE SCHEMA public;
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres, service_role;

COMMIT;

-- Read-only checks: expected values are false/zero.
SELECT
 to_regnamespace('tasks') IS NOT NULL AS tasks_still_present,
 to_regnamespace('connect') IS NOT NULL AS crm_still_present,
 to_regclass('public.profiles') IS NOT NULL AS portal_profiles_still_present;
-- If the pg_cron extension is installed, inspect its Jobs page to confirm zero jobs.
