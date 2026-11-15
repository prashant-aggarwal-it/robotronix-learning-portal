-- Phase 3G: six authenticated cross-tenant RPC denial checks. DEV/staging only.
-- Each operation must raise SQLSTATE 42501. All changes roll back.
BEGIN;
SELECT set_config('p3g.actor',m.user_id::text,true),set_config('p3g.org',m.organization_id::text,true),
set_config('p3g.enrollment',en.id::text,true),set_config('p3g.event',ev.id::text,true)
FROM saas.memberships m JOIN public.profiles p ON p.id=m.user_id AND p.role='admin' AND p.active
JOIN saas.module_entitlements x ON x.organization_id=m.organization_id AND x.module_key='academy' AND x.enabled
JOIN saas.academy_enrollments ae ON ae.organization_id<>m.organization_id
JOIN public.enrollments en ON en.id=ae.enrollment_id
JOIN public.schedule_events ev ON ev.enrollment_id=en.id
WHERE m.status='active' AND m.role_key IN ('owner','admin') LIMIT 1;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',current_setting('p3g.actor',true),true);
SELECT set_config('request.headers',jsonb_build_object('x-organization-id',current_setting('p3g.org',true))::text,true);
DO $t$ DECLARE n int:=0; BEGIN
IF current_setting('p3g.event',true) IS NULL OR NOT saas.can_administer_selected_academy()
THEN RAISE EXCEPTION 'Missing authorized foreign-resource fixture'; END IF;
BEGIN PERFORM public.reschedule_class_v2(current_setting('p3g.event')::uuid,current_date+7,'10:00','11:00','admin','QA'); EXCEPTION WHEN insufficient_privilege THEN n:=n+1; END;
BEGIN PERFORM public.create_makeup_class_v2(current_setting('p3g.event')::uuid,current_date+7,'10:00','11:00','QA'); EXCEPTION WHEN insufficient_privilege THEN n:=n+1; END;
BEGIN PERFORM public.resolve_class_cancellation_v2(current_setting('p3g.event')::uuid,'rejected','QA'); EXCEPTION WHEN insufficient_privilege THEN n:=n+1; END;
BEGIN PERFORM public.pause_enrollment_v2(current_setting('p3g.enrollment')::uuid,current_date+1,current_date+2,'QA',''); EXCEPTION WHEN insufficient_privilege THEN n:=n+1; END;
BEGIN PERFORM public.resume_enrollment_v2(current_setting('p3g.enrollment')::uuid,'QA'); EXCEPTION WHEN insufficient_privilege THEN n:=n+1; END;
BEGIN PERFORM public.pause_cohort_member_v2(current_setting('p3g.enrollment')::uuid,current_date+1,current_date+2,'QA',''); EXCEPTION WHEN insufficient_privilege THEN n:=n+1; END;
IF n<>6 THEN RAISE EXCEPTION 'Expected six tenant denials, got %',n; END IF;
RAISE NOTICE 'PASS: six cross-organization privileged operations denied';
END $t$;
ROLLBACK;
