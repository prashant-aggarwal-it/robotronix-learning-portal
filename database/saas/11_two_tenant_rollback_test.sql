-- Run only on nonproduction DEV. No fixture survives; all DML is rolled back.
BEGIN;
DO $fixture$
DECLARE
 a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid();
 ua uuid:=gen_random_uuid(); ub uuid:=gen_random_uuid();
 sa uuid;sb uuid;ca uuid;cb uuid;ta uuid;tb uuid; e uuid;
 payload jsonb; blocked boolean; passed integer:=0;
BEGIN
 INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password) VALUES
 (ua,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','test-a-'||ua||'@example.invalid',''),
 (ub,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','test-b-'||ub||'@example.invalid','');
 INSERT INTO saas.organizations(id,slug,display_name) VALUES
 (a,'two-tenant-a-'||left(a::text,8),'Synthetic School A'),
 (b,'two-tenant-b-'||left(b::text,8),'Synthetic School B');
 INSERT INTO saas.memberships(organization_id,user_id,role_key) VALUES(a,ua,'admin'),(b,ub,'admin');
 INSERT INTO saas.module_entitlements(organization_id,module_key,enabled) VALUES(a,'academy',true),(b,'academy',true);
 payload:=public.saas_academy_v1(ua,a,'students','create',null,'{"full_name":"Synthetic Student A"}');sa=(payload->>'id')::uuid;
 payload:=public.saas_academy_v1(ub,b,'students','create',null,'{"full_name":"Synthetic Student B"}');sb=(payload->>'id')::uuid;
 payload:=public.saas_academy_v1(ua,a,'courses','create',null,
 jsonb_build_object('title','Synthetic Course A','slug','tc-a-'||left(a::text,8),'code','TCA'||left(a::text,8),'category','Robotics','grade_from',1,'grade_to',8,'total_sessions',8));ca=(payload->>'id')::uuid;
 payload:=public.saas_academy_v1(ub,b,'courses','create',null,
 jsonb_build_object('title','Synthetic Course B','slug','tc-b-'||left(b::text,8),'code','TCB'||left(b::text,8),'category','Robotics','grade_from',1,'grade_to',8,'total_sessions',8));cb=(payload->>'id')::uuid;
 payload:=public.saas_academy_v1(ua,a,'trainers','create',null,'{"full_name":"Synthetic Trainer A"}');ta=(payload->>'id')::uuid;
 payload:=public.saas_academy_v1(ub,b,'trainers','create',null,'{"full_name":"Synthetic Trainer B"}');tb=(payload->>'id')::uuid;
 payload:=public.saas_academy_v1(ua,a,'enrollments','create',null,jsonb_build_object('student_id',sa,'course_id',ca,'trainer_id',ta));
 e=(payload->>'id')::uuid;
 IF e IS NULL THEN RAISE EXCEPTION 'Authorized enrollment missing'; END IF;passed:=passed+1;
 IF jsonb_array_length(public.saas_academy_v1(ua,a,'students','list'))<>1 OR
    jsonb_array_length(public.saas_academy_v1(ub,b,'students','list'))<>1 THEN RAISE EXCEPTION 'Student leakage'; END IF;passed:=passed+1;
 IF jsonb_array_length(public.saas_academy_v1(ua,a,'courses','list'))<>1 OR
    jsonb_array_length(public.saas_academy_v1(ub,b,'courses','list'))<>1 THEN RAISE EXCEPTION 'Course leakage'; END IF;passed:=passed+1;
 blocked:=false;
 BEGIN PERFORM public.saas_academy_v1(ua,a,'students','get',sb); EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Cross-tenant student read allowed'; END IF;passed:=passed+1;
 blocked:=false;
 BEGIN PERFORM public.saas_academy_v1(ua,a,'courses','update',cb,'{"title":"Unsafe"}'); EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Cross-tenant update allowed'; END IF;passed:=passed+1;
 blocked:=false;
 BEGIN PERFORM public.saas_academy_v1(ua,a,'enrollments','create',null,jsonb_build_object('student_id',sa,'course_id',cb,'trainer_id',ta)); EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Mixed-tenant enrollment allowed'; END IF;passed:=passed+1;
 blocked:=false;
 BEGIN PERFORM public.saas_academy_v1(ua,b,'students','list'); EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Foreign organization allowed'; END IF;passed:=passed+1;
 UPDATE saas.module_entitlements SET enabled=false WHERE organization_id=a AND module_key='academy';
 blocked:=false;
 BEGIN PERFORM public.saas_academy_v1(ua,a,'students','list'); EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Disabled Academy entitlement allowed'; END IF;passed:=passed+1;
 UPDATE saas.module_entitlements SET enabled=true WHERE organization_id=a AND module_key='academy';
 UPDATE saas.memberships SET status='removed' WHERE organization_id=a AND user_id=ua;
 blocked:=false;
 BEGIN PERFORM public.saas_academy_v1(ua,a,'students','list'); EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Revoked membership allowed'; END IF;passed:=passed+1;
 UPDATE saas.memberships SET status='active' WHERE organization_id=a AND user_id=ua;
 UPDATE saas.organizations SET status='suspended' WHERE id=a;
 blocked:=false;
 BEGIN PERFORM public.saas_academy_v1(ua,a,'students','list'); EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Suspended tenant allowed'; END IF;passed:=passed+1;
 IF passed<>10 THEN RAISE EXCEPTION 'Unexpected assertion count: %',passed; END IF;
 RAISE NOTICE '10/10 transactional SaaS Academy database assertions passed';
END $fixture$;
ROLLBACK;
