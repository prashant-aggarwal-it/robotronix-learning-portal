-- Phase 3G DEV/staging: cross-tenant communication RPC denial, with rollback.
BEGIN;
INSERT INTO public.communication_threads(category,subject,student_id,trainer_id,unread_admin)
SELECT 'general','PHASE3G FOREIGN TEST',e.student_id,e.trainer_id,2
FROM saas.academy_enrollments ae JOIN public.enrollments e ON e.id=ae.enrollment_id LIMIT 1;
SELECT set_config('p3g.thread',(SELECT id::text FROM public.communication_threads WHERE subject='PHASE3G FOREIGN TEST' LIMIT 1),true);
SELECT set_config('p3g.actor',m.user_id::text,true),set_config('p3g.org',m.organization_id::text,true)
FROM saas.memberships m JOIN public.profiles p ON p.id=m.user_id AND p.role='admin' AND p.active
JOIN saas.module_entitlements x ON x.organization_id=m.organization_id AND x.module_key='academy' AND x.enabled
JOIN public.communication_threads t ON t.id=current_setting('p3g.thread')::uuid
JOIN saas.academy_students a ON a.student_id=t.student_id AND a.organization_id<>m.organization_id
WHERE m.status='active' AND m.role_key IN ('owner','admin') LIMIT 1;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',current_setting('p3g.actor',true),true);
SELECT set_config('request.headers',jsonb_build_object('x-organization-id',current_setting('p3g.org',true))::text,true);
DO $test$ DECLARE denied int:=0; BEGIN
 IF current_setting('p3g.actor',true) IS NULL OR NOT saas.can_administer_selected_academy() THEN RAISE EXCEPTION 'fixture missing'; END IF;
 BEGIN PERFORM public.set_communication_thread_status(current_setting('p3g.thread')::uuid,'resolved');
 EXCEPTION WHEN insufficient_privilege THEN denied:=denied+1; END;
 BEGIN PERFORM public.mark_communication_thread_read(current_setting('p3g.thread')::uuid);
 EXCEPTION WHEN insufficient_privilege THEN denied:=denied+1; END;
 IF denied<>2 THEN RAISE EXCEPTION 'Expected two cross-org denials; got %',denied; END IF;
 RAISE NOTICE 'PASS: foreign communication thread operations denied';
END $test$;
ROLLBACK;
