-- Phase 3B — restrict dependent Academy tables by the selected, membership-checked organization.
-- Legacy standalone members with no SaaS membership keep their existing RLS policies.
BEGIN;
CREATE TABLE IF NOT EXISTS saas.academy_family_receipts (
 receipt_id uuid PRIMARY KEY REFERENCES public.student_family_receipts(id) ON DELETE CASCADE,
 organization_id uuid NOT NULL REFERENCES saas.organizations(id),
 linked_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE saas.academy_family_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON saas.academy_family_receipts FROM PUBLIC,anon,authenticated;
GRANT ALL ON saas.academy_family_receipts TO service_role;

CREATE OR REPLACE FUNCTION saas.can_access_academy_dependent(p_kind text,p_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE visible boolean:=false;
BEGIN
 IF saas.selected_academy_organization() IS NULL OR p_id IS NULL THEN RETURN false; END IF;
 IF p_kind='cohorts' THEN
  SELECT EXISTS(SELECT 1 FROM public.cohorts r WHERE r.id=p_id
   AND saas.can_access_academy_record('courses',r.course_id)
   AND (r.trainer_id IS NULL OR saas.can_access_academy_record('trainers',r.trainer_id))) INTO visible;
 ELSIF p_kind='schedule_events' THEN
  SELECT EXISTS(SELECT 1 FROM public.schedule_events r WHERE r.id=p_id
   AND saas.can_access_academy_record('trainers',r.trainer_id)
   AND (r.course_id IS NULL OR saas.can_access_academy_record('courses',r.course_id))
   AND (r.student_id IS NULL OR saas.can_access_academy_record('students',r.student_id))
   AND (r.enrollment_id IS NULL OR saas.can_access_academy_record('enrollments',r.enrollment_id))
   AND (r.cohort_id IS NULL OR saas.can_access_academy_dependent('cohorts',r.cohort_id))) INTO visible;
 ELSIF p_kind='class_attendance' THEN
  SELECT EXISTS(SELECT 1 FROM public.class_attendance r WHERE r.id=p_id
   AND saas.can_access_academy_record('students',r.student_id)
   AND saas.can_access_academy_record('enrollments',r.enrollment_id)
   AND saas.can_access_academy_dependent('schedule_events',r.schedule_event_id)) INTO visible;
 ELSIF p_kind='learning_observations' THEN
  SELECT EXISTS(SELECT 1 FROM public.learning_observations r WHERE r.id=p_id
   AND saas.can_access_academy_record('students',r.student_id)
   AND saas.can_access_academy_record('trainers',r.trainer_id)
   AND saas.can_access_academy_record('enrollments',r.enrollment_id)
   AND saas.can_access_academy_dependent('schedule_events',r.schedule_event_id)) INTO visible;
 ELSIF p_kind='student_fee_packages' THEN
  SELECT EXISTS(SELECT 1 FROM public.student_fee_packages r WHERE r.id=p_id
   AND saas.can_access_academy_record('enrollments',r.enrollment_id)) INTO visible;
 ELSIF p_kind='student_family_receipts' THEN
  SELECT EXISTS(SELECT 1 FROM saas.academy_family_receipts r WHERE r.receipt_id=p_id
   AND r.organization_id=saas.selected_academy_organization()) INTO visible;
 ELSIF p_kind='student_fee_payments' THEN
  SELECT EXISTS(SELECT 1 FROM public.student_fee_payments r WHERE r.id=p_id
   AND saas.can_access_academy_dependent('student_fee_packages',r.package_id)
   AND (r.family_receipt_id IS NULL OR saas.can_access_academy_dependent('student_family_receipts',r.family_receipt_id))) INTO visible;
 ELSIF p_kind='student_invoices' THEN
  SELECT EXISTS(SELECT 1 FROM public.student_invoices r WHERE r.id=p_id
   AND (r.student_id IS NOT NULL OR r.enrollment_id IS NOT NULL)
   AND (r.student_id IS NULL OR saas.can_access_academy_record('students',r.student_id))
   AND (r.enrollment_id IS NULL OR saas.can_access_academy_record('enrollments',r.enrollment_id))
   AND (r.fee_package_id IS NULL OR saas.can_access_academy_dependent('student_fee_packages',r.fee_package_id))
   AND (r.parent_id IS NULL OR (r.student_id IS NOT NULL AND EXISTS(
    SELECT 1 FROM public.parent_students ps WHERE ps.parent_id=r.parent_id AND ps.student_id=r.student_id)))) INTO visible;
 ELSIF p_kind='trainer_earnings' THEN
  SELECT EXISTS(SELECT 1 FROM public.trainer_earnings r WHERE r.id=p_id
   AND saas.can_access_academy_record('trainers',r.trainer_id)
   AND saas.can_access_academy_dependent('schedule_events',r.schedule_event_id)) INTO visible;
 ELSIF p_kind='zoom_meetings' THEN
  SELECT EXISTS(SELECT 1 FROM public.zoom_meetings r WHERE r.id=p_id
   AND r.schedule_event_id IS NOT NULL
   AND saas.can_access_academy_dependent('schedule_events',r.schedule_event_id)) INTO visible;
 ELSIF p_kind='zoom_recordings' THEN
  SELECT EXISTS(SELECT 1 FROM public.zoom_recordings r WHERE r.id=p_id
   AND saas.can_access_academy_dependent('zoom_meetings',r.zoom_meeting_id)) INTO visible;
 ELSIF p_kind='parents' THEN
  SELECT EXISTS(SELECT 1 FROM public.parent_students ps WHERE ps.parent_id=p_id
   AND saas.can_access_academy_record('students',ps.student_id)) INTO visible;
 ELSIF p_kind='portal_notifications' THEN
  SELECT EXISTS(SELECT 1 FROM public.portal_notifications r WHERE r.id=p_id
   AND (r.student_id IS NOT NULL OR r.trainer_id IS NOT NULL)
   AND (r.student_id IS NULL OR saas.can_access_academy_record('students',r.student_id))
   AND (r.trainer_id IS NULL OR saas.can_access_academy_record('trainers',r.trainer_id))) INTO visible;
 END IF;
 RETURN coalesce(visible,false);
END $fn$;
REVOKE ALL ON FUNCTION saas.can_access_academy_dependent(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION saas.can_access_academy_dependent(text,uuid) TO authenticated,service_role;

DO $policies$ DECLARE rec record;
BEGIN
 FOR rec IN SELECT * FROM (VALUES
  ('cohorts','saas.can_access_academy_dependent(''cohorts'',id)'),
  ('schedule_events','saas.can_access_academy_dependent(''schedule_events'',id)'),
  ('class_attendance','saas.can_access_academy_dependent(''class_attendance'',id)'),
  ('learning_observations','saas.can_access_academy_dependent(''learning_observations'',id)'),
  ('student_fee_packages','saas.can_access_academy_dependent(''student_fee_packages'',id)'),
  ('student_fee_payments','saas.can_access_academy_dependent(''student_fee_payments'',id)'),
  ('student_invoices','saas.can_access_academy_dependent(''student_invoices'',id)'),
  ('trainer_earnings','saas.can_access_academy_dependent(''trainer_earnings'',id)'),
  ('zoom_meetings','saas.can_access_academy_dependent(''zoom_meetings'',id)'),
  ('zoom_recordings','saas.can_access_academy_dependent(''zoom_recordings'',id)'),
  ('parents','saas.can_access_academy_dependent(''parents'',id)'),
  ('portal_notifications','saas.can_access_academy_dependent(''portal_notifications'',id)'),
  ('student_guardians','saas.can_access_academy_record(''students'',student_id)'),
  ('trainer_courses','saas.can_access_academy_record(''trainers'',trainer_id) AND saas.can_access_academy_record(''courses'',course_id)'),
  ('parent_students','saas.can_access_academy_record(''students'',student_id)')
 ) AS x(tbl,predicate) LOOP
  EXECUTE format('DROP POLICY IF EXISTS saas_tenant_boundary ON public.%I',rec.tbl);
  EXECUTE format('CREATE POLICY saas_tenant_boundary ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (NOT saas.has_organization_membership() OR (%s)) WITH CHECK (NOT saas.has_organization_membership() OR (%s))',rec.tbl,rec.predicate,rec.predicate);
  EXECUTE format('DROP POLICY IF EXISTS saas_tenant_select ON public.%I',rec.tbl);
  EXECUTE format('CREATE POLICY saas_tenant_select ON public.%I FOR SELECT TO authenticated USING (saas.has_organization_membership() AND (%s))',rec.tbl,rec.predicate);
 END LOOP;
END $policies$;
COMMIT;
