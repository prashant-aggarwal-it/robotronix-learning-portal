-- DEV-ONLY test infrastructure. NEVER include in production or canonical installers.
-- Service-role-only, restricted to purpose-created synthetic Auth users.
BEGIN;
CREATE OR REPLACE FUNCTION public.saas_qa_fixture_create(p_user_a uuid,p_user_b uuid,p_user_multi uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); u uuid; v_email text;
BEGIN
 IF p_user_a IS NULL OR p_user_b IS NULL OR p_user_multi IS NULL OR
    p_user_a=p_user_b OR p_user_a=p_user_multi OR p_user_b=p_user_multi THEN
  RAISE EXCEPTION 'Three distinct synthetic user IDs required' USING ERRCODE='22023';
 END IF;
 FOREACH u IN ARRAY ARRAY[p_user_a,p_user_b,p_user_multi] LOOP
  SELECT lower(email) INTO v_email FROM auth.users WHERE id=u;
  IF v_email IS NULL OR v_email !~ '^saas-e2e-[a-z0-9-]+@example[.]invalid$' THEN
   RAISE EXCEPTION 'Only synthetic test Auth users can receive fixture memberships' USING ERRCODE='42501';
  END IF;
 END LOOP;
 INSERT INTO saas.organizations(id,slug,display_name) VALUES
 (a,'saas-e2e-a-'||left(replace(a::text,'-',''),12),'Synthetic School A'),
 (b,'saas-e2e-b-'||left(replace(b::text,'-',''),12),'Synthetic School B');
 INSERT INTO saas.memberships(organization_id,user_id,role_key) VALUES
 (a,p_user_a,'admin'),(b,p_user_b,'admin'),(a,p_user_multi,'admin'),(b,p_user_multi,'admin');
 INSERT INTO saas.module_entitlements(organization_id,module_key,enabled) VALUES
 (a,'academy',true),(b,'academy',true);
 RETURN jsonb_build_object('schoolA',a,'schoolB',b);
END $fn$;
REVOKE ALL ON FUNCTION public.saas_qa_fixture_create(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.saas_qa_fixture_create(uuid,uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.saas_qa_fixture_cleanup(p_school_a uuid,p_school_b uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE ids uuid[]:=ARRAY[p_school_a,p_school_b];
BEGIN
 IF p_school_a IS NULL OR p_school_b IS NULL OR p_school_a=p_school_b OR
  (SELECT count(*) FROM saas.organizations WHERE id=ANY(ids) AND slug ~ '^saas-e2e-[ab]-[a-f0-9]{12}$')<>2 THEN
  RAISE EXCEPTION 'Unsafe fixture cleanup: unexpected organization IDs' USING ERRCODE='42501';
 END IF;
 IF EXISTS(SELECT 1 FROM saas.academy_students l JOIN public.students s ON s.id=l.student_id
  WHERE l.organization_id=ANY(ids) AND s.full_name NOT LIKE 'SaaS E2E %')
 OR EXISTS(SELECT 1 FROM saas.academy_trainers l JOIN public.trainers t ON t.id=l.trainer_id
  WHERE l.organization_id=ANY(ids) AND t.full_name NOT LIKE 'SaaS E2E %')
 OR EXISTS(SELECT 1 FROM saas.academy_courses l JOIN public.courses c ON c.id=l.course_id
  WHERE l.organization_id=ANY(ids) AND c.title NOT LIKE 'SaaS E2E %') THEN
   RAISE EXCEPTION 'Unsafe fixture cleanup: non-test Academy record linked' USING ERRCODE='42501';
 END IF;
 DELETE FROM public.enrollments e USING saas.academy_enrollments l
  WHERE e.id=l.enrollment_id AND l.organization_id=ANY(ids);
 DELETE FROM public.students s USING saas.academy_students l
  WHERE s.id=l.student_id AND l.organization_id=ANY(ids);
 DELETE FROM public.trainers t USING saas.academy_trainers l
  WHERE t.id=l.trainer_id AND l.organization_id=ANY(ids);
 DELETE FROM public.courses c USING saas.academy_courses l
  WHERE c.id=l.course_id AND l.organization_id=ANY(ids);
 DELETE FROM saas.module_entitlements WHERE organization_id=ANY(ids);
 DELETE FROM saas.memberships WHERE organization_id=ANY(ids);
 DELETE FROM saas.organizations WHERE id=ANY(ids);
END $fn$;
REVOKE ALL ON FUNCTION public.saas_qa_fixture_cleanup(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.saas_qa_fixture_cleanup(uuid,uuid) TO service_role;
COMMIT;
