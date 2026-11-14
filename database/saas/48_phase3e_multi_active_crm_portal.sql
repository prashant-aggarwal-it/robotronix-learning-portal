-- Phase 3E: explicit tenant-scoped CRM↔Academy activation.
-- The legacy installation is serialized and limited to one active unmapped tenant.
BEGIN;
CREATE OR REPLACE FUNCTION public.saas_crm_portal_install_v1(
 p_actor_id uuid,p_tenant_id uuid,p_status text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE v_org uuid;v_role text;v_count integer;
BEGIN
 IF p_actor_id IS NULL OR p_tenant_id IS NULL OR p_status NOT IN ('active','disabled') THEN
  RAISE EXCEPTION 'Invalid installation request' USING ERRCODE='22023';END IF;
 -- Serialize all activation and mapping decisions, including legacy fallback.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('saas:crm-portal-install',0));
 IF NOT EXISTS (
  SELECT 1 FROM connect.memberships m JOIN connect.tenants t ON t.id=m.tenant_id
  WHERE m.user_id=p_actor_id AND m.tenant_id=p_tenant_id
   AND m.role IN ('owner','admin') AND m.status='active' AND t.status IN ('active','trial')
 ) OR NOT EXISTS(
  SELECT 1 FROM public.profiles p WHERE p.id=p_actor_id AND p.role='admin' AND p.active
 ) THEN RAISE EXCEPTION 'CRM and Portal admin permission required' USING ERRCODE='42501';END IF;
 SELECT organization_id INTO v_org FROM saas.legacy_tenant_links WHERE crm_tenant_id=p_tenant_id;
 IF v_org IS NOT NULL THEN
  IF NOT EXISTS(
   SELECT 1 FROM saas.memberships m
   JOIN saas.organizations o ON o.id=m.organization_id AND o.status='active'
   JOIN saas.module_entitlements ent ON ent.organization_id=m.organization_id
   WHERE m.organization_id=v_org AND m.user_id=p_actor_id AND m.status='active'
    AND m.role_key IN ('owner','admin') AND ent.module_key='academy' AND ent.enabled
  ) THEN RAISE EXCEPTION 'Mapped Academy organization access denied' USING ERRCODE='42501';END IF;
 ELSIF p_status='active' THEN
  -- Prevent old shared-Portal tenant access from bypassing mapped SaaS boundaries.
  IF EXISTS(SELECT 1 FROM saas.memberships WHERE user_id=p_actor_id) OR
   EXISTS(SELECT 1 FROM saas.user_membership_history WHERE user_id=p_actor_id) THEN
   RAISE EXCEPTION 'SaaS CRM tenant mapping required' USING ERRCODE='42501';
  END IF;
  SELECT count(*) INTO v_count FROM connect.portal_demo_integrations i
  LEFT JOIN saas.legacy_tenant_links l ON l.crm_tenant_id=i.tenant_id
  WHERE i.status='active' AND i.tenant_id<>p_tenant_id AND l.organization_id IS NULL;
  IF v_count>0 THEN RAISE EXCEPTION 'Legacy Portal already connected' USING ERRCODE='23505';END IF;
 END IF;
 INSERT INTO connect.portal_demo_integrations(tenant_id,status,installed_by)
 VALUES(p_tenant_id,p_status,p_actor_id)
 ON CONFLICT(tenant_id) DO UPDATE SET status=excluded.status,
  installed_by=excluded.installed_by,updated_at=now();
 RETURN jsonb_build_object('ok',true,'status',p_status,'organizationId',v_org);
END $fn$;
REVOKE ALL ON FUNCTION public.saas_crm_portal_install_v1(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.saas_crm_portal_install_v1(uuid,uuid,text) TO service_role;

-- All activation writes must be routed through the secure installer above.
DROP INDEX IF EXISTS connect.connect_portal_single_active_integration;
CREATE INDEX IF NOT EXISTS portal_demo_integrations_active_by_tenant
 ON connect.portal_demo_integrations(tenant_id) WHERE status='active';
COMMIT;
