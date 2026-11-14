-- SaaS-only CRM → Academy trainer visibility and booking boundary.
-- Non-SaaS CRM+Portal implementations retain their historical active trainer pool.
CREATE OR REPLACE FUNCTION public.saas_crm_portal_trainers_v1(p_actor_id uuid,p_tenant_id uuid)
RETURNS TABLE(id uuid,full_name text,specialties text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $fn$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM connect.memberships cm JOIN connect.tenants ct ON ct.id=cm.tenant_id
  WHERE cm.user_id=p_actor_id AND cm.tenant_id=p_tenant_id AND cm.status='active'
    AND ct.status IN ('active','trial')) THEN
  RAISE EXCEPTION 'CRM membership required' USING ERRCODE='42501';
 END IF;
 IF EXISTS(SELECT 1 FROM saas.legacy_tenant_links WHERE crm_tenant_id=p_tenant_id) THEN
  RETURN QUERY SELECT tr.id,tr.full_name,tr.specialties FROM saas.legacy_tenant_links l
  JOIN saas.organizations org ON org.id=l.organization_id AND org.status='active'
  JOIN saas.memberships sm ON sm.organization_id=org.id
    AND sm.user_id=p_actor_id AND sm.status='active'
  JOIN saas.module_entitlements e ON e.organization_id=org.id
    AND e.module_key='academy' AND e.enabled
  JOIN saas.academy_trainers at ON at.organization_id=org.id
  JOIN public.trainers tr ON tr.id=at.trainer_id AND tr.record_status='active'
  WHERE l.crm_tenant_id=p_tenant_id ORDER BY tr.full_name;
 ELSE
  RETURN QUERY SELECT tr.id,tr.full_name,tr.specialties FROM public.trainers tr
  WHERE tr.record_status='active' AND tr.saas_org_id IS NULL ORDER BY tr.full_name;
 END IF;
END $fn$;
REVOKE ALL ON FUNCTION public.saas_crm_portal_trainers_v1(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.saas_crm_portal_trainers_v1(uuid,uuid) TO service_role;