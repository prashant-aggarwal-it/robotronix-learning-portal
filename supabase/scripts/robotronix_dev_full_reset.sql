-- Robotronix Education Suite — DEV ONLY destructive reset
-- Target DEV Supabase project: uzzuquxeeqonxeqcuohh
-- NEVER run on PROD: njyktzenybimykpqaegn
--
-- DANGER: Destroys application schemas, public application objects and Auth users.
-- Not a Supabase factory reset: does NOT remove Storage bytes/buckets, extensions,
-- Edge Functions, secrets, custom DB roles, project settings or migration history.
-- Before use: export any needed data; empty Storage via Supabase Storage API/dashboard.
-- CRITICAL: SQL Editor doesn't reliably expose the project ref. VERIFY the dashboard
-- project URL manually before changing the confirmation literal below.
-- This script is committed DISARMED and MUST remain that way in source control.
--
-- Run only as a privileged admin in the DEV SQL Editor.
BEGIN;
DO $reset$
DECLARE
  confirmation text := 'NO';
  app_schema record;
  leftover_count bigint;
BEGIN
  IF confirmation <> 'YES_RESET_DEV_DATABASE' THEN
    RAISE EXCEPTION 'RESET BLOCKED: Verify DEV project URL and explicitly arm a local copy.';
  END IF;
  IF to_regclass('storage.objects') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM storage.objects' INTO leftover_count;
    IF leftover_count > 0 THEN
      RAISE EXCEPTION 'RESET BLOCKED: % storage object rows remain; remove using Storage API first.', leftover_count;
    END IF;
  END IF;

  -- Application-owned schemas only; no accidental deletion of unrelated schemas.
  FOR app_schema IN
    SELECT nspname AS name
    FROM pg_namespace
    WHERE nspname IN ('saas','platform','academy','crm','tasks',
                      'connect','learning','operations','robotronix')
  LOOP
    RAISE NOTICE 'Dropping app schema %', app_schema.name;
    EXECUTE format('DROP SCHEMA %I CASCADE', app_schema.name);
  END LOOP;

  -- Remove non-extension-owned application relations in public.
  FOR app_schema IN
    SELECT c.relname AS name, c.relkind AS kind
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S','f')
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype='e'
      )
    ORDER BY CASE c.relkind WHEN 'v' THEN 0 WHEN 'm' THEN 1 ELSE 2 END
  LOOP
    EXECUTE format('DROP %s IF EXISTS public.%I CASCADE',
      CASE app_schema.kind
        WHEN 'v' THEN 'VIEW'
        WHEN 'm' THEN 'MATERIALIZED VIEW'
        WHEN 'S' THEN 'SEQUENCE'
        WHEN 'f' THEN 'FOREIGN TABLE'
        ELSE 'TABLE'
      END, app_schema.name);
  END LOOP;

  FOR app_schema IN
    SELECT p.proname AS name, pg_get_function_identity_arguments(p.oid) AS args,
           p.prokind AS kind
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public'
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e'
      )
  LOOP
    EXECUTE format('DROP %s IF EXISTS public.%I(%s) CASCADE',
      CASE app_schema.kind
        WHEN 'p' THEN 'PROCEDURE'
        WHEN 'a' THEN 'AGGREGATE'
        ELSE 'FUNCTION'
      END, app_schema.name, app_schema.args);
  END LOOP;

  FOR app_schema IN
    SELECT t.typname AS name, t.typtype AS kind
    FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
    WHERE n.nspname='public' AND t.typtype IN ('e','d','c','r')
      AND NOT EXISTS (SELECT 1 FROM pg_class c WHERE c.reltype=t.oid)
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.classid='pg_type'::regclass AND d.objid=t.oid AND d.deptype='e'
      )
  LOOP
    EXECUTE format('DROP %s IF EXISTS public.%I CASCADE',
      CASE app_schema.kind WHEN 'd' THEN 'DOMAIN' ELSE 'TYPE' END, app_schema.name);
  END LOOP;

  -- DELETE uses DB constraints and may be blocked by non-app dependencies.
  -- A failure rolls back the whole transaction; it is NOT a no-error promise.
  DELETE FROM auth.users;
  RAISE NOTICE 'DEV application reset completed. Check schemas and Auth user count.';
END
$reset$;
COMMIT;

-- Validation queries (run separately AFTER successfully executing armed copy):
-- SELECT nspname FROM pg_namespace WHERE nspname IN
--   ('saas','platform','academy','crm','tasks','connect','learning','operations','robotronix');
-- SELECT count(*) AS auth_users_remaining FROM auth.users;
