-- Phase 3B migration preflight. READ ONLY. Run before any ownership backfill.
-- Unmapped records are never implicitly assigned to an organization.
SELECT 'students' AS entity,count(*) AS total,
 count(*) FILTER (WHERE l.student_id IS NULL) AS unmapped
 FROM public.students r LEFT JOIN saas.academy_students l ON l.student_id=r.id
UNION ALL SELECT 'trainers',count(*),count(*) FILTER (WHERE l.trainer_id IS NULL)
 FROM public.trainers r LEFT JOIN saas.academy_trainers l ON l.trainer_id=r.id
UNION ALL SELECT 'courses',count(*),count(*) FILTER (WHERE l.course_id IS NULL)
 FROM public.courses r LEFT JOIN saas.academy_courses l ON l.course_id=r.id
UNION ALL SELECT 'enrollments',count(*),count(*) FILTER (WHERE l.enrollment_id IS NULL)
 FROM public.enrollments r LEFT JOIN saas.academy_enrollments l ON l.enrollment_id=r.id;
-- A course remains unassigned until its source and ownership are proven.
SELECT c.id,c.code,c.title,coalesce(c.category,'') AS category
 FROM public.courses c LEFT JOIN saas.academy_courses l ON l.course_id=c.id
 WHERE l.course_id IS NULL ORDER BY c.title,c.id;
