-- Phase 3G live DEV/staging negative tenant tests. Never execute on production.
-- Runs against synthetic or disposable test enrollments and an authorized admin from another organization.
-- All changes, including database locks and any accidental writes, roll back.
BEGIN;
SELECT set_config('phase3g.actor',m.user_id::text,true),
       set_config('phase3g.selected_org',m.organization_id::text,true),
       set_config('phase3g.foreign_enrollment',e.enrollment_id::text,true)
FROM saas.memberships m
JOIN public.profiles p ON p.id=m.user_id AND p.active AND p.role='admin'
JOIN saas.module_entitlements x ON x.organization_id=m.organization_id AND x.module_key='academy' AND x.enabled
JOIN saas.academy_enrollments e ON e.organization_id<>m.organization_id
WHERE m.status='active' AND m.role_key IN ('admin','owner') LIMIT 1;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',current_setting('phase3g.actor',true),true);
SELECT set_config('request.headers',jsonb_build_object('x-organization-id',current_setting('phase3g.selected_org',true))::text,true);
DO $test$
DECLARE target uuid:=current_setting('phase3g.foreign_enrollment',true)::uuid;
        denied boolean:=false;
BEGIN
 IF NOT saas.can_administer_selected_academy() THEN
  RAISE EXCEPTION 'Invalid test setup: no authorized organization admin';
 END IF;
 BEGIN
  PERFORM public.generate_enrollment_schedule_v2(target,'manual',NULL);
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Cross-organization manual scheduling was permitted'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.reassign_enrollment_trainer_v2(target,
   '00000000-0000-0000-0000-000000000000'::uuid,'Phase 3G isolation check');
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Cross-organization trainer reassignment was permitted'; END IF;
 RAISE NOTICE 'PASS: cross-tenant manual scheduling and reassignment denied';
END $test$;
ROLLBACK;
