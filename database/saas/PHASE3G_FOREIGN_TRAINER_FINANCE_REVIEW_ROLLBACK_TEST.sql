-- Phase3G DEV/staging: foreign trainer finance request must not be reviewed.
BEGIN;
INSERT INTO public.trainer_finance_change_requests(trainer_id,preferred_payout_method,status)
SELECT e.trainer_id,'other','pending'
FROM saas.academy_enrollments ae JOIN public.enrollments e ON e.id=ae.enrollment_id LIMIT 1;
SELECT set_config('p3g.req',(SELECT id::text FROM public.trainer_finance_change_requests WHERE status='pending' ORDER BY submitted_at DESC LIMIT 1),true);
SELECT set_config('p3g.actor',m.user_id::text,true),set_config('p3g.org',m.organization_id::text,true)
FROM saas.memberships m JOIN public.profiles p ON p.id=m.user_id AND p.role='admin' AND p.active
JOIN saas.module_entitlements x ON x.organization_id=m.organization_id AND x.module_key='academy' AND x.enabled
JOIN public.trainer_finance_change_requests r ON r.id=current_setting('p3g.req')::uuid
JOIN saas.academy_trainers t ON t.trainer_id=r.trainer_id AND t.organization_id<>m.organization_id
WHERE m.status='active' AND m.role_key IN ('owner','admin') LIMIT 1;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',current_setting('p3g.actor',true),true);
SELECT set_config('request.headers',jsonb_build_object('x-organization-id',current_setting('p3g.org',true))::text,true);
DO $test$ DECLARE denied boolean:=false; BEGIN
 IF current_setting('p3g.actor',true) IS NULL OR NOT saas.can_administer_selected_academy() THEN RAISE EXCEPTION 'Invalid admin fixture'; END IF;
 BEGIN PERFORM public.review_trainer_finance_request(current_setting('p3g.req')::uuid,'reject','QA foreign trainer request');
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Foreign trainer finance review permitted'; END IF;
 RAISE NOTICE 'PASS: foreign trainer finance review denied';
END $test$;
ROLLBACK;
