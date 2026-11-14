-- DEV ONLY. Never ship with customer installers or apply to production.
-- Isolated fixture for Phase 3D CRM → Tasks linked-opportunity E2E.
CREATE OR REPLACE FUNCTION public.saas_qa_phase3d_opportunity_create(
 p_actor_id uuid,p_tenant_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE v_pipeline uuid;v_stage uuid;v_person uuid;v_opportunity uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM connect.tenants WHERE id=p_tenant_id
   AND slug ~ '^saas-e2e-crm-[ab]-[a-f0-9]{12}$')
 OR NOT EXISTS(SELECT 1 FROM connect.memberships m
   WHERE m.tenant_id=p_tenant_id AND m.user_id=p_actor_id AND m.status='active' AND m.role='owner')
 OR NOT EXISTS(SELECT 1 FROM tasks.accounts
   WHERE user_id=p_actor_id AND status='active') THEN
  RAISE EXCEPTION 'Only active synthetic fixture owner allowed' USING ERRCODE='42501';
 END IF;
 INSERT INTO connect.pipelines(tenant_id,name,kind)
 VALUES(p_tenant_id,'SaaS E2E Phase3D Pipeline','admissions') RETURNING id INTO v_pipeline;
 INSERT INTO connect.pipeline_stages(tenant_id,pipeline_id,name,sort_order,outcome)
 VALUES(p_tenant_id,v_pipeline,'SaaS E2E Phase3D Stage',1,'open') RETURNING id INTO v_stage;
 INSERT INTO connect.people(tenant_id,full_name)
 VALUES(p_tenant_id,'SaaS E2E Phase3D Contact') RETURNING id INTO v_person;
 INSERT INTO connect.opportunities(tenant_id,pipeline_id,stage_id,title,contact_id)
 VALUES(p_tenant_id,v_pipeline,v_stage,'SaaS E2E Phase3D Opportunity',v_person) RETURNING id INTO v_opportunity;
 INSERT INTO connect.portal_demo_integrations(tenant_id,status,installed_by)
 VALUES(p_tenant_id,'active',p_actor_id)
 ON CONFLICT(tenant_id) DO UPDATE SET status='active',updated_at=now();
 RETURN jsonb_build_object('opportunityId',v_opportunity,'personId',v_person);
END $fn$;
CREATE OR REPLACE FUNCTION public.saas_qa_phase3d_opportunity_cleanup(
 p_tenant_id uuid,p_opportunity_id uuid
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE v_opportunity connect.opportunities%ROWTYPE;
BEGIN
 SELECT o.* INTO v_opportunity FROM connect.opportunities o
 JOIN connect.tenants t ON t.id=o.tenant_id
 JOIN connect.pipelines p ON p.id=o.pipeline_id AND p.tenant_id=o.tenant_id
 WHERE o.id=p_opportunity_id AND o.tenant_id=p_tenant_id
 AND o.title='SaaS E2E Phase3D Opportunity'
 AND p.name='SaaS E2E Phase3D Pipeline'
 AND t.slug ~ '^saas-e2e-crm-[ab]-[a-f0-9]{12}$'
 FOR UPDATE OF o;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unexpected cleanup target' USING ERRCODE='42501'; END IF;
 DELETE FROM tasks.activity WHERE task_id IN (
   SELECT task_id FROM tasks.module_links
    WHERE module='connect' AND resource='crm_opportunity' AND resource_id=p_opportunity_id AND tenant_id=p_tenant_id
 );
 DELETE FROM tasks.items WHERE id IN (
   SELECT task_id FROM tasks.module_links
    WHERE module='connect' AND resource='crm_opportunity' AND resource_id=p_opportunity_id AND tenant_id=p_tenant_id
 ) AND title='Follow up: SaaS E2E Phase3D Opportunity';
 DELETE FROM tasks.module_links WHERE module='connect' AND resource='crm_opportunity'
  AND resource_id=p_opportunity_id AND tenant_id=p_tenant_id;
 DELETE FROM connect.portal_admission_handoffs WHERE tenant_id=p_tenant_id AND opportunity_id=p_opportunity_id;
 DELETE FROM connect.audit_events WHERE tenant_id=p_tenant_id AND entity_type='opportunity' AND entity_id=p_opportunity_id
   AND event_type='portal_offer_accepted';
 DELETE FROM connect.automation_settings WHERE tenant_id=p_tenant_id;
 DELETE FROM connect.portal_demo_integrations WHERE tenant_id=p_tenant_id
   AND installed_by IN (SELECT user_id FROM connect.memberships
      WHERE tenant_id=p_tenant_id AND role='owner' AND status='active');
 DELETE FROM connect.staff_notifications WHERE tenant_id=p_tenant_id
  AND task_id IN (SELECT id FROM connect.tasks WHERE tenant_id=p_tenant_id AND opportunity_id=p_opportunity_id);
 DELETE FROM connect.tasks WHERE tenant_id=p_tenant_id AND opportunity_id=p_opportunity_id;
 DELETE FROM connect.activities WHERE tenant_id=p_tenant_id AND opportunity_id=p_opportunity_id;
 DELETE FROM connect.appointments WHERE tenant_id=p_tenant_id AND opportunity_id=p_opportunity_id;
 DELETE FROM connect.attribution WHERE tenant_id=p_tenant_id AND opportunity_id=p_opportunity_id;
 DELETE FROM connect.inquiries WHERE tenant_id=p_tenant_id AND opportunity_id=p_opportunity_id;
 DELETE FROM connect.opportunity_people WHERE tenant_id=p_tenant_id AND opportunity_id=p_opportunity_id;
 DELETE FROM connect.opportunity_programs WHERE tenant_id=p_tenant_id AND opportunity_id=p_opportunity_id;
 DELETE FROM connect.portal_demo_links WHERE tenant_id=p_tenant_id AND opportunity_id=p_opportunity_id;
 DELETE FROM connect.realized_revenue WHERE tenant_id=p_tenant_id AND opportunity_id=p_opportunity_id;
 DELETE FROM connect.stage_events WHERE tenant_id=p_tenant_id AND opportunity_id=p_opportunity_id;
 DELETE FROM connect.opportunities WHERE id=p_opportunity_id AND tenant_id=p_tenant_id;
 DELETE FROM connect.people WHERE id=v_opportunity.contact_id AND tenant_id=p_tenant_id
  AND full_name='SaaS E2E Phase3D Contact';
 DELETE FROM connect.pipeline_stages WHERE id=v_opportunity.stage_id AND tenant_id=p_tenant_id;
 DELETE FROM connect.pipelines WHERE id=v_opportunity.pipeline_id AND tenant_id=p_tenant_id
  AND name='SaaS E2E Phase3D Pipeline';
 RETURN true;
END $fn$;
REVOKE ALL ON FUNCTION public.saas_qa_phase3d_opportunity_create(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.saas_qa_phase3d_opportunity_cleanup(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.saas_qa_phase3d_opportunity_create(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.saas_qa_phase3d_opportunity_cleanup(uuid,uuid) TO service_role;
-- DEV-only cleanup for a synthetic Academy class → private Tasks source link.
CREATE OR REPLACE FUNCTION public.saas_qa_phase3d_schedule_link_cleanup(
 p_schedule_id uuid
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.schedule_events e
   WHERE e.id=p_schedule_id AND e.title='SaaS E2E Class A') THEN
  RAISE EXCEPTION 'Non-synthetic Academy class cleanup denied' USING ERRCODE='42501';
 END IF;
 IF EXISTS(SELECT 1 FROM tasks.module_links l JOIN tasks.items i ON i.id=l.task_id
  WHERE l.module='learning' AND l.resource='schedule_event' AND l.resource_id=p_schedule_id
    AND i.title<>'Review class: SaaS E2E Class A') THEN
  RAISE EXCEPTION 'Non-synthetic linked task cleanup denied' USING ERRCODE='42501';
 END IF;
 DELETE FROM tasks.activity WHERE task_id IN(
  SELECT task_id FROM tasks.module_links
   WHERE module='learning' AND resource='schedule_event' AND resource_id=p_schedule_id);
 DELETE FROM tasks.items WHERE id IN(
  SELECT task_id FROM tasks.module_links
   WHERE module='learning' AND resource='schedule_event' AND resource_id=p_schedule_id);
 DELETE FROM tasks.module_links
  WHERE module='learning' AND resource='schedule_event' AND resource_id=p_schedule_id;
 RETURN true;
END $fn$;
REVOKE ALL ON FUNCTION public.saas_qa_phase3d_schedule_link_cleanup(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.saas_qa_phase3d_schedule_link_cleanup(uuid) TO service_role;
