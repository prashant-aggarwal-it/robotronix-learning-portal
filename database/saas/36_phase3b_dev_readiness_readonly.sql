-- Phase 3B DEV readiness. Read-only; does not need or expose customer data.
-- An installation with organizations but no active members is not an interactive SaaS fixture.
WITH metrics AS (
 SELECT (SELECT count(*) FROM saas.organizations WHERE status='active') AS organizations,
 (SELECT count(*) FROM saas.memberships WHERE status='active') AS members,
 (SELECT count(*) FROM saas.module_entitlements WHERE module_key='academy' AND enabled) AS enabled_academies,
 (SELECT count(*) FROM saas.academy_students) AS linked_students,
 (SELECT count(*) FROM saas.academy_courses) AS linked_courses,
 (SELECT count(*) FROM saas.academy_enrollments) AS linked_enrollments,
 (SELECT count(*) FROM saas.academy_course_templates) AS shared_course_templates,
 (SELECT count(*) FROM public.courses) AS total_courses,
 (SELECT count(*) FROM saas.academy_course_templates t JOIN saas.academy_courses c ON c.course_id=t.course_id) AS template_ownership_conflicts,
 (SELECT count(*) FROM saas.academy_enrollments e JOIN public.enrollments p ON p.id=e.enrollment_id
   LEFT JOIN saas.academy_students s ON s.student_id=p.student_id AND s.organization_id=e.organization_id
   LEFT JOIN saas.academy_courses c ON c.course_id=p.course_id AND c.organization_id=e.organization_id
   WHERE s.student_id IS NULL OR c.course_id IS NULL) AS mismatched_enrollments
)
SELECT *,
 CASE WHEN organizations>=2 AND members>=2 AND enabled_academies>=2
  AND linked_students>=2 AND linked_courses>=2
  AND template_ownership_conflicts=0 AND mismatched_enrollments=0
 THEN 'FIXTURE_READY_FOR_E2E' ELSE 'FIXTURE_INCOMPLETE' END AS readiness
FROM metrics;
