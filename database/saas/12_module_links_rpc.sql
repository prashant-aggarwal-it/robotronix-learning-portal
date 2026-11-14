-- Additive service-only organization-to-module linkage resolution.
-- The SaaS, CRM and Tasks schemas remain independent; no client access is granted.
BEGIN;
CREATE OR REPLACE FUNCTION public.saas_resolve_module_links(p_actor_id uuid,p_organization_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE crm_enabled boolean:=false;tasks_enabled boolean:=false;
 crm_id uuid;crm_valid boolean:=false; task_count integer:=0; task_items jsonb:='[]'::jsonb;
BEGIN
 IF p_actor_id IS NULL OR p_organization_id IS NULL OR NOT EXISTS(
  SELECT 1 FROM saas.memberships m JOIN saas.organizations o ON o.id=m.organization_id
  WHERE m.user_id=p_actor_id AND m.organization_id=p_organization_id
   AND m.status='active' AND o.status='active'
 ) THEN RAISE EXCEPTION 'Organization not accessible' USING ERRCODE='42501'; END IF;
 SELECT coalesce(max(CASE WHEN module_key='crm' THEN enabled::int END),0)=1,
        coalesce(max(CASE WHEN module_key='tasks' THEN enabled::int END),0)=1
 INTO crm_enabled,tasks_enabled FROM saas.module_entitlements
 WHERE organization_id=p_organization_id AND module_key IN ('crm','tasks');
 IF crm_enabled THEN
  SELECT l.crm_tenant_id INTO crm_id FROM saas.legacy_tenant_links l WHERE l.organization_id=p_organization_id;
  IF crm_id IS NOT NULL THEN
   SELECT EXISTS(SELECT 1 FROM connect.memberships m JOIN connect.tenants t ON t.id=m.tenant_id
    WHERE m.user_id=p_actor_id AND m.tenant_id=crm_id AND m.status='active'
     AND t.status IN ('active','trial')) INTO crm_valid;
  END IF;
 END IF;
 IF tasks_enabled THEN
  SELECT count(*),coalesce(jsonb_agg(jsonb_build_object('id',l.workspace_id,'role',m.role)), '[]'::jsonb)
    INTO task_count,task_items
  FROM saas.workspace_links l
  JOIN tasks.workspaces w ON w.id=l.workspace_id AND w.archived_at IS NULL
  JOIN tasks.workspace_members m ON m.workspace_id=l.workspace_id AND m.user_id=p_actor_id
  WHERE l.organization_id=p_organization_id;
 END IF;
 RETURN jsonb_build_object(
  'crm',jsonb_build_object('enabled',crm_enabled,
   'status',CASE WHEN NOT crm_enabled THEN 'disabled' WHEN crm_id IS NULL THEN 'unmapped'
    WHEN crm_valid THEN 'ready' ELSE 'access_denied' END,
   'tenantId',CASE WHEN crm_valid THEN crm_id ELSE NULL END),
  'tasks',jsonb_build_object('enabled',tasks_enabled,
   'status',CASE WHEN NOT tasks_enabled THEN 'disabled'
    WHEN task_count>0 THEN 'ready'
    WHEN EXISTS(SELECT 1 FROM saas.workspace_links WHERE organization_id=p_organization_id)
      THEN 'access_denied' ELSE 'unmapped' END,
   'workspaces',task_items));
END $fn$;
REVOKE ALL ON FUNCTION public.saas_resolve_module_links(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.saas_resolve_module_links(uuid,uuid) TO service_role;
COMMIT;
