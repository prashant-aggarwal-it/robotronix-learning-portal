-- DEV ONLY: attempt an invalid CRM A → Academy C enrollment confirmation.
-- This must be rejected by Phase 3E mapped-record ownership trigger.
CREATE OR REPLACE FUNCTION public.saas_qa_phase3e_cross_handoff_attempt(
 p_handoff_id uuid,p_student_id uuid,p_enrollment_id uuid
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE v_crm_org uuid;v_student_org uuid;
BEGIN
 SELECT l.organization_id INTO v_crm_org
 FROM connect.portal_admission_handoffs h
 JOIN connect.tenants t ON t.id=h.tenant_id
 JOIN saas.legacy_tenant_links l ON l.crm_tenant_id=t.id
 WHERE h.id=p_handoff_id AND t.slug ~ '^saas-e2e-crm-a-[a-f0-9]{12}$';
 SELECT st.organization_id INTO v_student_org FROM saas.academy_students st
 JOIN public.students s ON s.id=st.student_id
 JOIN saas.organizations o ON o.id=st.organization_id
 JOIN saas.academy_enrollments en ON en.organization_id=o.id AND en.enrollment_id=p_enrollment_id
 JOIN public.enrollments e ON e.id=en.enrollment_id AND e.student_id=s.id
 WHERE st.student_id=p_student_id
 AND s.full_name='SaaS E2E Student C'
 AND o.slug ~ '^saas-e2e-c-[a-f0-9]{12}$';
 IF v_crm_org IS NULL OR v_student_org IS NULL OR v_crm_org=v_student_org
 THEN RAISE EXCEPTION 'Only distinct synthetic A/C enrollment verification permitted' USING ERRCODE='42501';END IF;
 UPDATE connect.portal_admission_handoffs
 SET status='enrollment_confirmed',portal_enrollment_id=p_enrollment_id,
  portal_student_id=p_student_id WHERE id=p_handoff_id;
 RETURN true;
END $fn$;
REVOKE ALL ON FUNCTION public.saas_qa_phase3e_cross_handoff_attempt(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.saas_qa_phase3e_cross_handoff_attempt(uuid,uuid,uuid) TO service_role;
