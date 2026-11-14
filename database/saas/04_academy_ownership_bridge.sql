-- Additive ownership registry for Academy canonical records.
-- No modifications to Academy/CRM/Tasks objects, APIs or existing RLS.
BEGIN;
CREATE TABLE saas.academy_students (
 student_id uuid PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
 organization_id uuid NOT NULL REFERENCES saas.organizations(id),
 linked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX academy_students_org ON saas.academy_students(organization_id,student_id);
CREATE TABLE saas.academy_courses (
 course_id uuid PRIMARY KEY REFERENCES public.courses(id) ON DELETE CASCADE,
 organization_id uuid NOT NULL REFERENCES saas.organizations(id),
 linked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX academy_courses_org ON saas.academy_courses(organization_id,course_id);
CREATE TABLE saas.academy_trainers (
 trainer_id uuid PRIMARY KEY REFERENCES public.trainers(id) ON DELETE CASCADE,
 organization_id uuid NOT NULL REFERENCES saas.organizations(id),
 linked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX academy_trainers_org ON saas.academy_trainers(organization_id,trainer_id);
CREATE TABLE saas.academy_enrollments (
 enrollment_id uuid PRIMARY KEY REFERENCES public.enrollments(id) ON DELETE CASCADE,
 organization_id uuid NOT NULL REFERENCES saas.organizations(id),
 linked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX academy_enrollments_org ON saas.academy_enrollments(organization_id,enrollment_id);
DO $tables$ DECLARE rec record; BEGIN
 FOR rec IN SELECT tablename FROM pg_tables WHERE schemaname='saas' AND tablename LIKE 'academy_%' LOOP
  EXECUTE format('ALTER TABLE saas.%I ENABLE ROW LEVEL SECURITY',rec.tablename);
  EXECUTE format('REVOKE ALL ON saas.%I FROM PUBLIC,anon,authenticated',rec.tablename);
  EXECUTE format('GRANT ALL ON saas.%I TO service_role',rec.tablename);
 END LOOP;
END $tables$;
-- Safe, read-only relation guard used by future tenant-aware enrollment APIs.
CREATE FUNCTION saas.enrollment_parties_match(p_org uuid,p_student uuid,p_course uuid,p_trainer uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $fn$
 SELECT EXISTS(SELECT 1 FROM saas.academy_students WHERE student_id=p_student AND organization_id=p_org)
 AND EXISTS(SELECT 1 FROM saas.academy_courses WHERE course_id=p_course AND organization_id=p_org)
 AND EXISTS(SELECT 1 FROM saas.academy_trainers WHERE trainer_id=p_trainer AND organization_id=p_org);
$fn$;
REVOKE ALL ON FUNCTION saas.enrollment_parties_match(uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION saas.enrollment_parties_match(uuid,uuid,uuid,uuid) TO service_role;
-- Server-side admission linkage refuses mixed-tenant resources and mismatched enrollment IDs.
CREATE FUNCTION saas.link_academy_enrollment(p_org uuid,p_enrollment uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE e record;
BEGIN
 SELECT student_id,course_id,trainer_id INTO e FROM public.enrollments WHERE id=p_enrollment;
 IF NOT FOUND THEN RAISE EXCEPTION 'Enrollment not found' USING ERRCODE='23503'; END IF;
 IF NOT saas.enrollment_parties_match(p_org,e.student_id,e.course_id,e.trainer_id) THEN
  RAISE EXCEPTION 'Cross-organization enrollment relationship denied' USING ERRCODE='42501';
 END IF;
 INSERT INTO saas.academy_enrollments(enrollment_id,organization_id) VALUES(p_enrollment,p_org)
 ON CONFLICT (enrollment_id) DO UPDATE SET organization_id=EXCLUDED.organization_id
 WHERE saas.academy_enrollments.organization_id=EXCLUDED.organization_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Enrollment already belongs to another organization' USING ERRCODE='42501'; END IF;
END $fn$;
REVOKE ALL ON FUNCTION saas.link_academy_enrollment(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION saas.link_academy_enrollment(uuid,uuid) TO service_role;
COMMIT;
