-- DEV-ONLY APPLICATION SCHEMA RESET. NOT A SUPABASE PROJECT RESET.
-- Destructive: deletes Robotronix Portal/Tasks/CRM tables, functions and data.
-- Supabase Auth users and Storage contents are NOT deleted.
-- A dedicated DEV reset marker must be created deliberately beforehand.
-- NEVER enable the marker or run this file against production/shared projects.
-- Reset is not guaranteed to preserve all unrelated public-schema objects.
BEGIN;
-- Deliberately edit the next placeholder to DELETE_DEV_APP_DATA only after
-- independently verifying the exact dedicated DEV project in Supabase.
SELECT set_config('robotronix.confirm_full_dev_reset', 'REPLACE_WITH_EXPLICIT_CONFIRMATION', true);
DO $guard$
DECLARE v_env text; v_ref text;
BEGIN
 IF to_regclass('public.robotronix_dev_reset_marker') IS NULL THEN
   RAISE EXCEPTION 'RESET REFUSED: dedicated DEV reset marker is missing. Use a brand-new DEV project instead.';
 END IF;
 EXECUTE 'SELECT environment, project_ref FROM public.robotronix_dev_reset_marker LIMIT 1' INTO v_env,v_ref;
 IF v_env IS DISTINCT FROM 'development' OR v_ref IS NULL OR length(v_ref)<10
    OR v_ref='njyktzenybimykpqaegn' THEN
   RAISE EXCEPTION 'RESET REFUSED: expected confirmed nonproduction DEV marker';
 END IF;
 IF current_setting('robotronix.confirm_full_dev_reset',true) IS DISTINCT FROM 'DELETE_DEV_APP_DATA' THEN
   RAISE EXCEPTION 'RESET REFUSED: run only inside an explicitly approved DEV reset transaction with the confirmation setting';
 END IF;
END $guard$;

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
-- IMPORTANT: This reset does not remove Auth users, Storage objects, or pg_cron jobs.
