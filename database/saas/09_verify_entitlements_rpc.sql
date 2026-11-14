-- Read-only verification of entitlement function privileges and private schema state.
DO $check$ BEGIN
 IF to_regprocedure('public.saas_authorized_module_entitlements(uuid,uuid)') IS NULL THEN
  RAISE EXCEPTION 'Entitlement RPC missing';
 END IF;
 IF has_function_privilege('anon','public.saas_authorized_module_entitlements(uuid,uuid)','EXECUTE')
 OR has_function_privilege('authenticated','public.saas_authorized_module_entitlements(uuid,uuid)','EXECUTE')
 OR NOT has_function_privilege('service_role','public.saas_authorized_module_entitlements(uuid,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'Entitlement RPC privilege policy violation'; END IF;
 IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname IN ('lms','assessment','gamification','certificates','analytics','operations','ai') AND c.relkind IN ('r','p'))<>35 THEN
  RAISE EXCEPTION 'Future modules catalog changed'; END IF;
END $check$;