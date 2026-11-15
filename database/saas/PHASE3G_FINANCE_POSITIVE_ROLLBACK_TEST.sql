-- DEV-only Phase 3G finance authorization and validation test. All writes rolled back.
BEGIN;
INSERT INTO public.student_fee_packages(id,enrollment_id,name,scheme,currency,amount,start_date,end_date,installments)
SELECT gen_random_uuid(),ae.enrollment_id,'PHASE3G-POSITIVE-ROLLBACK','Full Course','INR',100,current_date,current_date+30,
jsonb_build_array(jsonb_build_object('due',current_date::text,'amount',100))
FROM saas.academy_enrollments ae LIMIT 2;
SELECT set_config('phase3g.actor',m.user_id::text,true),set_config('phase3g.org',m.organization_id::text,true),
set_config('phase3g.parent',ps.parent_id::text,true),set_config('phase3g.package',fp.id::text,true)
FROM saas.memberships m JOIN public.profiles p ON p.id=m.user_id AND p.role='admin' AND p.active
JOIN saas.module_entitlements x ON x.organization_id=m.organization_id AND x.module_key='academy' AND x.enabled
JOIN saas.academy_enrollments ae ON ae.organization_id=m.organization_id
JOIN public.enrollments en ON en.id=ae.enrollment_id
JOIN public.parent_students ps ON ps.student_id=en.student_id
JOIN public.student_fee_packages fp ON fp.enrollment_id=en.id AND fp.name='PHASE3G-POSITIVE-ROLLBACK'
WHERE m.status='active' AND m.role_key IN ('owner','admin') LIMIT 1;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',current_setting('phase3g.actor',true),true);
SELECT set_config('request.headers',jsonb_build_object('x-organization-id',current_setting('phase3g.org',true))::text,true);
DO $test$
DECLARE parent uuid:=current_setting('phase3g.parent')::uuid;
 package uuid:=current_setting('phase3g.package')::uuid;
 allocations jsonb:=jsonb_build_array(jsonb_build_object('package_id',current_setting('phase3g.package'),'amount',100));
 outcome jsonb; before_count int; denied boolean;
BEGIN
 IF NOT saas.can_administer_selected_academy() THEN RAISE EXCEPTION 'Invalid authorized fixture'; END IF;
 SELECT count(*) INTO before_count FROM public.student_family_receipts;
 outcome:=public.record_family_payment_v1(parent,'INR',100,current_date,'Cash','PHASE3G-POSITIVE',allocations,'QA','DEV');
 IF outcome->>'receipt_id' IS NULL THEN RAISE EXCEPTION 'Same-tenant payment did not create receipt'; END IF;
 IF (SELECT count(*) FROM public.student_family_receipts)<>before_count+1 THEN RAISE EXCEPTION 'Receipt count mismatch'; END IF;
 denied:=false;
 BEGIN
 PERFORM public.record_family_payment_v1(parent,'USD',100,current_date,'Cash','PHASE3G-CURRENCY',allocations,'QA','DEV');
 EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Currency mismatch accepted'; END IF;
 denied:=false;
 BEGIN
 PERFORM public.record_family_payment_v1(parent,'INR',200,current_date,'Cash','PHASE3G-DUP',
 jsonb_build_array(jsonb_build_object('package_id',package,'amount',100),jsonb_build_object('package_id',package,'amount',100)),'QA','DEV');
 EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Duplicate allocation accepted'; END IF;
 denied:=false;
 BEGIN
 PERFORM public.record_family_payment_v1(parent,'INR',-100,current_date,'Cash','PHASE3G-NEG',allocations,'QA','DEV');
 EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Negative amount accepted'; END IF;
 IF (SELECT count(*) FROM public.student_family_receipts)<>before_count+1 THEN RAISE EXCEPTION 'Failed test created receipt'; END IF;
 RAISE NOTICE 'PASS same-tenant receipt; currency mismatch; duplicate allocation; negative amount; rejected writes atomic';
END $test$;
ROLLBACK;