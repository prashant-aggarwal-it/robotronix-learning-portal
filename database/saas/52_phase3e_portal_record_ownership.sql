-- Phase 3E: enforce Academy ownership of CRM admission and demo foreign IDs.
-- Optional SaaS full-suite migration: standalone Portal+CRM is unchanged.
BEGIN;
CREATE OR REPLACE FUNCTION connect.guard_portal_handoff_tenant_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
DECLARE v_org uuid;
BEGIN
 SELECT organization_id INTO v_org FROM saas.legacy_tenant_links WHERE crm_tenant_id=NEW.tenant_id;
 IF v_org IS NULL THEN RETURN NEW;END IF;
 IF NEW.status='enrollment_confirmed' OR NEW.portal_enrollment_id IS NOT NULL
  OR NEW.portal_student_id IS NOT NULL THEN
  IF NEW.portal_enrollment_id IS NULL OR NEW.portal_student_id IS NULL
  OR NOT EXISTS(SELECT 1 FROM saas.academy_enrollments el
   JOIN saas.academy_students st ON st.organization_id=el.organization_id
   JOIN public.enrollments e ON e.id=el.enrollment_id AND e.student_id=st.student_id
   WHERE el.organization_id=v_org AND el.enrollment_id=NEW.portal_enrollment_id
     AND st.student_id=NEW.portal_student_id AND e.status='active')
  THEN RAISE EXCEPTION 'Academy enrollment must belong to the mapped CRM organization' USING ERRCODE='42501';END IF;
 END IF;
 RETURN NEW;
END $fn$;
DROP TRIGGER IF EXISTS guard_portal_handoff_tenant_v1 ON connect.portal_admission_handoffs;
CREATE TRIGGER guard_portal_handoff_tenant_v1 BEFORE INSERT OR UPDATE
ON connect.portal_admission_handoffs FOR EACH ROW
EXECUTE FUNCTION connect.guard_portal_handoff_tenant_v1();

CREATE OR REPLACE FUNCTION connect.guard_portal_demo_tenant_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
DECLARE v_org uuid;
BEGIN
 SELECT organization_id INTO v_org FROM saas.legacy_tenant_links WHERE crm_tenant_id=NEW.tenant_id;
 IF v_org IS NULL THEN RETURN NEW;END IF;
 IF NEW.portal_session_id IS NOT NULL OR NEW.status='scheduled' THEN
  IF NEW.portal_session_id IS NULL OR NEW.portal_schedule_event_id IS NULL
  OR NOT EXISTS(SELECT 1 FROM public.demo_sessions ds
   JOIN saas.academy_trainers at ON at.trainer_id=ds.trainer_id AND at.organization_id=v_org
   JOIN public.schedule_events ev ON ev.id=ds.schedule_event_id
    AND ev.id=NEW.portal_schedule_event_id AND ev.trainer_id=ds.trainer_id
   WHERE ds.id=NEW.portal_session_id)
  THEN RAISE EXCEPTION 'Demo session must belong to mapped Academy trainer and schedule' USING ERRCODE='42501';END IF;
 END IF;
 RETURN NEW;
END $fn$;
DROP TRIGGER IF EXISTS guard_portal_demo_tenant_v1 ON connect.portal_demo_links;
CREATE TRIGGER guard_portal_demo_tenant_v1 BEFORE INSERT OR UPDATE
ON connect.portal_demo_links FOR EACH ROW
EXECUTE FUNCTION connect.guard_portal_demo_tenant_v1();

REVOKE ALL ON FUNCTION connect.guard_portal_handoff_tenant_v1() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION connect.guard_portal_demo_tenant_v1() FROM PUBLIC,anon,authenticated;
COMMIT;
