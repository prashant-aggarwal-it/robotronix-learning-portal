-- Phase 3B: secure legacy trainer session records through all linked tenant resources.
BEGIN;
CREATE OR REPLACE FUNCTION saas.can_access_academy_session(
 p_student uuid,p_enrollment uuid,p_trainer uuid
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $fn$
 SELECT saas.selected_academy_organization() IS NOT NULL
 AND (p_student IS NOT NULL OR p_enrollment IS NOT NULL OR p_trainer IS NOT NULL)
 AND (p_student IS NULL OR saas.can_access_academy_record('students',p_student))
 AND (p_enrollment IS NULL OR saas.can_access_academy_record('enrollments',p_enrollment))
 AND (p_trainer IS NULL OR saas.can_access_academy_record('trainers',p_trainer))
 AND (p_student IS NULL OR p_enrollment IS NULL OR EXISTS(
 SELECT 1 FROM public.enrollments e WHERE e.id=p_enrollment AND e.student_id=p_student))
 AND (p_trainer IS NULL OR p_enrollment IS NULL OR EXISTS(
 SELECT 1 FROM public.enrollments e WHERE e.id=p_enrollment AND e.trainer_id=p_trainer));
$fn$;
CREATE OR REPLACE FUNCTION saas.can_actor_read_academy_session(
 p_student uuid,p_enrollment uuid,p_trainer uuid
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $fn$
 SELECT saas.can_access_academy_session(p_student,p_enrollment,p_trainer)
 AND (
   saas.can_administer_selected_academy()
   OR (p_student IS NOT NULL AND saas.can_actor_read_academy_core('students',p_student))
   OR (p_enrollment IS NOT NULL AND saas.can_actor_read_academy_core('enrollments',p_enrollment))
   OR (p_trainer IS NOT NULL AND EXISTS(
    SELECT 1 FROM public.trainers t WHERE t.id=p_trainer AND t.profile_id=auth.uid()
    AND saas.can_actor_read_academy_core('trainers',p_trainer)))
 );
$fn$;
REVOKE ALL ON FUNCTION saas.can_access_academy_session(uuid,uuid,uuid),
 saas.can_actor_read_academy_session(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION saas.can_access_academy_session(uuid,uuid,uuid),
 saas.can_actor_read_academy_session(uuid,uuid,uuid) TO authenticated,service_role;
DROP POLICY IF EXISTS saas_tenant_boundary_select ON public.session_records;
DROP POLICY IF EXISTS saas_tenant_boundary_insert ON public.session_records;
DROP POLICY IF EXISTS saas_tenant_select ON public.session_records;
DROP POLICY IF EXISTS saas_tenant_insert ON public.session_records;
CREATE POLICY saas_tenant_boundary_select ON public.session_records AS RESTRICTIVE FOR SELECT TO authenticated
 USING (NOT saas.has_organization_membership() OR saas.can_actor_read_academy_session(student_id,enrollment_id,trainer_id));
CREATE POLICY saas_tenant_select ON public.session_records FOR SELECT TO authenticated
 USING (saas.can_actor_read_academy_session(student_id,enrollment_id,trainer_id));
CREATE POLICY saas_tenant_boundary_insert ON public.session_records AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK (NOT saas.has_organization_membership() OR saas.can_access_academy_session(student_id,enrollment_id,trainer_id));
CREATE POLICY saas_tenant_insert ON public.session_records FOR INSERT TO authenticated
 WITH CHECK (saas.can_administer_selected_academy() OR
  EXISTS(SELECT 1 FROM public.trainers t WHERE t.id=trainer_id AND t.profile_id=auth.uid()));
COMMIT;
