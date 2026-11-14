-- DEV ONLY: third independent synthetic organization for Phase 3E concurrent activation.
CREATE OR REPLACE FUNCTION public.saas_qa_phase3e_create_third(p_user_c uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE o uuid:=gen_random_uuid();t uuid:=gen_random_uuid();w uuid:=gen_random_uuid();
BEGIN
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_user_c
   AND lower(email) ~ '^saas-e2e-[a-z0-9-]+@example[.]invalid$')
 THEN RAISE EXCEPTION 'Only synthetic QA identity' USING ERRCODE='42501';END IF;
 INSERT INTO saas.organizations(id,slug,display_name)
 VALUES(o,'saas-e2e-c-'||left(replace(o::text,'-',''),12),'Synthetic School C');
 INSERT INTO saas.memberships(organization_id,user_id,role_key,status) VALUES(o,p_user_c,'admin','active');
 INSERT INTO saas.module_entitlements(organization_id,module_key,enabled)
 VALUES(o,'academy',true),(o,'crm',true),(o,'tasks',true);
 INSERT INTO connect.tenants(id,slug,name)
 VALUES(t,'saas-e2e-crm-c-'||left(replace(t::text,'-',''),12),'SaaS E2E CRM C');
 INSERT INTO connect.memberships(tenant_id,user_id,role,status) VALUES(t,p_user_c,'owner','active');
 INSERT INTO saas.legacy_tenant_links(organization_id,crm_tenant_id) VALUES(o,t);
 INSERT INTO tasks.accounts(user_id,display_name) VALUES(p_user_c,'SaaS E2E Tester C')
 ON CONFLICT(user_id) DO NOTHING;
 INSERT INTO tasks.workspaces(id,name,owner_user_id)
 VALUES(w,'SaaS E2E Tasks C',p_user_c);
 INSERT INTO tasks.workspace_members(workspace_id,user_id,role) VALUES(w,p_user_c,'owner');
 INSERT INTO saas.workspace_links(organization_id,workspace_id) VALUES(o,w);
 RETURN jsonb_build_object('schoolC',o,'crmC',t,'tasksC',w);
END $fn$;

CREATE OR REPLACE FUNCTION public.saas_qa_phase3e_cleanup_third(
 p_school_a uuid,p_school_b uuid,p_school_c uuid
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE ids uuid[]:=ARRAY[p_school_a,p_school_b,p_school_c]; t uuid;w uuid;
BEGIN
 IF (SELECT count(*) FROM saas.organizations WHERE id=ANY(ids)
 AND slug ~ '^saas-e2e-[abc]-[a-f0-9]{12}$')<>3 THEN
  RAISE EXCEPTION 'Unexpected synthetic organization cleanup target' USING ERRCODE='42501';
 END IF;
 SELECT crm_tenant_id INTO t FROM saas.legacy_tenant_links WHERE organization_id=p_school_c;
 SELECT workspace_id INTO w FROM saas.workspace_links WHERE organization_id=p_school_c;
 IF t IS NULL OR w IS NULL OR
  NOT EXISTS(SELECT 1 FROM connect.tenants WHERE id=t AND slug ~ '^saas-e2e-crm-c-[a-f0-9]{12}$')
  OR NOT EXISTS(SELECT 1 FROM tasks.workspaces WHERE id=w AND name='SaaS E2E Tasks C') THEN
  RAISE EXCEPTION 'Third tenant cleanup target mismatch' USING ERRCODE='42501';
 END IF;
 IF EXISTS(SELECT 1 FROM connect.memberships m JOIN auth.users u ON u.id=m.user_id
  WHERE m.tenant_id=t AND lower(u.email) !~ '^saas-e2e-[a-z0-9-]+@example[.]invalid$')
 OR EXISTS(SELECT 1 FROM tasks.items WHERE workspace_id=w)
 THEN RAISE EXCEPTION 'Non-synthetic dependent data' USING ERRCODE='42501';END IF;
 DELETE FROM connect.portal_demo_integrations WHERE tenant_id IN
  (SELECT crm_tenant_id FROM saas.legacy_tenant_links WHERE organization_id=ANY(ids));
 DELETE FROM saas.workspace_links WHERE organization_id=p_school_c;
 DELETE FROM saas.legacy_tenant_links WHERE organization_id=p_school_c;
 DELETE FROM connect.memberships WHERE tenant_id=t;
 DELETE FROM connect.tenants WHERE id=t;
 DELETE FROM tasks.workspace_members WHERE workspace_id=w;
 DELETE FROM tasks.workspaces WHERE id=w;
 DELETE FROM saas.module_entitlements WHERE organization_id=p_school_c;
 DELETE FROM saas.memberships WHERE organization_id=p_school_c;
 DELETE FROM saas.organizations WHERE id=p_school_c;
 RETURN true;
END $fn$;
REVOKE ALL ON FUNCTION public.saas_qa_phase3e_create_third(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.saas_qa_phase3e_cleanup_third(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.saas_qa_phase3e_create_third(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.saas_qa_phase3e_cleanup_third(uuid,uuid,uuid) TO service_role;
