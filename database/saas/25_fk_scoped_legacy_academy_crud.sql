-- Phase 3B: support legacy direct CRUD for dependent records using FK ownership
-- predicates evaluated on the candidate row (not self-table lookups).
-- Restrictive policies preserve prior parent/trainer RLS; admin grants are scoped.
BEGIN;
DO $policies$ DECLARE rec record; p text;
BEGIN
 FOR rec IN SELECT * FROM (VALUES
 ('cohorts', 'saas.can_access_academy_record(''courses'',course_id) AND (trainer_id IS NULL OR saas.can_access_academy_record(''trainers'',trainer_id))'),
 ('schedule_events', 'saas.can_access_academy_record(''trainers'',trainer_id) AND (course_id IS NULL OR saas.can_access_academy_record(''courses'',course_id)) AND (student_id IS NULL OR saas.can_access_academy_record(''students'',student_id)) AND (enrollment_id IS NULL OR saas.can_access_academy_record(''enrollments'',enrollment_id)) AND (cohort_id IS NULL OR saas.can_access_academy_dependent(''cohorts'',cohort_id))'),
 ('class_attendance', 'saas.can_access_academy_record(''students'',student_id) AND saas.can_access_academy_record(''enrollments'',enrollment_id) AND saas.can_access_academy_dependent(''schedule_events'',schedule_event_id)'),
 ('learning_observations', 'saas.can_access_academy_record(''students'',student_id) AND saas.can_access_academy_record(''trainers'',trainer_id) AND saas.can_access_academy_record(''enrollments'',enrollment_id) AND saas.can_access_academy_dependent(''schedule_events'',schedule_event_id)'),
 ('student_fee_packages', 'saas.can_access_academy_record(''enrollments'',enrollment_id)'),
 ('student_fee_payments', 'saas.can_access_academy_dependent(''student_fee_packages'',package_id) AND (family_receipt_id IS NULL OR saas.can_access_academy_dependent(''student_family_receipts'',family_receipt_id))'),
 ('student_invoices', '(student_id IS NOT NULL OR enrollment_id IS NOT NULL) AND (student_id IS NULL OR saas.can_access_academy_record(''students'',student_id)) AND (enrollment_id IS NULL OR saas.can_access_academy_record(''enrollments'',enrollment_id)) AND (fee_package_id IS NULL OR saas.can_access_academy_dependent(''student_fee_packages'',fee_package_id)) AND (parent_id IS NULL OR (student_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.parent_students ps WHERE ps.parent_id=student_invoices.parent_id AND ps.student_id=student_invoices.student_id)))'),
 ('trainer_earnings', 'saas.can_access_academy_record(''trainers'',trainer_id) AND saas.can_access_academy_dependent(''schedule_events'',schedule_event_id)'),
 ('student_guardians', 'saas.can_access_academy_record(''students'',student_id)'),
 ('trainer_courses', 'saas.can_access_academy_record(''trainers'',trainer_id) AND saas.can_access_academy_record(''courses'',course_id)'),
 ('parent_students', 'saas.can_access_academy_record(''students'',student_id)')
 ) AS x(tbl,predicate) LOOP
  p:=rec.predicate;
  EXECUTE format('DROP POLICY IF EXISTS saas_tenant_boundary ON public.%I',rec.tbl);
  EXECUTE format('DROP POLICY IF EXISTS saas_tenant_boundary_select ON public.%I',rec.tbl);
  EXECUTE format('DROP POLICY IF EXISTS saas_tenant_boundary_update ON public.%I',rec.tbl);
  EXECUTE format('DROP POLICY IF EXISTS saas_tenant_boundary_delete ON public.%I',rec.tbl);
  EXECUTE format('DROP POLICY IF EXISTS saas_tenant_boundary_insert ON public.%I',rec.tbl);
  EXECUTE format('DROP POLICY IF EXISTS saas_tenant_select ON public.%I',rec.tbl);
  EXECUTE format('DROP POLICY IF EXISTS saas_tenant_insert ON public.%I',rec.tbl);
  EXECUTE format('CREATE POLICY saas_tenant_boundary_select ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (NOT saas.has_organization_membership() OR (%s))',rec.tbl,p);
  EXECUTE format('CREATE POLICY saas_tenant_boundary_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT saas.has_organization_membership() OR (%s)) WITH CHECK (NOT saas.has_organization_membership() OR (%s))',rec.tbl,p,p);
  EXECUTE format('CREATE POLICY saas_tenant_boundary_delete ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT saas.has_organization_membership() OR (%s))',rec.tbl,p);
  EXECUTE format('CREATE POLICY saas_tenant_boundary_insert ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT saas.has_organization_membership() OR (%s))',rec.tbl,p);
  EXECUTE format('CREATE POLICY saas_tenant_select ON public.%I FOR SELECT TO authenticated USING (saas.can_administer_selected_academy() AND (%s))',rec.tbl,p);
  EXECUTE format('CREATE POLICY saas_tenant_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (saas.can_administer_selected_academy() AND (%s))',rec.tbl,p);
 END LOOP;
END $policies$;
COMMIT;
