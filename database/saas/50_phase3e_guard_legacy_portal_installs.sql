-- Phase 3E: enforce mapped CRM↔Academy activation at the database write boundary.
-- Protects direct service RPC callers, including legacy bridge installer paths.
BEGIN;
CREATE OR REPLACE FUNCTION connect.guard_portal_install_tenant_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
DECLARE v_org uuid;
BEGIN
 IF NEW.installed_by IS NULL THEN RAISE EXCEPTION 'Integration owner required' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM connect.memberships m JOIN connect.tenants t ON t.id=m.tenant_id
  WHERE m.tenant_id=NEW.tenant_id AND m.user_id=NEW.installed_by
   AND m.status='active' AND m.role IN ('owner','admin') AND t.status IN ('active','trial'))
 OR NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=NEW.installed_by AND p.role='admin' AND p.active)
 THEN RAISE EXCEPTION 'CRM Portal dual administrator required' USING ERRCODE='42501';END IF;
 SELECT organization_id INTO v_org FROM saas.legacy_tenant_links WHERE crm_tenant_id=NEW.tenant_id;
 IF v_org IS NOT NULL THEN
  IF NOT EXISTS(SELECT 1 FROM saas.memberships m
   JOIN saas.organizations o ON o.id=m.organization_id AND o.status='active'
   JOIN saas.module_entitlements e ON e.organization_id=o.id
   WHERE m.organization_id=v_org AND m.user_id=NEW.installed_by
    AND m.status='active' AND m.role_key IN ('owner','admin')
    AND e.module_key='academy' AND e.enabled)
  THEN RAISE EXCEPTION 'Mapped SaaS admin/Academy entitlement required' USING ERRCODE='42501';END IF;
 ELSIF NEW.status='active' THEN
  IF EXISTS(SELECT 1 FROM saas.memberships WHERE user_id=NEW.installed_by)
  OR EXISTS(SELECT 1 FROM saas.user_membership_history WHERE user_id=NEW.installed_by)
  THEN RAISE EXCEPTION 'SaaS CRM tenant mapping required' USING ERRCODE='42501';END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('saas:crm-portal-install',0));
  IF EXISTS(SELECT 1 FROM connect.portal_demo_integrations i
   LEFT JOIN saas.legacy_tenant_links l ON l.crm_tenant_id=i.tenant_id
   WHERE i.status='active' AND i.tenant_id<>NEW.tenant_id AND l.organization_id IS NULL)
  THEN RAISE EXCEPTION 'Legacy Portal already connected' USING ERRCODE='23505';END IF;
 END IF;
 RETURN NEW;
END $fn$;
DROP TRIGGER IF EXISTS guard_portal_install_tenant_v1 ON connect.portal_demo_integrations;
CREATE TRIGGER guard_portal_install_tenant_v1 BEFORE INSERT OR UPDATE OF status,installed_by
ON connect.portal_demo_integrations FOR EACH ROW EXECUTE FUNCTION connect.guard_portal_install_tenant_v1();
REVOKE ALL ON FUNCTION connect.guard_portal_install_tenant_v1() FROM PUBLIC,anon,authenticated;
COMMIT;
