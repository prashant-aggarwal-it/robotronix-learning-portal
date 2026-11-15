-- Phase3G: cross-organization trainer availability mutation denied; rollback safe.
BEGIN;
SELECT set_config('p3g.actor',m.user_id::text,true),set_config('p3g.org',m.organization_id::text,true),set_config('p3g.foreign_trainer',e.trainer_id::text,true)
FROM saas.memberships m JOIN public.profiles p ON p.id=m.user_id AND p.role='admin' AND p.active
JOIN saas.module_entitlements x ON x.organization_id=m.organization_id AND x.module_key='academy' AND x.enabled
JOIN saas.academy_enrollments ae ON ae.organization_id<>m.organization_id
JOIN public.enrollments e ON e.id=ae.enrollment_id
WHERE m.status='active' AND m.role_key IN ('owner','admin') LIMIT 1;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',current_setting('p3g.actor',true),true);
SELECT set_config('request.headers',jsonb_build_object('x-organization-id',current_setting('p3g.org',true))::text,true);
DO $test$ DECLARE denied boolean:=false; BEGIN
IF NOT saas.can_administer_selected_academy() OR current_setting('p3g.foreign_trainer',true) IS NULL
THEN RAISE EXCEPTION 'Missing authorized foreign-trainer fixture'; END IF;
BEGIN
PERFORM public.replace_trainer_availability_v1(current_setting('p3g.foreign_trainer')::uuid,'[]'::jsonb);
EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
IF NOT denied THEN RAISE EXCEPTION 'Foreign trainer availability modification was permitted'; END IF;
RAISE NOTICE 'PASS: foreign trainer availability change denied';
END $test$;
ROLLBACK;
