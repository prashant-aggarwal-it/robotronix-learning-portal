-- DEV/staging only: rollback-protected cross-tenant cohort scheduling regression.
BEGIN;
INSERT INTO public.cohorts(name,code,course_id,trainer_id,status,started_at)
SELECT 'PHASE3G QA cohort','P3GQA-'||substr(gen_random_uuid()::text,1,8),e.course_id,e.trainer_id,'planned',current_date
FROM saas.academy_enrollments ae JOIN public.enrollments e ON e.id=ae.enrollment_id LIMIT 1;
SELECT set_config('p3g.cohort',(SELECT id::text FROM public.cohorts WHERE name='PHASE3G QA cohort' LIMIT 1),true);
SELECT set_config('p3g.actor',m.user_id::text,true),set_config('p3g.org',m.organization_id::text,true)
FROM saas.memberships m JOIN public.profiles p ON p.id=m.user_id AND p.role='admin' AND p.active
JOIN saas.module_entitlements x ON x.organization_id=m.organization_id AND x.module_key='academy' AND x.enabled
JOIN public.cohorts c ON c.id=current_setting('p3g.cohort')::uuid
WHERE m.status='active' AND m.role_key IN ('owner','admin')
AND NOT saas.can_access_academy_record('courses',c.course_id)
LIMIT 1;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',current_setting('p3g.actor',true),true);
SELECT set_config('request.headers',jsonb_build_object('x-organization-id',current_setting('p3g.org',true))::text,true);
DO $t$ DECLARE denied boolean:=false; BEGIN
 IF current_setting('p3g.actor',true) IS NULL OR NOT saas.can_administer_selected_academy() THEN RAISE EXCEPTION 'Fixture admin invalid'; END IF;
 BEGIN PERFORM public.generate_cohort_schedule_v2(current_setting('p3g.cohort')::uuid,'manual',null);
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Cross-tenant cohort schedule permitted'; END IF;
 RAISE NOTICE 'PASS: foreign cohort manual scheduling denied';
END $t$;
ROLLBACK;
