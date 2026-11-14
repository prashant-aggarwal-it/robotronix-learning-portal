-- Additive tenant-owned Academy service contract. The public RPC is SERVICE_ROLE ONLY.
-- The server MUST authenticate the bearer using Supabase Auth before submitting p_actor_id.
BEGIN;
CREATE OR REPLACE FUNCTION public.saas_academy_v1(
 p_actor_id uuid,p_organization_id uuid,p_kind text,p_action text,
 p_record_id uuid DEFAULT NULL,p_data jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE
 v_role text; v_enabled boolean; v_id uuid; v_owner uuid; v_result jsonb;
 v_student uuid; v_course uuid; v_trainer uuid; v_name text;
BEGIN
 IF p_actor_id IS NULL OR p_organization_id IS NULL OR
    p_kind NOT IN ('students','courses','trainers','enrollments') OR
    p_action NOT IN ('list','get','create','update') THEN
   RAISE EXCEPTION 'Invalid tenant request' USING ERRCODE='22023';
 END IF;
 SELECT m.role_key INTO v_role FROM saas.memberships m
 JOIN saas.organizations o ON o.id=m.organization_id
 WHERE m.organization_id=p_organization_id AND m.user_id=p_actor_id
   AND m.status='active' AND o.status='active';
 IF v_role IS NULL OR v_role NOT IN ('owner','admin') THEN
  RAISE EXCEPTION 'Academy organization access denied' USING ERRCODE='42501';
 END IF;
 SELECT e.enabled INTO v_enabled FROM saas.module_entitlements e
 WHERE e.organization_id=p_organization_id AND e.module_key='academy';
 IF v_enabled IS DISTINCT FROM TRUE THEN
  RAISE EXCEPTION 'Academy module disabled' USING ERRCODE='42501';
 END IF;
 IF p_action IN ('get','update') AND p_record_id IS NULL THEN
  RAISE EXCEPTION 'Record ID required' USING ERRCODE='22023';
 END IF;

 IF p_kind='students' THEN
  IF p_action='list' THEN
   SELECT coalesce(jsonb_agg(jsonb_build_object('id',s.id,'full_name',s.full_name,'grade',s.grade,'school',s.school,'record_status',s.record_status) ORDER BY s.full_name),'[]'::jsonb) INTO v_result
   FROM saas.academy_students link JOIN public.students s ON s.id=link.student_id WHERE link.organization_id=p_organization_id;
  ELSIF p_action='create' THEN
   v_name=nullif(trim(p_data->>'full_name'),'');
   IF v_name IS NULL OR length(v_name)>160 THEN RAISE EXCEPTION 'Invalid student name' USING ERRCODE='22023'; END IF;
   INSERT INTO public.students(full_name,grade,school) VALUES(v_name,left(coalesce(p_data->>'grade',''),30),left(coalesce(p_data->>'school',''),160)) RETURNING id INTO v_id;
   INSERT INTO saas.academy_students(student_id,organization_id) VALUES(v_id,p_organization_id);
   v_result=jsonb_build_object('id',v_id,'full_name',v_name);
  ELSE
   SELECT organization_id INTO v_owner FROM saas.academy_students WHERE student_id=p_record_id;
   IF v_owner IS DISTINCT FROM p_organization_id THEN RAISE EXCEPTION 'Student not accessible' USING ERRCODE='42501'; END IF;
   IF p_action='update' THEN
    IF p_data ? 'full_name' AND (nullif(trim(p_data->>'full_name'),'') IS NULL OR length(p_data->>'full_name')>160) THEN
     RAISE EXCEPTION 'Invalid student name' USING ERRCODE='22023';
    END IF;
    UPDATE public.students SET full_name=coalesce(p_data->>'full_name',full_name),
      grade=left(coalesce(p_data->>'grade',grade),30),school=left(coalesce(p_data->>'school',school),160),updated_at=now()
     WHERE id=p_record_id;
   END IF;
   SELECT jsonb_build_object('id',id,'full_name',full_name,'grade',grade,'school',school) INTO v_result FROM public.students WHERE id=p_record_id;
  END IF;

 ELSIF p_kind='courses' THEN
  IF p_action='list' THEN
   SELECT coalesce(jsonb_agg(jsonb_build_object('id',c.id,'title',c.title,'code',c.code,'status',c.status) ORDER BY c.title),'[]'::jsonb) INTO v_result
   FROM saas.academy_courses link JOIN public.courses c ON c.id=link.course_id WHERE link.organization_id=p_organization_id;
  ELSIF p_action='create' THEN
   v_name=nullif(trim(p_data->>'title'),'');
   IF v_name IS NULL OR length(v_name)>160 OR nullif(trim(p_data->>'slug'),'') IS NULL OR nullif(trim(p_data->>'code'),'') IS NULL THEN
    RAISE EXCEPTION 'Course title, slug and code required' USING ERRCODE='22023';
   END IF;
   IF (p_data->>'grade_from')::int NOT BETWEEN 0 AND 12 OR (p_data->>'grade_to')::int NOT BETWEEN 0 AND 12 OR
      (p_data->>'total_sessions')::int NOT BETWEEN 0 AND 1000 THEN
    RAISE EXCEPTION 'Invalid course grade or session count' USING ERRCODE='22023';
   END IF;
   INSERT INTO public.courses(slug,title,code,category,grade_from,grade_to,total_sessions,public_name,internal_name)
   VALUES(p_data->>'slug',v_name,p_data->>'code',coalesce(nullif(p_data->>'category',''),'Robotics'),
     (p_data->>'grade_from')::int,(p_data->>'grade_to')::int,(p_data->>'total_sessions')::int,v_name,v_name)
   RETURNING id INTO v_id;
   INSERT INTO saas.academy_courses(course_id,organization_id) VALUES(v_id,p_organization_id);
   v_result=jsonb_build_object('id',v_id,'title',v_name);
  ELSE
   SELECT organization_id INTO v_owner FROM saas.academy_courses WHERE course_id=p_record_id;
   IF v_owner IS DISTINCT FROM p_organization_id THEN RAISE EXCEPTION 'Course not accessible' USING ERRCODE='42501'; END IF;
   IF p_action='update' THEN
    IF p_data ? 'title' AND nullif(trim(p_data->>'title'),'') IS NULL THEN RAISE EXCEPTION 'Invalid title' USING ERRCODE='22023'; END IF;
    UPDATE public.courses SET title=coalesce(p_data->>'title',title),updated_at=now() WHERE id=p_record_id;
   END IF;
   SELECT jsonb_build_object('id',id,'title',title,'code',code,'status',status) INTO v_result FROM public.courses WHERE id=p_record_id;
  END IF;

 ELSIF p_kind='trainers' THEN
  IF p_action='list' THEN
   SELECT coalesce(jsonb_agg(jsonb_build_object('id',t.id,'full_name',t.full_name,'designation',t.designation) ORDER BY t.full_name),'[]'::jsonb) INTO v_result
   FROM saas.academy_trainers link JOIN public.trainers t ON t.id=link.trainer_id WHERE link.organization_id=p_organization_id;
  ELSIF p_action='create' THEN
   v_name=nullif(trim(p_data->>'full_name'),'');
   IF v_name IS NULL OR length(v_name)>160 THEN RAISE EXCEPTION 'Invalid trainer name' USING ERRCODE='22023'; END IF;
   INSERT INTO public.trainers(full_name) VALUES(v_name) RETURNING id INTO v_id;
   INSERT INTO saas.academy_trainers(trainer_id,organization_id) VALUES(v_id,p_organization_id);
   v_result=jsonb_build_object('id',v_id,'full_name',v_name);
  ELSE
   SELECT organization_id INTO v_owner FROM saas.academy_trainers WHERE trainer_id=p_record_id;
   IF v_owner IS DISTINCT FROM p_organization_id THEN RAISE EXCEPTION 'Trainer not accessible' USING ERRCODE='42501'; END IF;
   IF p_action='update' THEN
    IF p_data ? 'full_name' AND nullif(trim(p_data->>'full_name'),'') IS NULL THEN RAISE EXCEPTION 'Invalid trainer name' USING ERRCODE='22023'; END IF;
    UPDATE public.trainers SET full_name=coalesce(p_data->>'full_name',full_name),updated_at=now() WHERE id=p_record_id;
   END IF;
   SELECT jsonb_build_object('id',id,'full_name',full_name) INTO v_result FROM public.trainers WHERE id=p_record_id;
  END IF;

 ELSE -- enrollments
  IF p_action='list' THEN
   SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.id,'student_id',e.student_id,'course_id',e.course_id,'trainer_id',e.trainer_id,'status',e.status) ORDER BY e.created_at),'[]'::jsonb) INTO v_result
   FROM saas.academy_enrollments link JOIN public.enrollments e ON e.id=link.enrollment_id WHERE link.organization_id=p_organization_id;
  ELSIF p_action='create' THEN
   v_student=(p_data->>'student_id')::uuid;
   v_course=(p_data->>'course_id')::uuid;
   v_trainer=(p_data->>'trainer_id')::uuid;
   IF NOT saas.enrollment_parties_match(p_organization_id,v_student,v_course,v_trainer) THEN
    RAISE EXCEPTION 'Cross-tenant enrollment denied' USING ERRCODE='42501';
   END IF;
   INSERT INTO public.enrollments(student_id,course_id,trainer_id,enrollment_type,started_at)
   VALUES(v_student,v_course,v_trainer,'one_to_one',current_date) RETURNING id INTO v_id;
   INSERT INTO saas.academy_enrollments(enrollment_id,organization_id) VALUES(v_id,p_organization_id);
   v_result=jsonb_build_object('id',v_id,'student_id',v_student,'course_id',v_course,'trainer_id',v_trainer);
  ELSE
   SELECT organization_id INTO v_owner FROM saas.academy_enrollments WHERE enrollment_id=p_record_id;
   IF v_owner IS DISTINCT FROM p_organization_id THEN RAISE EXCEPTION 'Enrollment not accessible' USING ERRCODE='42501'; END IF;
   IF p_action='update' THEN
    IF p_data->>'status' NOT IN ('active','on_hold','completed','cancelled') THEN
     RAISE EXCEPTION 'Invalid enrollment status' USING ERRCODE='22023';
    END IF;
    UPDATE public.enrollments SET status=p_data->>'status',updated_at=now() WHERE id=p_record_id;
   END IF;
   SELECT jsonb_build_object('id',id,'student_id',student_id,'course_id',course_id,'trainer_id',trainer_id,'status',status)
   INTO v_result FROM public.enrollments WHERE id=p_record_id;
  END IF;
 END IF;
 RETURN coalesce(v_result,'null'::jsonb);
END;
$fn$;
REVOKE ALL ON FUNCTION public.saas_academy_v1(uuid,uuid,text,text,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.saas_academy_v1(uuid,uuid,text,text,uuid,jsonb) TO service_role;
COMMIT;
