-- Phase 3G rollback-only cross-tenant family payment regression. DEV/staging only.
BEGIN;
INSERT INTO public.student_fee_packages(id,enrollment_id,name,scheme,currency,amount,start_date,end_date,installments)
SELECT gen_random_uuid(),enrollment_id,'PHASE3G-ROLLBACK-TEST','one_time','INR',100,current_date,current_date+30,
 jsonb_build_array(jsonb_build_object('amount',100,'due',current_date::text))
FROM saas.academy_enrollments LIMIT 2;
SELECT set_config('phase3g.actor',m.user_id::text,true),set_config('phase3g.organization',m.organization_id::text,true),
 set_config('phase3g.foreign_parent',ps.parent_id::text,true),set_config('phase3g.foreign_package',fp.id::text,true)
FROM saas.memberships m
JOIN public.profiles p ON p.id=m.user_id AND p.role='admin' AND p.active
JOIN saas.module_entitlements x ON x.organization_id=m.organization_id AND x.module_key='academy' AND x.enabled
JOIN saas.academy_enrollments ae ON ae.organization_id<>m.organization_id
JOIN public.enrollments en ON en.id=ae.enrollment_id
JOIN public.parent_students ps ON ps.student_id=en.student_id
JOIN public.student_fee_packages fp ON fp.enrollment_id=en.id AND fp.name='PHASE3G-ROLLBACK-TEST'
WHERE m.status='active' AND m.role_key IN ('owner','admin') LIMIT 1;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',current_setting('phase3g.actor',true),true);
SELECT set_config('request.headers',jsonb_build_object('x-organization-id',current_setting('phase3g.organization',true))::text,true);
DO $test$
DECLARE denied boolean:=false; v_before int; v_after int;
BEGIN
 IF current_setting('phase3g.foreign_package',true) IS NULL OR NOT saas.can_administer_selected_academy() THEN RAISE EXCEPTION 'Test fixture unavailable'; END IF;
 SELECT count(*) INTO v_before FROM public.student_family_receipts;
 BEGIN
 PERFORM public.record_family_payment_v1(current_setting('phase3g.foreign_parent')::uuid,'INR',100,current_date,'Cash','PHASE3G-TEST',
 jsonb_build_array(jsonb_build_object('package_id',current_setting('phase3g.foreign_package'),'amount',100)),'QA','DEV');
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Unauthorized cross-organization payment allocation was permitted'; END IF;
 SELECT count(*) INTO v_after FROM public.student_family_receipts;
 IF v_before<>v_after THEN RAISE EXCEPTION 'Receipt changed despite denied payment'; END IF;
 RAISE NOTICE 'PASS: cross-organization payment allocation denied without creating receipt';
END $test$;
ROLLBACK;
