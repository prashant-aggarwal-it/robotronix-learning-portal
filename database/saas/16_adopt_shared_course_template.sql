-- Phase 3B. Scoped copy of a reusable seed course into a tenant-owned course.
-- Never grants direct read access to other organizations' operational courses.
BEGIN;
CREATE OR REPLACE FUNCTION public.saas_academy_clone_course_template(
 p_actor_id uuid,p_organization_id uuid,p_template_id uuid,p_slug text,p_code text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE new_id uuid;
BEGIN
 IF p_actor_id IS NULL OR p_organization_id IS NULL OR p_template_id IS NULL
 OR p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR length(p_slug)>100
 OR p_code !~ '^[A-Z0-9-]{3,80}$' THEN
  RAISE EXCEPTION 'Invalid template adoption request' USING ERRCODE='22023';
 END IF;
 IF NOT EXISTS(
  SELECT 1 FROM saas.memberships m
  JOIN saas.organizations o ON o.id=m.organization_id
  JOIN saas.module_entitlements e ON e.organization_id=o.id AND e.module_key='academy'
  WHERE m.user_id=p_actor_id AND m.organization_id=p_organization_id AND m.status='active'
  AND m.role_key IN ('owner','admin') AND o.status='active' AND e.enabled
 ) THEN RAISE EXCEPTION 'Academy organization access denied' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(
  SELECT 1 FROM saas.academy_course_templates t JOIN public.courses c ON c.id=t.course_id
  WHERE t.course_id=p_template_id AND t.availability='available'
  AND NOT EXISTS(SELECT 1 FROM saas.academy_courses a WHERE a.course_id=c.id)
 ) THEN RAISE EXCEPTION 'Course template not available' USING ERRCODE='42501'; END IF;
 INSERT INTO public.courses(
 slug,title,short_title,code,category,grade_from,grade_to,age_from,age_to,level,
 total_sessions,session_duration,planned_hours,delivery_modes,coding_type,technologies,
 description,outcomes,projects,assessment_pattern,practice_missions,certificate,status,
 public_name,internal_name,outcome_subtitle,default_cohort_capacity,minimum_cohort_size)
 SELECT p_slug,title,short_title,p_code,category,grade_from,grade_to,age_from,age_to,level,
 total_sessions,session_duration,planned_hours,delivery_modes,coding_type,technologies,
 description,outcomes,projects,assessment_pattern,practice_missions,certificate,'draft',
 public_name,internal_name,outcome_subtitle,default_cohort_capacity,minimum_cohort_size
 FROM public.courses WHERE id=p_template_id RETURNING id INTO new_id;
 INSERT INTO saas.academy_courses(course_id,organization_id) VALUES(new_id,p_organization_id);
 RETURN new_id;
END $fn$;
REVOKE ALL ON FUNCTION public.saas_academy_clone_course_template(uuid,uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.saas_academy_clone_course_template(uuid,uuid,uuid,text,text) TO service_role;
COMMIT;
