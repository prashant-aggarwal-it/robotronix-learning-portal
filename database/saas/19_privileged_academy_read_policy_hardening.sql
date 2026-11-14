-- Phase 3B mandatory hardening: org membership alone is not a read permission.
-- Existing role-specific RLS remains the gate for trainers, parents and students.
BEGIN;
CREATE OR REPLACE FUNCTION saas.can_administer_selected_academy()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $fn$
 SELECT EXISTS(
 SELECT 1 FROM saas.memberships m
 JOIN saas.organizations o ON o.id=m.organization_id
 JOIN saas.module_entitlements e ON e.organization_id=o.id AND e.module_key='academy'
 WHERE m.user_id=auth.uid()
  AND m.organization_id=saas.selected_academy_organization()
  AND m.status='active' AND m.role_key IN ('owner','admin')
  AND o.status='active' AND e.enabled
 );
$fn$;
REVOKE ALL ON FUNCTION saas.can_administer_selected_academy() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION saas.can_administer_selected_academy() TO authenticated,service_role;
-- REST admin listing may inspect school data, but not Zoom secrets. Every row
-- must ALSO pass the restrictive organization ownership policy.
DO $policies$ DECLARE rec record;
BEGIN
 FOR rec IN SELECT * FROM (VALUES
  ('students','saas.can_access_academy_record(''students'',id)'),
  ('trainers','saas.can_access_academy_record(''trainers'',id)'),
  ('courses','saas.can_access_academy_record(''courses'',id)'),
  ('enrollments','saas.can_access_academy_record(''enrollments'',id)'),
  ('cohorts','saas.can_access_academy_dependent(''cohorts'',id)'),
  ('schedule_events','saas.can_access_academy_dependent(''schedule_events'',id)'),
  ('class_attendance','saas.can_access_academy_dependent(''class_attendance'',id)'),
  ('learning_observations','saas.can_access_academy_dependent(''learning_observations'',id)'),
  ('student_guardians','saas.can_access_academy_record(''students'',student_id)'),
  ('trainer_courses','saas.can_access_academy_record(''trainers'',trainer_id) AND saas.can_access_academy_record(''courses'',course_id)'),
  ('parent_students','saas.can_access_academy_record(''students'',student_id)')
 ) AS x(tbl,predicate) LOOP
  EXECUTE format('DROP POLICY IF EXISTS saas_tenant_select ON public.%I',rec.tbl);
  EXECUTE format('CREATE POLICY saas_tenant_select ON public.%I FOR SELECT TO authenticated USING (saas.can_administer_selected_academy() AND (%s))',rec.tbl,rec.predicate);
 END LOOP;
END $policies$;
-- Never create broad direct-to-browser read grants for sensitive domains.
DO $sensitive$ DECLARE tbl text;
BEGIN
 FOREACH tbl IN ARRAY ARRAY[
 'student_invoices','student_fee_packages','student_fee_payments','trainer_earnings',
 'portal_notifications','parents','zoom_meetings','zoom_recordings'
 ] LOOP
  EXECUTE format('DROP POLICY IF EXISTS saas_tenant_select ON public.%I',tbl);
 END LOOP;
END $sensitive$;
COMMIT;
