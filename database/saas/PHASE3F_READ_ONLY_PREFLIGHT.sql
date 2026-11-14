-- Phase 3F read-only verification. Run in DEV or an explicitly authorized staging clone.
-- NEVER changes data, roles, grants, schemas or production settings.
SELECT 'tenant scoped installation' AS check_name,
 to_regprocedure('public.saas_crm_portal_install_v1(uuid,uuid,text)') IS NOT NULL AS passed
UNION ALL SELECT 'tenant scoped access',to_regprocedure('public.saas_crm_portal_access_v1(uuid,uuid)') IS NOT NULL
UNION ALL SELECT 'three customer installation trigger', EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='guard_portal_install_tenant_v1' AND NOT tgisinternal)
UNION ALL SELECT 'enrollment ownership trigger',EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='guard_portal_handoff_tenant_v1' AND NOT tgisinternal)
UNION ALL SELECT 'demo ownership trigger',EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='guard_portal_demo_tenant_v1' AND NOT tgisinternal)
UNION ALL SELECT 'legacy global unique restriction removed', NOT EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='connect' AND indexname='connect_portal_single_active_integration')
UNION ALL SELECT 'scoped tenant active index', EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='connect' AND indexname='portal_demo_integrations_active_by_tenant')
UNION ALL SELECT 'tenant integration RPC denies anonymous execute',NOT has_function_privilege('anon','public.saas_crm_portal_install_v1(uuid,uuid,text)','EXECUTE')
UNION ALL SELECT 'tenant integration RPC denies authenticated execute',NOT has_function_privilege('authenticated','public.saas_crm_portal_install_v1(uuid,uuid,text)','EXECUTE')
UNION ALL SELECT 'tenant access RPC denies anonymous execute', NOT has_function_privilege('anon','public.saas_crm_portal_access_v1(uuid,uuid)','EXECUTE')
UNION ALL SELECT 'tenant access RPC denies authenticated execute', NOT has_function_privilege('authenticated','public.saas_crm_portal_access_v1(uuid,uuid)','EXECUTE');
