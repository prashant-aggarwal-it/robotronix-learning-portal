-- ROBOTRONIX DEV PERSONAS: READ-ONLY VERIFICATION
-- Run after 00_RUN_DEV_QA_DATA.sql (all eight Auth users and profiles pre-created).
-- Output provides PASS / FAIL (not merely raw audit trigger status).
WITH expected_users(email,role) AS (
 VALUES
 ('qa-admin@robotronix.local','admin'),('qa-admin-2@robotronix.local','admin'),
 ('qa-trainer@robotronix.local','trainer'),('qa-trainer-2@robotronix.local','trainer'),
 ('qa-parent@robotronix.local','parent'),('qa-parent-us@robotronix.local','parent'),
 ('qa-student@robotronix.local','student'),('qa-student-us@robotronix.local','student')
)
SELECT e.email,e.role,
 CASE WHEN u.id IS NULL THEN 'FAIL: Auth missing'
 WHEN p.id IS NULL THEN 'FAIL: Profile missing'
 WHEN p.role<>e.role THEN 'FAIL: Wrong role'
 WHEN p.active IS DISTINCT FROM true THEN 'FAIL: Inactive'
 ELSE 'PASS' END AS result
FROM expected_users e
LEFT JOIN auth.users u ON lower(u.email)=e.email
LEFT JOIN public.profiles p ON p.id=u.id
ORDER BY e.role,e.email;

SELECT 'role_counts' AS check_name,
 (SELECT count(*) FROM public.profiles WHERE role='admin' AND id IN
  (SELECT id FROM auth.users WHERE lower(email) LIKE 'qa-admin%@robotronix.local')) AS admins,
 (SELECT count(*) FROM public.profiles WHERE role='trainer' AND id IN
  (SELECT id FROM auth.users WHERE lower(email) LIKE 'qa-trainer%@robotronix.local')) AS trainers,
 (SELECT count(*) FROM public.profiles WHERE role='parent' AND id IN
  (SELECT id FROM auth.users WHERE lower(email) LIKE 'qa-parent%@robotronix.local')) AS parents,
 (SELECT count(*) FROM public.profiles WHERE role='student' AND id IN
  (SELECT id FROM auth.users WHERE lower(email) LIKE 'qa-student%@robotronix.local')) AS students;

SELECT s.full_name,s.country,s.timezone,coalesce(p.parent_login_email,'') AS parent_email,
 count(DISTINCT e.id) AS enrollment_count,
 string_agg(DISTINCT e.status,', ') AS enrollment_statuses
FROM public.students s
LEFT JOIN public.student_guardians p ON p.student_id=s.id
LEFT JOIN public.enrollments e ON e.student_id=s.id
WHERE s.id IN (
 'd0000000-0000-4000-8000-000000000001',
 'd0000000-0000-4000-8000-000000000002',
 'd0000000-0000-4000-8000-000000000003',
 'd0000000-0000-4000-8000-000000000004',
 'd0000000-0000-4000-8000-000000000005')
GROUP BY s.id,s.full_name,s.country,s.timezone,p.parent_login_email
ORDER BY s.full_name;

SELECT e.id AS enrollment_id,s.full_name AS student,t.full_name AS trainer,
 e.enrollment_type,e.status,e.schedule_timezone,
 count(DISTINCT a.id) AS recorded_attendances,
 count(DISTINCT o.id) AS observations,
 count(DISTINCT p.id) AS projects
FROM public.enrollments e
JOIN public.students s ON s.id=e.student_id
JOIN public.trainers t ON t.id=e.trainer_id
LEFT JOIN public.class_attendance a ON a.enrollment_id=e.id
LEFT JOIN public.learning_observations o ON o.enrollment_id=e.id
LEFT JOIN public.learner_projects p ON p.enrollment_id=e.id
WHERE e.id IN(
 'e0000000-0000-4000-8000-000000000001',
 'e0000000-0000-4000-8000-000000000002',
 'e0000000-0000-4000-8000-000000000003',
 'e0000000-0000-4000-8000-000000000004',
 'e0000000-0000-4000-8000-000000000005')
GROUP BY e.id,s.full_name,t.full_name,e.enrollment_type,e.status,e.schedule_timezone
ORDER BY e.id;

-- Required scenario assertions: look for PASS in each row.
WITH checks(name,ok) AS (
 VALUES
 ('Eight role identities exist',(
  SELECT count(*)=8 FROM auth.users WHERE lower(email) IN
  ('qa-admin@robotronix.local','qa-admin-2@robotronix.local',
   'qa-trainer@robotronix.local','qa-trainer-2@robotronix.local',
   'qa-parent@robotronix.local','qa-parent-us@robotronix.local',
   'qa-student@robotronix.local','qa-student-us@robotronix.local'))),
 ('Three onboarding states',(
  SELECT count(DISTINCT status)=3 FROM public.onboarding_submissions
  WHERE id IN('91000000-0000-4000-8000-000000000011',
  '91000000-0000-4000-8000-000000000012',
  '91000000-0000-4000-8000-000000000013'))),
 ('US billing package configured',(
  SELECT count(*)=1 FROM public.student_fee_packages
  WHERE id='b0000000-0000-4000-8000-000000000098'
  AND currency='USD' AND amount=180.00)),
 ('Trainer has Saturday evening availability',(
  SELECT count(*)>=1 FROM public.trainer_availability WHERE trainer_id='a0000000-0000-4000-8000-000000000002'
  AND day_of_week=6 AND start_time<='19:30' AND end_time>='20:30')),
 ('Two different trainers',(
  SELECT count(*)=2 FROM public.trainers WHERE id IN
  ('a0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000002'))),
 ('Two different parents',(
  SELECT count(*)=2 FROM public.parents WHERE id IN
  ('b0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000002'))),
 ('US learner timezone',(
  SELECT timezone='America/New_York' FROM public.students
  WHERE id='d0000000-0000-4000-8000-000000000002')),
 ('Indian paused enrollment',(
  SELECT status='on_hold' FROM public.enrollments
  WHERE id='e0000000-0000-4000-8000-000000000003')),
 ('Two learners in shared cohort',(
  SELECT count(*)=2 FROM public.enrollments
  WHERE cohort_id='c1000000-0000-4000-8000-000000000001')),
 ('Attended, absent and late examples',(
  SELECT count(DISTINCT status)=3 FROM public.class_attendance
  WHERE id IN('f1000000-0000-4000-8000-000000000011',
  'f1000000-0000-4000-8000-000000000012',
  'f1000000-0000-4000-8000-000000000013'))),
 ('Two genuine learning observations',(
  SELECT count(*)=2 FROM public.learning_observations
  WHERE id IN ('f3000000-0000-4000-8000-000000000011',
  'f3000000-0000-4000-8000-000000000012'))),
 ('Two distinct project statuses',(
  SELECT count(DISTINCT status)=2 FROM public.learner_projects
  WHERE id IN ('d1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000002'))),
 ('No fake Zoom meetings for synthetic classes',(
  SELECT count(*)=0 FROM public.zoom_meetings
  WHERE schedule_event_id IN ('f0000000-0000-4000-8000-000000000011',
  'f0000000-0000-4000-8000-000000000012',
  'f0000000-0000-4000-8000-000000000013',
  'f0000000-0000-4000-8000-000000000014',
  'f0000000-0000-4000-8000-000000000015')))
)
SELECT name,CASE WHEN coalesce(ok,false) THEN 'PASS' ELSE 'FAIL' END AS result
FROM checks ORDER BY name;
