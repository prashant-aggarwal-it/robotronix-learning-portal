-- Phase 3B: complete the legacy Academy table inventory with tenant-aware
-- trainer feedback, scoped audit logs and read-only global reference catalogs.
BEGIN;
ALTER TABLE public.portal_audit_log
 ADD COLUMN IF NOT EXISTS saas_org_id uuid REFERENCES saas.organizations(id);
CREATE INDEX IF NOT EXISTS idx_portal_audit_log_saas_org
 ON public.portal_audit_log(saas_org_id) WHERE saas_org_id IS NOT NULL;
CREATE OR REPLACE FUNCTION saas.audit_org_insert_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
BEGIN
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 IF NOT saas.has_organization_membership() THEN
  IF NEW.saas_org_id IS NOT NULL THEN RAISE EXCEPTION 'Unverified audit organization' USING ERRCODE='42501'; END IF;
  RETURN NEW;
 END IF;
 IF NOT saas.can_administer_selected_academy() THEN
  RAISE EXCEPTION 'Organization audit access denied' USING ERRCODE='42501';
 END IF;
 NEW.saas_org_id:=saas.selected_academy_organization();
 RETURN NEW;
END $fn$;
CREATE OR REPLACE FUNCTION saas.audit_org_update_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
BEGIN
 IF NEW.saas_org_id IS DISTINCT FROM OLD.saas_org_id THEN
  RAISE EXCEPTION 'Audit ownership cannot be reassigned' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION saas.audit_org_insert_guard(),saas.audit_org_update_guard() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS saas_audit_org_insert ON public.portal_audit_log;
CREATE TRIGGER saas_audit_org_insert BEFORE INSERT ON public.portal_audit_log
 FOR EACH ROW EXECUTE FUNCTION saas.audit_org_insert_guard();
DROP TRIGGER IF EXISTS saas_audit_org_update ON public.portal_audit_log;
CREATE TRIGGER saas_audit_org_update BEFORE UPDATE ON public.portal_audit_log
 FOR EACH ROW EXECUTE FUNCTION saas.audit_org_update_guard();

DROP POLICY IF EXISTS saas_tenant_boundary_select ON public.portal_audit_log;
DROP POLICY IF EXISTS saas_tenant_boundary_insert ON public.portal_audit_log;
DROP POLICY IF EXISTS saas_tenant_boundary_update ON public.portal_audit_log;
DROP POLICY IF EXISTS saas_tenant_boundary_delete ON public.portal_audit_log;
DROP POLICY IF EXISTS saas_tenant_select ON public.portal_audit_log;
DROP POLICY IF EXISTS saas_tenant_insert ON public.portal_audit_log;
CREATE POLICY saas_tenant_boundary_select ON public.portal_audit_log AS RESTRICTIVE
 FOR SELECT TO authenticated USING (NOT saas.has_organization_membership() OR
 (saas.can_administer_selected_academy() AND saas_org_id=saas.selected_academy_organization()));
CREATE POLICY saas_tenant_boundary_insert ON public.portal_audit_log AS RESTRICTIVE
 FOR INSERT TO authenticated WITH CHECK (NOT saas.has_organization_membership() OR
 (saas.can_administer_selected_academy() AND saas_org_id=saas.selected_academy_organization()));
CREATE POLICY saas_tenant_boundary_update ON public.portal_audit_log AS RESTRICTIVE
 FOR UPDATE TO authenticated USING (NOT saas.has_organization_membership() OR false)
 WITH CHECK (NOT saas.has_organization_membership() OR false);
CREATE POLICY saas_tenant_boundary_delete ON public.portal_audit_log AS RESTRICTIVE
 FOR DELETE TO authenticated USING (NOT saas.has_organization_membership() OR false);
CREATE POLICY saas_tenant_select ON public.portal_audit_log FOR SELECT TO authenticated
 USING (saas.can_administer_selected_academy() AND saas_org_id=saas.selected_academy_organization());
CREATE POLICY saas_tenant_insert ON public.portal_audit_log FOR INSERT TO authenticated
 WITH CHECK (saas.can_administer_selected_academy() AND saas_org_id=saas.selected_academy_organization());

DO $shared$ DECLARE tbl text;
BEGIN
 FOREACH tbl IN ARRAY ARRAY['quizzes','reminder_policies'] LOOP
  EXECUTE format('DROP POLICY IF EXISTS saas_tenant_boundary_select ON public.%I',tbl);
  EXECUTE format('DROP POLICY IF EXISTS saas_tenant_boundary_insert ON public.%I',tbl);
  EXECUTE format('DROP POLICY IF EXISTS saas_tenant_boundary_update ON public.%I',tbl);
  EXECUTE format('DROP POLICY IF EXISTS saas_tenant_boundary_delete ON public.%I',tbl);
  EXECUTE format('CREATE POLICY saas_tenant_boundary_select ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (NOT saas.has_organization_membership() OR saas.selected_academy_organization() IS NOT NULL)',tbl);
  EXECUTE format('CREATE POLICY saas_tenant_boundary_insert ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT saas.has_organization_membership())',tbl);
  EXECUTE format('CREATE POLICY saas_tenant_boundary_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT saas.has_organization_membership()) WITH CHECK (NOT saas.has_organization_membership())',tbl);
  EXECUTE format('CREATE POLICY saas_tenant_boundary_delete ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT saas.has_organization_membership())',tbl);
 END LOOP;
END $shared$;

CREATE OR REPLACE FUNCTION saas.can_access_trainer_feedback(
 p_student uuid,p_enrollment uuid,p_trainer uuid
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $fn$
 SELECT saas.selected_academy_organization() IS NOT NULL
 AND saas.can_access_academy_record('students',p_student)
 AND saas.can_access_academy_record('enrollments',p_enrollment)
 AND saas.can_access_academy_record('trainers',p_trainer)
 AND EXISTS(SELECT 1 FROM public.enrollments e WHERE e.id=p_enrollment
  AND e.student_id=p_student AND e.trainer_id=p_trainer);
$fn$;
REVOKE ALL ON FUNCTION saas.can_access_trainer_feedback(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION saas.can_access_trainer_feedback(uuid,uuid,uuid) TO authenticated,service_role;

DROP POLICY IF EXISTS saas_tenant_boundary_select ON public.trainer_feedback;
DROP POLICY IF EXISTS saas_tenant_boundary_insert ON public.trainer_feedback;
DROP POLICY IF EXISTS saas_tenant_boundary_update ON public.trainer_feedback;
DROP POLICY IF EXISTS saas_tenant_boundary_delete ON public.trainer_feedback;
CREATE POLICY saas_tenant_boundary_select ON public.trainer_feedback AS RESTRICTIVE FOR SELECT TO authenticated
 USING (NOT saas.has_organization_membership() OR
 (saas.can_access_trainer_feedback(student_id,enrollment_id,trainer_id) AND
 (saas.can_administer_selected_academy() OR saas.can_actor_read_academy_core('students',student_id)
 OR saas.can_actor_read_academy_core('enrollments',enrollment_id))));
CREATE POLICY saas_tenant_boundary_insert ON public.trainer_feedback AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK (NOT saas.has_organization_membership() OR
 (saas.can_access_trainer_feedback(student_id,enrollment_id,trainer_id) AND
 (saas.can_administer_selected_academy() OR EXISTS(SELECT 1 FROM public.trainers t
 WHERE t.id=trainer_id AND t.profile_id=auth.uid()))));
CREATE POLICY saas_tenant_boundary_update ON public.trainer_feedback AS RESTRICTIVE FOR UPDATE TO authenticated
 USING (NOT saas.has_organization_membership() OR (saas.can_access_trainer_feedback(student_id,enrollment_id,trainer_id)
 AND saas.can_administer_selected_academy()))
 WITH CHECK (NOT saas.has_organization_membership() OR (saas.can_access_trainer_feedback(student_id,enrollment_id,trainer_id)
 AND saas.can_administer_selected_academy()));
CREATE POLICY saas_tenant_boundary_delete ON public.trainer_feedback AS RESTRICTIVE FOR DELETE TO authenticated
 USING (NOT saas.has_organization_membership() OR (saas.can_access_trainer_feedback(student_id,enrollment_id,trainer_id)
 AND saas.can_administer_selected_academy()));
COMMIT;
