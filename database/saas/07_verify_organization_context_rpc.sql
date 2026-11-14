-- Read-only authorization contract verification for server-side organization context.
DO $guard$ BEGIN
 IF to_regprocedure('public.saas_authorized_organizations(uuid)') IS NULL THEN
  RAISE EXCEPTION 'SaaS RPC missing';
 END IF;
 IF has_function_privilege('anon','public.saas_authorized_organizations(uuid)','EXECUTE') OR
    has_function_privilege('authenticated','public.saas_authorized_organizations(uuid)','EXECUTE') THEN
  RAISE EXCEPTION 'SaaS membership RPC publicly accessible';
 END IF;
 IF NOT has_function_privilege('service_role','public.saas_authorized_organizations(uuid)','EXECUTE') THEN
  RAISE EXCEPTION 'SaaS membership RPC not executable by service_role';
 END IF;
 IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='saas' AND c.relkind IN ('r','p')) <> 13 THEN
  RAISE EXCEPTION 'SaaS catalog unexpectedly changed';
 END IF;
END $guard$;
