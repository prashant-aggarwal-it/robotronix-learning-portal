-- Phase 3E: tenant-scoped access decision for active CRM→Portal integration.
BEGIN;
CREATE OR REPLACE FUNCTION public.saas_crm_portal_access_v1(p_actor_id uuid,p_tenant_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE v_org uuid;v_installer uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM connect.memberships m JOIN connect.tenants t ON t.id=m.tenant_id
   WHERE m.tenant_id=p_tenant_id AND m.user_id=p_actor_id AND m.status='active'
   AND t.status IN ('active','trial')) THEN RETURN false;END IF;
 SELECT organization_id INTO v_org FROM saas.legacy_tenant_links WHERE crm_tenant_id=p_tenant_id;
 IF v_org IS NULL THEN
  -- A SaaS member cannot access an unlinked CRM tenant as legacy Portal.
  IF EXISTS(SELECT 1 FROM saas.memberships WHERE user_id=p_actor_id)
  OR EXISTS(SELECT 1 FROM saas.user_membership_history WHERE user_id=p_actor_id)
  THEN RETURN false;END IF;
  RETURN true;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM saas.memberships m
   JOIN saas.organizations o ON o.id=m.organization_id AND o.status='active'
   JOIN saas.module_entitlements ent ON ent.organization_id=m.organization_id
   WHERE m.organization_id=v_org AND m.user_id=p_actor_id AND m.status='active'
     AND ent.module_key='academy' AND ent.enabled)
 THEN RETURN false;END IF;
 SELECT installed_by INTO v_installer FROM connect.portal_demo_integrations
  WHERE tenant_id=p_tenant_id AND status='active';
 IF v_installer IS NOT NULL AND NOT EXISTS(SELECT 1 FROM saas.memberships m
   WHERE m.organization_id=v_org AND m.user_id=v_installer
   AND m.status='active' AND m.role_key IN ('owner','admin'))
 THEN RETURN false;END IF;
 RETURN true;
END $fn$;
REVOKE ALL ON FUNCTION public.saas_crm_portal_access_v1(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.saas_crm_portal_access_v1(uuid,uuid) TO service_role;
COMMIT;