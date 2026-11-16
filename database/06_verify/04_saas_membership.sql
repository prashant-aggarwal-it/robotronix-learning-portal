-- Read-only Phase 3C readiness/security checks; no data mutation.
SELECT p.proname,p.prosecdef,
 has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
 has_function_privilege('service_role',p.oid,'EXECUTE') AS service_execute
FROM pg_proc p
WHERE p.oid='public.saas_manage_membership_v1(uuid,uuid,uuid,text,text)'::regprocedure;
SELECT t.tgname,t.tgenabled FROM pg_trigger t
WHERE t.tgrelid='saas.memberships'::regclass AND t.tgname='memberships_last_owner_guard';
SELECT count(*) AS active_organizations_missing_owner FROM saas.organizations o
WHERE o.status='active' AND EXISTS(SELECT 1 FROM saas.memberships m WHERE m.organization_id=o.id)
AND NOT EXISTS(SELECT 1 FROM saas.memberships m WHERE m.organization_id=o.id AND m.status='active' AND m.role_key='owner');
