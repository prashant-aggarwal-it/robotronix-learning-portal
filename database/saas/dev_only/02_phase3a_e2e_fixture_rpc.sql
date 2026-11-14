-- DEV ONLY. Must never be included in canonical or production installers.
-- Extends existing temporary two-school fixtures with CRM and Tasks mappings.
BEGIN;
CREATE OR REPLACE FUNCTION public.saas_qa_phase3a_create(p_school_a uuid,p_school_b uuid,p_user_a uuid,p_user_b uuid,p_user_multi uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE ca uuid:=gen_random_uuid();cb uuid:=gen_random_uuid();wa uuid:=gen_random_uuid();wb uuid:=gen_random_uuid();u uuid;
BEGIN
 IF p_school_a IS NULL OR p_school_b IS NULL OR p_school_a=p_school_b THEN RAISE EXCEPTION 'Invalid synthetic organizations' USING ERRCODE='22023'; END IF;
 IF (SELECT count(*) FROM saas.organizations WHERE id IN (p_school_a,p_school_b) AND slug ~ '^saas-e2e-[ab]-[a-f0-9]{12}$')<>2 THEN
  RAISE EXCEPTION 'Only synthetic organizations allowed' USING ERRCODE='42501';
 END IF;
 FOREACH u IN ARRAY ARRAY[p_user_a,p_user_b,p_user_multi] LOOP
  IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=u AND lower(email) ~ '^saas-e2e-[a-z0-9-]+@example[.]invalid$') THEN
   RAISE EXCEPTION 'Only temporary test users allowed' USING ERRCODE='42501';
  END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM saas.memberships WHERE organization_id=p_school_a AND user_id=p_user_a AND status='active')
 OR NOT EXISTS(SELECT 1 FROM saas.memberships WHERE organization_id=p_school_b AND user_id=p_user_b AND status='active')
 OR (SELECT count(*) FROM saas.memberships WHERE user_id=p_user_multi AND organization_id IN (p_school_a,p_school_b) AND status='active')<>2 THEN
  RAISE EXCEPTION 'Synthetic memberships missing' USING ERRCODE='42501';
 END IF;
 INSERT INTO connect.tenants(id,slug,name) VALUES
 (ca,'saas-e2e-crm-a-'||left(replace(ca::text,'-',''),12),'SaaS E2E CRM A'),
 (cb,'saas-e2e-crm-b-'||left(replace(cb::text,'-',''),12),'SaaS E2E CRM B');
 INSERT INTO connect.memberships(tenant_id,user_id,role,status) VALUES
 (ca,p_user_a,'owner','active'),(cb,p_user_b,'owner','active'),
 (ca,p_user_multi,'viewer','active'),(cb,p_user_multi,'viewer','active');
 INSERT INTO tasks.workspaces(id,name,owner_user_id) VALUES
 (wa,'SaaS E2E Tasks A',p_user_a),(wb,'SaaS E2E Tasks B',p_user_b);
 INSERT INTO tasks.workspace_members(workspace_id,user_id,role) VALUES
 (wa,p_user_a,'owner'),(wb,p_user_b,'owner'),
 (wa,p_user_multi,'member'),(wb,p_user_multi,'member');
 INSERT INTO saas.legacy_tenant_links(organization_id,crm_tenant_id) VALUES
 (p_school_a,ca),(p_school_b,cb);
 INSERT INTO saas.workspace_links(workspace_id,organization_id) VALUES
 (wa,p_school_a),(wb,p_school_b);
 INSERT INTO saas.module_entitlements(organization_id,module_key,enabled) VALUES
 (p_school_a,'crm',true),(p_school_b,'crm',true),(p_school_a,'tasks',true),(p_school_b,'tasks',true);
 RETURN jsonb_build_object('crmA',ca,'crmB',cb,'tasksA',wa,'tasksB',wb);
END $fn$;
REVOKE ALL ON FUNCTION public.saas_qa_phase3a_create(uuid,uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.saas_qa_phase3a_create(uuid,uuid,uuid,uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.saas_qa_phase3a_cleanup(p_school_a uuid,p_school_b uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE ids uuid[]:=ARRAY[p_school_a,p_school_b]; ca uuid;cb uuid;wa uuid;wb uuid;
BEGIN
 IF (SELECT count(*) FROM saas.organizations WHERE id=ANY(ids) AND slug ~ '^saas-e2e-[ab]-[a-f0-9]{12}$')<>2 THEN
  RAISE EXCEPTION 'Unsafe synthetic cleanup: organizations not recognized' USING ERRCODE='42501';
 END IF;
 SELECT crm_tenant_id INTO ca FROM saas.legacy_tenant_links WHERE organization_id=p_school_a;
 SELECT crm_tenant_id INTO cb FROM saas.legacy_tenant_links WHERE organization_id=p_school_b;
 SELECT workspace_id INTO wa FROM saas.workspace_links WHERE organization_id=p_school_a;
 SELECT workspace_id INTO wb FROM saas.workspace_links WHERE organization_id=p_school_b;
 IF ca IS NULL OR cb IS NULL OR wa IS NULL OR wb IS NULL
 OR (SELECT count(*) FROM connect.tenants WHERE id IN (ca,cb) AND slug ~ '^saas-e2e-crm-[ab]-[a-f0-9]{12}$')<>2
 OR (SELECT count(*) FROM tasks.workspaces WHERE id IN (wa,wb) AND name LIKE 'SaaS E2E Tasks %')<>2 THEN
  RAISE EXCEPTION 'Unsafe synthetic cleanup: linked fixtures not recognized' USING ERRCODE='42501';
 END IF;
 IF EXISTS(SELECT 1 FROM connect.memberships m JOIN auth.users u ON u.id=m.user_id WHERE m.tenant_id IN (ca,cb)
  AND lower(u.email) !~ '^saas-e2e-[a-z0-9-]+@example[.]invalid$')
 OR EXISTS(SELECT 1 FROM tasks.workspace_members m JOIN auth.users u ON u.id=m.user_id WHERE m.workspace_id IN (wa,wb)
  AND lower(u.email) !~ '^saas-e2e-[a-z0-9-]+@example[.]invalid$') THEN
  RAISE EXCEPTION 'Refusing to remove non-synthetic members' USING ERRCODE='42501';
 END IF;
 DELETE FROM saas.workspace_links WHERE organization_id=ANY(ids);
 DELETE FROM saas.legacy_tenant_links WHERE organization_id=ANY(ids);
 DELETE FROM tasks.workspace_members WHERE workspace_id IN (wa,wb);
 DELETE FROM tasks.workspaces WHERE id IN (wa,wb);
 DELETE FROM connect.memberships WHERE tenant_id IN (ca,cb);
 DELETE FROM connect.tenants WHERE id IN (ca,cb);
 DELETE FROM saas.module_entitlements WHERE organization_id=ANY(ids) AND module_key IN ('crm','tasks');
END $fn$;
REVOKE ALL ON FUNCTION public.saas_qa_phase3a_cleanup(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.saas_qa_phase3a_cleanup(uuid,uuid) TO service_role;
COMMIT;
