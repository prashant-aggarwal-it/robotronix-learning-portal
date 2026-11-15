-- Phase3G positive tenant authorization regression, DEV/staging only.
BEGIN;
SELECT set_config('p3g.actor',m.user_id::text,true),set_config('p3g.org',m.organization_id::text,true),set_config('p3g.enrollment',en.id::text,true)
FROM saas.memberships m JOIN public.profiles p ON p.id=m.user_id AND p.role='admin' AND p.active
JOIN saas.module_entitlements x ON x.organization_id=m.organization_id AND x.module_key='academy' AND x.enabled
JOIN saas.academy_enrollments ae ON ae.organization_id=m.organization_id
JOIN public.enrollments en ON en.id=ae.enrollment_id
WHERE m.status='active' AND m.role_key IN ('owner','admin') LIMIT 1;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',current_setting('p3g.actor',true),true);
SELECT set_config('request.headers',jsonb_build_object('x-organization-id',current_setting('p3g.org',true))::text,true);
DO $test$
DECLARE result jsonb;
BEGIN
 IF NOT saas.can_administer_selected_academy()
 OR NOT saas.can_access_academy_record('enrollments',current_setting('p3g.enrollment')::uuid)
 THEN RAISE EXCEPTION 'Valid same-tenant admin access denied'; END IF;
 result:=public.generate_enrollment_schedule_v2(current_setting('p3g.enrollment')::uuid,'manual',NULL);
 IF result->>'mode' IS DISTINCT FROM 'manual' THEN RAISE EXCEPTION 'Valid manual mode failed'; END IF;
 RAISE NOTICE 'PASS: same-tenant admin manual enrollment scheduling';
END $test$;
ROLLBACK;
