-- Phase 3B: role-sensitive reads for existing Parent, Trainer and Student Academy clients.
-- SaaS role membership is required; global profiles.role alone is NEVER an admin grant.
BEGIN;
CREATE OR REPLACE FUNCTION saas.can_actor_read_academy_core(p_kind text,p_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE org uuid:=saas.selected_academy_organization();actor uuid:=auth.uid();actor_role text;
BEGIN
 IF org IS NULL OR actor IS NULL OR p_id IS NULL THEN RETURN false; END IF;
 IF NOT saas.can_access_academy_record(p_kind,p_id) THEN RETURN false; END IF;
 IF saas.can_administer_selected_academy() THEN RETURN true; END IF;
 SELECT role INTO actor_role FROM public.profiles WHERE id=actor AND active;
 IF actor_role='trainer' THEN
  IF p_kind='trainers' THEN
   RETURN EXISTS(SELECT 1 FROM public.trainers t WHERE t.id=p_id AND t.profile_id=actor);
  ELSIF p_kind='enrollments' THEN
   RETURN EXISTS(SELECT 1 FROM public.enrollments e JOIN public.trainers t ON t.id=e.trainer_id
    WHERE e.id=p_id AND t.profile_id=actor);
  ELSIF p_kind='students' THEN
   RETURN EXISTS(SELECT 1 FROM public.enrollments e JOIN public.trainers t ON t.id=e.trainer_id
    JOIN saas.academy_enrollments l ON l.enrollment_id=e.id AND l.organization_id=org
    WHERE e.student_id=p_id AND t.profile_id=actor);
  ELSIF p_kind='courses' THEN
   RETURN EXISTS(SELECT 1 FROM public.trainer_courses tc JOIN public.trainers t ON t.id=tc.trainer_id
    WHERE tc.course_id=p_id AND t.profile_id=actor)
    OR EXISTS(SELECT 1 FROM public.enrollments e JOIN public.trainers t ON t.id=e.trainer_id
    JOIN saas.academy_enrollments l ON l.enrollment_id=e.id AND l.organization_id=org
    WHERE e.course_id=p_id AND t.profile_id=actor);
  END IF;
 ELSIF actor_role IN ('parent','student') THEN
  IF p_kind='students' THEN
   RETURN (actor_role='student' AND EXISTS(SELECT 1 FROM public.students s WHERE s.id=p_id AND s.profile_id=actor))
    OR (actor_role='parent' AND EXISTS(SELECT 1 FROM public.parent_students ps
     JOIN public.parents p ON p.id=ps.parent_id WHERE ps.student_id=p_id AND p.profile_id=actor));
  ELSIF p_kind='enrollments' THEN
   RETURN EXISTS(SELECT 1 FROM public.enrollments e
    JOIN saas.academy_enrollments l ON l.enrollment_id=e.id AND l.organization_id=org
    WHERE e.id=p_id AND (
     (actor_role='student' AND EXISTS(SELECT 1 FROM public.students s WHERE s.id=e.student_id AND s.profile_id=actor))
     OR (actor_role='parent' AND EXISTS(SELECT 1 FROM public.parent_students ps JOIN public.parents p ON p.id=ps.parent_id
      WHERE ps.student_id=e.student_id AND p.profile_id=actor))
    ));
  ELSIF p_kind IN ('courses','trainers') THEN
   RETURN EXISTS(SELECT 1 FROM public.enrollments e
    JOIN saas.academy_enrollments l ON l.enrollment_id=e.id AND l.organization_id=org
    WHERE (CASE WHEN p_kind='courses' THEN e.course_id ELSE e.trainer_id END)=p_id
    AND (
     (actor_role='student' AND EXISTS(SELECT 1 FROM public.students s WHERE s.id=e.student_id AND s.profile_id=actor))
     OR (actor_role='parent' AND EXISTS(SELECT 1 FROM public.parent_students ps JOIN public.parents p ON p.id=ps.parent_id
      WHERE ps.student_id=e.student_id AND p.profile_id=actor))
    ));
  END IF;
 END IF;
 RETURN false;
END $fn$;
REVOKE ALL ON FUNCTION saas.can_actor_read_academy_core(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION saas.can_actor_read_academy_core(text,uuid) TO authenticated,service_role;

DO $policies$ DECLARE rec record; p text;
BEGIN
 FOR rec IN SELECT * FROM (VALUES
 ('students','students'),('trainers','trainers'),('courses','courses'),('enrollments','enrollments')
 ) AS x(tbl,kind) LOOP
  p:=format('saas.can_actor_read_academy_core(%L,id)',rec.kind);
  EXECUTE format('DROP POLICY IF EXISTS saas_tenant_boundary_select ON public.%I',rec.tbl);
  EXECUTE format('CREATE POLICY saas_tenant_boundary_select ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (NOT saas.has_organization_membership() OR (%s))',rec.tbl,p);
  EXECUTE format('DROP POLICY IF EXISTS saas_tenant_select ON public.%I',rec.tbl);
  EXECUTE format('CREATE POLICY saas_tenant_select ON public.%I FOR SELECT TO authenticated USING (%s)',rec.tbl,p);
 END LOOP;
END $policies$;
COMMIT;
