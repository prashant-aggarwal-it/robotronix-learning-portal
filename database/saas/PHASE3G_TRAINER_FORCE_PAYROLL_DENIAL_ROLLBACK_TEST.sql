-- DEV/staging only. Trainers must not force payroll recomputation. Transaction rolls back.
BEGIN;
SELECT set_config('p3g.actor',p.id::text,true),set_config('p3g.org',m.organization_id::text,true),set_config('p3g.event',ev.id::text,true)
FROM public.schedule_events ev JOIN public.trainers tr ON tr.id=ev.trainer_id
JOIN public.profiles p ON p.id=tr.profile_id
JOIN saas.memberships m ON m.user_id=p.id AND m.role_key='trainer' AND m.status='active'
JOIN saas.academy_enrollments ae ON ae.enrollment_id=ev.enrollment_id AND ae.organization_id=m.organization_id LIMIT 1;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',current_setting('p3g.actor',true),true);
SELECT set_config('request.headers',jsonb_build_object('x-organization-id',current_setting('p3g.org',true))::text,true);
DO $t$ DECLARE denied boolean:=false; BEGIN
 IF current_setting('p3g.actor',true) IS NULL THEN RAISE EXCEPTION 'Trainer event fixture missing'; END IF;
 BEGIN PERFORM public.sync_trainer_earning(current_setting('p3g.event')::uuid,true);
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Trainer forced payroll recomputation was permitted'; END IF;
 RAISE NOTICE 'PASS: trainer cannot force payroll recalculation';
END $t$;
ROLLBACK;
