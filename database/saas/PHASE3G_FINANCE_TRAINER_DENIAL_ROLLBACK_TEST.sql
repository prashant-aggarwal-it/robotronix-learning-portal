-- Phase 3G trainer denial; DEV/staging only, rollback protected.
BEGIN;
SELECT set_config('phase3g.trainer',m.user_id::text,true),
 set_config('phase3g.org',m.organization_id::text,true)
FROM saas.memberships m WHERE m.role_key='trainer' AND m.status='active' LIMIT 1;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',current_setting('phase3g.trainer',true),true);
SELECT set_config('request.headers',jsonb_build_object('x-organization-id',current_setting('phase3g.org',true))::text,true);
DO $test$ DECLARE denied boolean:=false;
BEGIN
 IF current_setting('phase3g.trainer',true) IS NULL THEN RAISE EXCEPTION 'Trainer fixture missing'; END IF;
 IF public.is_admin() THEN RAISE EXCEPTION 'Trainer incorrectly has legacy admin role'; END IF;
 BEGIN
  PERFORM public.record_family_payment_v1(
   '00000000-0000-0000-0000-000000000000'::uuid,
   'INR',100,current_date,'Cash','PHASE3G-DENY','[]'::jsonb,'QA','DEV');
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE '%Admin access required%' THEN denied:=true; ELSE RAISE; END IF;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Trainer could execute family payment'; END IF;
 RAISE NOTICE 'PASS: trainer denied privileged family payment';
END $test$;
ROLLBACK;
