-- Phase 3B: defense-in-depth tenant boundaries for Academy auxiliary data.
-- All ambiguous records require explicit service-managed ownership, never guessed from names.
BEGIN;
CREATE TABLE IF NOT EXISTS saas.academy_extra_record_owners (
 resource_type text NOT NULL CHECK (resource_type ~ '^[a-z_]{3,64}$'),
 resource_key text NOT NULL,
 organization_id uuid NOT NULL REFERENCES saas.organizations(id),
 linked_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(resource_type,resource_key)
);
ALTER TABLE saas.academy_extra_record_owners ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON saas.academy_extra_record_owners FROM PUBLIC,anon,authenticated;
GRANT ALL ON saas.academy_extra_record_owners TO service_role;
CREATE INDEX IF NOT EXISTS academy_extra_record_owners_org ON saas.academy_extra_record_owners(organization_id,resource_type);

CREATE OR REPLACE FUNCTION saas.can_access_academy_extra(p_kind text,p_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE visible boolean:=false;
BEGIN
 IF saas.selected_academy_organization() IS NULL OR p_id IS NULL THEN RETURN false; END IF;
 IF p_kind='learner_projects' THEN
  SELECT EXISTS(SELECT 1 FROM public.learner_projects r WHERE r.id=p_id
   AND saas.can_access_academy_record('students',r.student_id)
   AND (r.enrollment_id IS NULL OR saas.can_access_academy_record('enrollments',r.enrollment_id))
   AND (r.course_id IS NULL OR saas.can_access_academy_record('courses',r.course_id))) INTO visible;
 ELSIF p_kind='enrollment_holds' THEN
  SELECT EXISTS(SELECT 1 FROM public.enrollment_holds r WHERE r.id=p_id
   AND saas.can_access_academy_record('students',r.student_id)
   AND saas.can_access_academy_record('enrollments',r.enrollment_id)) INTO visible;
 ELSIF p_kind='quiz_attempts' THEN
  SELECT EXISTS(SELECT 1 FROM public.quiz_attempts r WHERE r.id=p_id
   AND saas.can_access_academy_record('students',r.student_id)) INTO visible;
 ELSIF p_kind='project_submissions' THEN
  SELECT EXISTS(SELECT 1 FROM public.project_submissions r WHERE r.id=p_id
   AND saas.can_access_academy_record('students',r.student_id)) INTO visible;
 ELSIF p_kind='xp_transactions' THEN
  SELECT EXISTS(SELECT 1 FROM public.xp_transactions r WHERE r.id=p_id
   AND saas.can_access_academy_record('students',r.student_id)) INTO visible;
 ELSIF p_kind='progress_alert_actions' THEN
  SELECT EXISTS(SELECT 1 FROM public.progress_alert_actions r WHERE r.id=p_id
   AND saas.can_access_academy_record('students',r.student_id)
   AND saas.can_access_academy_record('enrollments',r.enrollment_id)) INTO visible;
 ELSIF p_kind='communication_threads' THEN
  SELECT EXISTS(SELECT 1 FROM public.communication_threads r WHERE r.id=p_id
   AND (r.student_id IS NOT NULL OR r.parent_id IS NOT NULL OR r.trainer_id IS NOT NULL)
   AND (r.student_id IS NULL OR saas.can_access_academy_record('students',r.student_id))
   AND (r.trainer_id IS NULL OR saas.can_access_academy_record('trainers',r.trainer_id))
   AND (r.parent_id IS NULL OR saas.can_access_academy_dependent('parents',r.parent_id))) INTO visible;
 ELSIF p_kind='communication_messages' THEN
  SELECT EXISTS(SELECT 1 FROM public.communication_messages r WHERE r.id=p_id
   AND saas.can_access_academy_extra('communication_threads',r.thread_id)) INTO visible;
 ELSIF p_kind IN ('parent_addresses','parent_billing_profiles','family_introductions') THEN
  IF p_kind='parent_addresses' THEN
   SELECT EXISTS(SELECT 1 FROM public.parent_addresses r WHERE r.id=p_id
    AND saas.can_access_academy_dependent('parents',r.parent_id)) INTO visible;
  ELSIF p_kind='parent_billing_profiles' THEN
   SELECT EXISTS(SELECT 1 FROM public.parent_billing_profiles r WHERE r.id=p_id
    AND saas.can_access_academy_dependent('parents',r.parent_id)) INTO visible;
  ELSE
   SELECT EXISTS(SELECT 1 FROM public.family_introductions r WHERE r.id=p_id
    AND saas.can_access_academy_dependent('parents',r.parent_id)) INTO visible;
  END IF;
 ELSIF p_kind IN ('trainer_availability','trainer_availability_overrides','trainer_finance','trainer_finance_change_requests','trainer_compensation_plans','trainer_payout_instruction_versions','trainer_payouts') THEN
  IF p_kind='trainer_availability' THEN
   SELECT EXISTS(SELECT 1 FROM public.trainer_availability r WHERE r.id=p_id
    AND saas.can_access_academy_record('trainers',r.trainer_id)) INTO visible;
  ELSIF p_kind='trainer_availability_overrides' THEN
   SELECT EXISTS(SELECT 1 FROM public.trainer_availability_overrides r WHERE r.id=p_id
    AND saas.can_access_academy_record('trainers',r.trainer_id)) INTO visible;
  ELSIF p_kind='trainer_finance' THEN
   SELECT EXISTS(SELECT 1 FROM public.trainer_finance r WHERE r.id=p_id
    AND saas.can_access_academy_record('trainers',r.trainer_id)) INTO visible;
  ELSIF p_kind='trainer_finance_change_requests' THEN
   SELECT EXISTS(SELECT 1 FROM public.trainer_finance_change_requests r WHERE r.id=p_id
    AND saas.can_access_academy_record('trainers',r.trainer_id)) INTO visible;
  ELSIF p_kind='trainer_compensation_plans' THEN
   SELECT EXISTS(SELECT 1 FROM public.trainer_compensation_plans r WHERE r.id=p_id
    AND saas.can_access_academy_record('trainers',r.trainer_id)) INTO visible;
  ELSIF p_kind='trainer_payout_instruction_versions' THEN
   SELECT EXISTS(SELECT 1 FROM public.trainer_payout_instruction_versions r WHERE r.id=p_id
    AND saas.can_access_academy_record('trainers',r.trainer_id)) INTO visible;
  ELSE
   SELECT EXISTS(SELECT 1 FROM public.trainer_payouts r WHERE r.id=p_id
    AND saas.can_access_academy_record('trainers',r.trainer_id)
    AND (r.payout_instruction_version_id IS NULL OR EXISTS(
     SELECT 1 FROM public.trainer_payout_instruction_versions v WHERE v.id=r.payout_instruction_version_id
      AND v.trainer_id=r.trainer_id))) INTO visible;
  END IF;
 ELSIF p_kind='portal_access_requests' THEN
  SELECT EXISTS(SELECT 1 FROM public.portal_access_requests r WHERE r.target_id=p_id
   AND ((r.target_type='trainer' AND saas.can_access_academy_record('trainers',r.target_id))
    OR (r.target_type='parent' AND saas.can_access_academy_dependent('parents',r.target_id)))) INTO visible;
 ELSIF p_kind IN ('onboarding_submissions','delivery_centers','correction_requests') THEN
  SELECT EXISTS(SELECT 1 FROM saas.academy_extra_record_owners o
   WHERE o.resource_type=p_kind AND o.resource_key=p_id::text
    AND o.organization_id=saas.selected_academy_organization()) INTO visible;
 END IF;
 RETURN coalesce(visible,false);
END $fn$;
REVOKE ALL ON FUNCTION saas.can_access_academy_extra(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION saas.can_access_academy_extra(text,uuid) TO authenticated,service_role;

DO $policies$ DECLARE rec record;
BEGIN
 FOR rec IN SELECT * FROM (VALUES
 ('learner_projects','saas.can_access_academy_extra(''learner_projects'',id)'),
 ('enrollment_holds','saas.can_access_academy_extra(''enrollment_holds'',id)'),
 ('quiz_attempts','saas.can_access_academy_extra(''quiz_attempts'',id)'),
 ('project_submissions','saas.can_access_academy_extra(''project_submissions'',id)'),
 ('xp_transactions','saas.can_access_academy_extra(''xp_transactions'',id)'),
 ('progress_alert_actions','saas.can_access_academy_extra(''progress_alert_actions'',id)'),
 ('communication_threads','saas.can_access_academy_extra(''communication_threads'',id)'),
 ('communication_messages','saas.can_access_academy_extra(''communication_messages'',id)'),
 ('parent_addresses','saas.can_access_academy_extra(''parent_addresses'',id)'),
 ('parent_billing_profiles','saas.can_access_academy_extra(''parent_billing_profiles'',id)'),
 ('family_introductions','saas.can_access_academy_extra(''family_introductions'',id)'),
 ('trainer_availability','saas.can_access_academy_extra(''trainer_availability'',id)'),
 ('trainer_availability_overrides','saas.can_access_academy_extra(''trainer_availability_overrides'',id)'),
 ('trainer_finance','saas.can_access_academy_extra(''trainer_finance'',id)'),
 ('trainer_finance_change_requests','saas.can_access_academy_extra(''trainer_finance_change_requests'',id)'),
 ('trainer_compensation_plans','saas.can_access_academy_extra(''trainer_compensation_plans'',id)'),
 ('trainer_payout_instruction_versions','saas.can_access_academy_extra(''trainer_payout_instruction_versions'',id)'),
 ('trainer_payouts','saas.can_access_academy_extra(''trainer_payouts'',id)'),
 ('onboarding_submissions','saas.can_access_academy_extra(''onboarding_submissions'',id)'),
 ('delivery_centers','saas.can_access_academy_extra(''delivery_centers'',id)'),
 ('correction_requests','saas.can_access_academy_extra(''correction_requests'',id)'),
 ('portal_access_requests','saas.can_access_academy_extra(''portal_access_requests'',target_id)'),
 ('parent_community_profiles','saas.can_access_academy_dependent(''parents'',parent_id)'),
 ('learning_observation_internal_notes','saas.can_access_academy_dependent(''schedule_events'',schedule_event_id) AND saas.can_access_academy_record(''students'',student_id) AND saas.can_access_academy_record(''enrollments'',enrollment_id) AND saas.can_access_academy_record(''trainers'',trainer_id)')
 ) AS x(tbl,predicate) LOOP
  EXECUTE format('DROP POLICY IF EXISTS saas_tenant_boundary ON public.%I',rec.tbl);
  EXECUTE format('CREATE POLICY saas_tenant_boundary ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (NOT saas.has_organization_membership() OR (%s)) WITH CHECK (NOT saas.has_organization_membership() OR (%s))',
   rec.tbl,rec.predicate,rec.predicate);
 END LOOP;
END $policies$;
-- Access to an Academy user's own basic profile always remains possible, while
-- administrative listing is restricted to users with an active membership in the selected org.
DROP POLICY IF EXISTS saas_tenant_boundary ON public.profiles;
CREATE POLICY saas_tenant_boundary ON public.profiles AS RESTRICTIVE FOR ALL TO authenticated
USING (NOT saas.has_organization_membership() OR id=auth.uid() OR EXISTS(
 SELECT 1 FROM saas.memberships m WHERE m.user_id=profiles.id AND
 m.organization_id=saas.selected_academy_organization() AND m.status='active'
))
WITH CHECK (NOT saas.has_organization_membership() OR id=auth.uid() OR EXISTS(
 SELECT 1 FROM saas.memberships m WHERE m.user_id=profiles.id AND
 m.organization_id=saas.selected_academy_organization() AND m.status='active'
));
COMMIT;
