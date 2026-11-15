-- Phase 3G: verify same-tenant class reaches business validation, not tenant denial.
-- Existing protected DEV event must reject cancellation for protected attendance/payroll.
BEGIN;
SELECT set_config('p3g.actor',m.user_id::text,true),set_config('p3g.org',m.organization_id::text,true),
 set_config('p3g.event',ev.id::text,true)
FROM saas.memberships m JOIN public.profiles p ON p.id=m.user_id AND p.role='admin' AND p.active
JOIN saas.module_entitlements x ON x.organization_id=m.organization_id AND x.module_key='academy' AND x.enabled
JOIN saas.academy_enrollments ae ON ae.organization_id=m.organization_id
JOIN public.schedule_events ev ON ev.enrollment_id=ae.enrollment_id AND ev.status='scheduled'
WHERE m.status='active' AND m.role_key IN ('owner','admin')
 AND (EXISTS (SELECT 1 FROM public.class_attendance a WHERE a.schedule_event_id=ev.id)
 OR EXISTS(SELECT 1 FROM public.trainer_earnings t WHERE t.schedule_event_id=ev.id AND t.status IN ('approved','paid')))
LIMIT 1;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',current_setting('p3g.actor',true),true);
SELECT set_config('request.headers',jsonb_build_object('x-organization-id',current_setting('p3g.org',true))::text,true);
DO $t$
DECLARE protected boolean:=false;
BEGIN
 IF current_setting('p3g.event',true) IS NULL OR NOT saas.can_administer_selected_academy()
 THEN RAISE EXCEPTION 'Required authorized protected-event fixture absent'; END IF;
 BEGIN
 PERFORM public.cancel_class_v2(current_setting('p3g.event')::uuid,'admin','Phase3G protected event test');
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='Class has protected attendance or payroll' THEN protected:=true; ELSE RAISE; END IF;
 END;
 IF NOT protected THEN RAISE EXCEPTION 'Protected same-tenant class not rejected by business rules'; END IF;
 RAISE NOTICE 'PASS: same-tenant admin passes tenant authorization and protected history cannot be cancelled';
END $t$;
ROLLBACK;
