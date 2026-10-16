-- Robotronix™ Learning Portal — Production v1.0.0
-- DEVELOPMENT/QA ONLY. DESTRUCTIVE. DO NOT RUN ON PRODUCTION.
-- This removes only the public schema. Supabase auth/storage schemas are not dropped.

DO $$
BEGIN
  IF current_database() IS NULL THEN
    RAISE EXCEPTION 'Database connection unavailable';
  END IF;
END $$;

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres, service_role;

SELECT 'DEV public schema reset complete' AS status;
