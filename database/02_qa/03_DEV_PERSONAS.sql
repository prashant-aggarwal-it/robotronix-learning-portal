-- ROBOTRONIX DEV PERSONA DATASET V1
-- Synthetic records ONLY. Run in a dedicated DEV Supabase project.
-- Requires successful fresh install + database/02_qa/01_QA_SEED.sql.
-- This is an ADDITIVE, repeatable QA dataset, not a schema migration.
-- Does not create Auth users, contact real families or create Razorpay/Zoom transactions.
-- Keep the four baseline Auth accounts from 01_QA_SEED.sql, and create these four more:
--   qa-admin-2@robotronix.local
--   qa-trainer-2@robotronix.local
--   qa-parent-us@robotronix.local
--   qa-student-us@robotronix.local
-- IMPORTANT: never run on production. Rerunning restores synthetic fixture values.

BEGIN;

DO $guard$
DECLARE missing text;
BEGIN
 SELECT string_agg(req.email, ', ') INTO missing
 FROM (VALUES
 ('qa-admin@robotronix.local'),
 ('qa-trainer@robotronix.local'),
 ('qa-parent@robotronix.local'),
 ('qa-student@robotronix.local'),
 ('qa-admin-2@robotronix.local'),
 ('qa-trainer-2@robotronix.local'),
 ('qa-parent-us@robotronix.local'),
 ('qa-student-us@robotronix.local')
 ) req(email)
 LEFT JOIN auth.users u ON lower(u.email)=req.email
 WHERE u.id IS NULL;
 IF missing IS NOT NULL THEN
  RAISE EXCEPTION 'Create missing DEV Auth users first: %', missing;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.courses WHERE id='c0000000-0000-4000-8000-000000000001')
 OR NOT EXISTS (SELECT 1 FROM public.trainers WHERE id='a0000000-0000-4000-8000-000000000001')
 OR NOT EXISTS (SELECT 1 FROM public.parents WHERE id='b0000000-0000-4000-8000-000000000001')
 THEN
  RAISE EXCEPTION 'Run database/02_qa/01_QA_SEED.sql first, after creating its four Auth users.';
 END IF;
END $guard$;

-- 2 accounts for each role, including original baseline fixtures.
-- Bypass the privilege-protection trigger only inside this explicit admin seed.
ALTER TABLE public.profiles DISABLE TRIGGER protect_profile_privileges_trg;
INSERT INTO public.profiles(id,full_name,role,active)
SELECT u.id,v.full_name,v.role,true
FROM (VALUES
 ('qa-admin-2@robotronix.local','QA Admin Two','admin'),
 ('qa-trainer-2@robotronix.local','Meera Iyer (QA Trainer)','trainer'),
 ('qa-parent-us@robotronix.local','Olivia Patel (QA Parent)','parent'),
 ('qa-student-us@robotronix.local','Mia Patel (QA Student)','student')
) v(email,full_name,role)
JOIN auth.users u ON lower(u.email)=v.email
ON CONFLICT(id) DO UPDATE SET full_name=excluded.full_name,role=excluded.role,active=true,updated_at=now();
ALTER TABLE public.profiles ENABLE TRIGGER protect_profile_privileges_trg;

-- An additional active Python course; all required course fields are cloned
-- from the vetted QA course, avoiding hand-crafted master reference values.
INSERT INTO public.courses(
 id,slug,title,short_title,code,category,grade_from,grade_to,age_from,age_to,
 level,total_sessions,session_duration,planned_hours,delivery_modes,coding_type,
 technologies,description,outcomes,projects,assessment_pattern,practice_missions,
 certificate,status,public_name,internal_name,outcome_subtitle,
 default_cohort_capacity,minimum_cohort_size)
SELECT 'c0000000-0000-4000-8000-000000000002','qa-python-explorers',
 'QA Python Explorers','QA Python','QA-PY-02','Coding',
 grade_from,grade_to,age_from,age_to,'Beginner',12,60,12,
 delivery_modes,'Text Programming',ARRAY['Python','Logic','Projects'],
 'Synthetic DEV Python course',ARRAY['Practice Python fundamentals','Build small programs'],
 ARRAY['Number game','Simple quiz'],assessment_pattern,practice_missions,certificate,
 'active','QA Python Explorers','QA Python Explorers',
 'Python learning for realistic QA',default_cohort_capacity,minimum_cohort_size
FROM public.courses WHERE id='c0000000-0000-4000-8000-000000000001'
ON CONFLICT(id) DO UPDATE SET status='active',title=excluded.title,short_title=excluded.short_title;

-- Second trainer; first remains QA Trainer from the standard seed.
INSERT INTO public.trainers(
 id,profile_id,full_name,mobile,email,city,designation,joining_date,specialties,
 record_status,login_linked,country,state,timezone)
SELECT 'a0000000-0000-4000-8000-000000000002',u.id,
 'Meera Iyer (QA Trainer)','',u.email,'Bengaluru','Robotics and Python Trainer',
 current_date-120,ARRAY['Python','Scratch','Robotics'],'active',true,
 'India','Karnataka','Asia/Kolkata'
FROM auth.users u WHERE lower(u.email)='qa-trainer-2@robotronix.local'
ON CONFLICT(id) DO UPDATE SET profile_id=excluded.profile_id,full_name=excluded.full_name,
 email=excluded.email,record_status='active',login_linked=true,updated_at=now();

INSERT INTO public.trainer_courses(trainer_id,course_id)
VALUES
 ('a0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000002'),
 ('a0000000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-000000000001'),
 ('a0000000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-000000000002')
ON CONFLICT(trainer_id,course_id) DO NOTHING;

-- Second parent is based in the US, with two linked learners.
INSERT INTO public.parents(id,profile_id,primary_phone)
SELECT 'b0000000-0000-4000-8000-000000000002',u.id,''
FROM auth.users u WHERE lower(u.email)='qa-parent-us@robotronix.local'
ON CONFLICT(id) DO UPDATE SET profile_id=excluded.profile_id,primary_phone=excluded.primary_phone;

-- Students: optional Student auth for 2nd user, and three parent-access-only learners.
INSERT INTO public.students(
 id,profile_id,full_name,dob,grade,school,city,state,country,timezone,
 preferred_class_days,preferred_time_windows,interests,previous_experience,source,record_status)
VALUES
 ('d0000000-0000-4000-8000-000000000002',
  (SELECT id FROM auth.users WHERE lower(email)='qa-student-us@robotronix.local'),
  'Mia Patel (QA USA)',current_date-interval '12 years','Grade 7','QA International School',
  'New York','New York','United States','America/New_York',
  ARRAY['Friday'],'17:00-19:00',ARRAY['Python','AI'],'Beginner','Website','active'),
 ('d0000000-0000-4000-8000-000000000003',NULL,'Aarav Sharma (QA India)',
  current_date-interval '11 years','Grade 6','QA Delhi School','Delhi','Delhi','India',
  'Asia/Kolkata',ARRAY['Monday'],'17:00-19:00',ARRAY['Robotics'],'Beginner','Instagram','active'),
 ('d0000000-0000-4000-8000-000000000004',NULL,'Noah Patel (QA USA)',
  current_date-interval '9 years','Grade 4','QA Elementary School','New York','New York',
  'United States','America/New_York',ARRAY['Saturday'],'10:00-12:00',
  ARRAY['Robotics'],'Beginner','Parent referral','active'),
 ('d0000000-0000-4000-8000-000000000005',NULL,'Anaya Sharma (QA Cohort)',
  current_date-interval '10 years','Grade 5','QA Delhi School','Delhi','Delhi','India',
  'Asia/Kolkata',ARRAY['Saturday'],'11:00-13:00',ARRAY['Coding','Robotics'],'Beginner','School','active')
ON CONFLICT(id) DO UPDATE SET profile_id=excluded.profile_id,full_name=excluded.full_name,
 grade=excluded.grade,city=excluded.city,state=excluded.state,country=excluded.country,
 timezone=excluded.timezone,record_status='active',updated_at=now();

-- Parent identifiers and billing fields use obviously synthetic details.
INSERT INTO public.student_guardians(
 student_id,primary_contact,primary_guardian_name,primary_guardian_relationship,
 primary_guardian_mobile,primary_whatsapp,parent_login_email,
 billing_name,billing_email,billing_address_line1,billing_city,billing_state,
 billing_postal_code,billing_country)
VALUES
 ('d0000000-0000-4000-8000-000000000002','mother','Olivia Patel (QA)','mother','','',
  'qa-parent-us@robotronix.local','Olivia Patel (QA)','qa-parent-us@robotronix.local',
  'QA Test Address, do not deliver','New York','New York','10001','United States'),
 ('d0000000-0000-4000-8000-000000000003','mother','QA Parent','mother','','',
  'qa-parent@robotronix.local','QA Parent','qa-parent@robotronix.local',
  'QA Test Address, do not deliver','Delhi','Delhi','110001','India'),
 ('d0000000-0000-4000-8000-000000000004','mother','Olivia Patel (QA)','mother','','',
  'qa-parent-us@robotronix.local','Olivia Patel (QA)','qa-parent-us@robotronix.local',
  'QA Test Address, do not deliver','New York','New York','10001','United States'),
 ('d0000000-0000-4000-8000-000000000005','mother','QA Parent','mother','','',
  'qa-parent@robotronix.local','QA Parent','qa-parent@robotronix.local',
  'QA Test Address, do not deliver','Delhi','Delhi','110001','India')
ON CONFLICT(student_id) DO UPDATE SET primary_guardian_name=excluded.primary_guardian_name,
 parent_login_email=excluded.parent_login_email,billing_email=excluded.billing_email,
 billing_country=excluded.billing_country,updated_at=now();

INSERT INTO public.parent_students(parent_id,student_id,relationship_label)
VALUES
 ('b0000000-0000-4000-8000-000000000002','d0000000-0000-4000-8000-000000000002','Mother'),
 ('b0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000003','Parent'),
 ('b0000000-0000-4000-8000-000000000002','d0000000-0000-4000-8000-000000000004','Mother'),
 ('b0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000005','Parent')
ON CONFLICT(parent_id,student_id) DO UPDATE SET relationship_label=excluded.relationship_label;

-- Shared cohort demonstrates more than one member under the same trainer/calendar.
INSERT INTO public.cohorts(id,name,code,course_id,trainer_id,capacity,status,
 started_at,days_of_week,start_time,end_time,cohort_label,schedule_timezone,schedule_rules,schedule_text)
VALUES('c1000000-0000-4000-8000-000000000001','QA Saturday Robotics Cohort',
 'QA-COHORT-DEV-01','c0000000-0000-4000-8000-000000000001',
 'a0000000-0000-4000-8000-000000000002',6,'active',current_date-7,
 ARRAY[6],'11:00','12:00','A','Asia/Kolkata',
 '[{"dayOfWeek":6,"startTime":"11:00","endTime":"12:00"}]'::jsonb,'Saturday 11 AM IST')
ON CONFLICT(id) DO UPDATE SET status='active',trainer_id=excluded.trainer_id,updated_at=now();

-- 1:1 India hold; 1:1 US active; 2-person India/US cohort.
-- The scheduled timezone is an IANA name; the same 5 PM Friday slot in NY
-- must cross DST correctly in app displays. We deliberately do not pre-create Zoom.
INSERT INTO public.enrollments(
 id,student_id,course_id,trainer_id,enrollment_type,cohort_id,status,started_at,
 schedule_timezone,schedule_rules,delivery_channel,schedule_mode,hold_reason,hold_from,hold_until)
VALUES
 ('e0000000-0000-4000-8000-000000000002','d0000000-0000-4000-8000-000000000002',
 'c0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000002',
 'one_to_one',NULL,'active',current_date,'America/New_York',
 '[{"dayOfWeek":5,"startTime":"17:00","endTime":"18:00"}]'::jsonb,'online','recurring',NULL,NULL,NULL),
 ('e0000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-000000000003',
 'c0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001',
 'one_to_one',NULL,'on_hold',current_date,'Asia/Kolkata',
 '[{"dayOfWeek":1,"startTime":"17:00","endTime":"18:00"}]'::jsonb,
 'online','recurring','exams',current_date,current_date+10),
 ('e0000000-0000-4000-8000-000000000004','d0000000-0000-4000-8000-000000000004',
 'c0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000002',
 'small_group','c1000000-0000-4000-8000-000000000001','active',current_date,
 'Asia/Kolkata','[{"dayOfWeek":6,"startTime":"11:00","endTime":"12:00"}]'::jsonb,
 'online','recurring',NULL,NULL,NULL),
 ('e0000000-0000-4000-8000-000000000005','d0000000-0000-4000-8000-000000000005',
 'c0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000002',
 'small_group','c1000000-0000-4000-8000-000000000001','active',current_date,
 'Asia/Kolkata','[{"dayOfWeek":6,"startTime":"11:00","endTime":"12:00"}]'::jsonb,
 'online','recurring',NULL,NULL,NULL)
ON CONFLICT(id) DO UPDATE SET status=excluded.status,trainer_id=excluded.trainer_id,
 schedule_timezone=excluded.schedule_timezone,hold_reason=excluded.hold_reason,
 hold_from=excluded.hold_from,hold_until=excluded.hold_until,updated_at=now();

INSERT INTO public.enrollment_holds(id,enrollment_id,student_id,reason,start_date,end_date,status,note)
VALUES('a1000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000003',
'd0000000-0000-4000-8000-000000000003','exams',current_date,current_date+10,'active',
'DEV QA: temporary exam pause, no class hours should accrue')
ON CONFLICT(id) DO UPDATE SET start_date=excluded.start_date,end_date=excluded.end_date,
 status='active',note=excluded.note;

INSERT INTO public.portal_access_requests(target_type,target_id,login_email,status,invited_at,updated_at,last_actor_id)
VALUES
 ('trainer','a0000000-0000-4000-8000-000000000002','qa-trainer-2@robotronix.local','linked',now(),now(),
 (SELECT id FROM auth.users WHERE lower(email)='qa-admin-2@robotronix.local')),
 ('student','d0000000-0000-4000-8000-000000000002','qa-student-us@robotronix.local','linked',now(),now(),
 (SELECT id FROM auth.users WHERE lower(email)='qa-admin-2@robotronix.local'))
ON CONFLICT(target_type,target_id) DO UPDATE SET login_email=excluded.login_email,
 status='linked',updated_at=now();

-- Completed 1:1 US learning with verified observations and two learners in a
-- completed cohort session (one attended, one absent), plus upcoming and cancelled.
INSERT INTO public.schedule_events(
 id,trainer_id,course_id,enrollment_id,cohort_id,student_id,title,date,start_time,end_time,timezone,
 event_type,delivery_mode,status,notes,occurrence_kind,requested_by,session_topic,project_worked_on,skills_worked)
VALUES
 ('f0000000-0000-4000-8000-000000000011',
 'a0000000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-000000000002',
 'e0000000-0000-4000-8000-000000000002',NULL,'d0000000-0000-4000-8000-000000000002',
 'QA Python Quiz',current_date-8,'17:00','18:00','America/New_York','class','one_to_one','conducted',
 'Synthetic teaching record','regular','admin','Python conditionals and quiz scoring','Quiz game',
 ARRAY['Conditionals','Debugging']),
 ('f0000000-0000-4000-8000-000000000012',
 'a0000000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-000000000002',
 'e0000000-0000-4000-8000-000000000002',NULL,'d0000000-0000-4000-8000-000000000002',
 'QA Python Next Class',current_date+7,'17:00','18:00','America/New_York','class','one_to_one','scheduled',
 'No Zoom room expected until JIT window','regular','admin','','',ARRAY[]::text[]),
 ('f0000000-0000-4000-8000-000000000013',
 'a0000000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-000000000001',
 NULL,'c1000000-0000-4000-8000-000000000001',NULL,
 'QA Cohort Sensor Challenge',current_date-7,'11:00','12:00','Asia/Kolkata','class','small_group',
 'conducted','Two cohort members, mixed attendance','regular','admin',
 'Sensor readings and conditional logic','Sensor challenge',ARRAY['Sensors','Conditional logic']),
 ('f0000000-0000-4000-8000-000000000014',
 'a0000000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-000000000001',
 NULL,'c1000000-0000-4000-8000-000000000001',NULL,
 'QA Cohort Upcoming',current_date+7,'11:00','12:00','Asia/Kolkata','class','small_group',
 'scheduled','Mixed timezones, learner local presentation','regular','admin','', '',ARRAY[]::text[]),
 ('f0000000-0000-4000-8000-000000000015',
 'a0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001',
 'e0000000-0000-4000-8000-000000000003',NULL,'d0000000-0000-4000-8000-000000000003',
 'QA Exam Hold Class',current_date+2,'17:00','18:00','Asia/Kolkata','class','one_to_one',
 'cancelled','Paused for exams; ensure no earnings','regular','admin','', '',ARRAY[]::text[])
ON CONFLICT(id) DO UPDATE SET date=excluded.date,status=excluded.status,
 session_topic=excluded.session_topic,notes=excluded.notes,updated_at=now();

INSERT INTO public.class_attendance(id,schedule_event_id,student_id,enrollment_id,status,note)
VALUES
 ('f1000000-0000-4000-8000-000000000011','f0000000-0000-4000-8000-000000000011',
 'd0000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000002','late',
 'Joined 10 minutes late; attended lesson'),
 ('f1000000-0000-4000-8000-000000000012','f0000000-0000-4000-8000-000000000013',
 'd0000000-0000-4000-8000-000000000004','e0000000-0000-4000-8000-000000000004','attended',
 'Completed sensor activity'),
 ('f1000000-0000-4000-8000-000000000013','f0000000-0000-4000-8000-000000000013',
 'd0000000-0000-4000-8000-000000000005','e0000000-0000-4000-8000-000000000005','absent',
 'Parent informed trainer before class')
ON CONFLICT(schedule_event_id,student_id) DO UPDATE SET status=excluded.status,
 note=excluded.note,enrollment_id=excluded.enrollment_id,updated_at=now();

INSERT INTO public.learning_observations(
 id,schedule_event_id,student_id,enrollment_id,trainer_id,signal,strength,next_focus,feedback)
VALUES
 ('f3000000-0000-4000-8000-000000000011','f0000000-0000-4000-8000-000000000011',
 'd0000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000002',
 'a0000000-0000-4000-8000-000000000002','reinforce','Created quiz scoring',
 'Practice nested conditions','Mia built quiz scoring in Python. Nested conditions needed a second explanation. Next time we will practice the branching logic.'),
 ('f3000000-0000-4000-8000-000000000012','f0000000-0000-4000-8000-000000000013',
 'd0000000-0000-4000-8000-000000000004','e0000000-0000-4000-8000-000000000004',
 'a0000000-0000-4000-8000-000000000002','on_track','Connected the sensor and read values',
 'Add an LED output','Noah connected the sensor and got readings. Next time we will use them to control an LED.')
ON CONFLICT(schedule_event_id,student_id) DO UPDATE SET signal=excluded.signal,
 strength=excluded.strength,next_focus=excluded.next_focus,feedback=excluded.feedback,updated_at=now();

INSERT INTO public.learner_projects(
 id,student_id,enrollment_id,course_id,title,project_type,status,skills,started_at,trainer_feedback)
VALUES
 ('d1000000-0000-4000-8000-000000000001',
 'd0000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000002',
 'c0000000-0000-4000-8000-000000000002','Python Quiz Game','guided','submitted',
 ARRAY['Python','Conditionals'],current_date-9,'Awaiting trainer review'),
 ('d1000000-0000-4000-8000-000000000002',
 'd0000000-0000-4000-8000-000000000004','e0000000-0000-4000-8000-000000000004',
 'c0000000-0000-4000-8000-000000000001','Sensor Alarm','guided','completed',
 ARRAY['Electronics','Sensors'],current_date-14,'Built and tested the sensor alarm')
ON CONFLICT(id) DO UPDATE SET status=excluded.status,trainer_feedback=excluded.trainer_feedback,
 updated_at=now();

INSERT INTO public.trainer_feedback(
 id,student_id,enrollment_id,trainer_id,feedback_type,title,summary,strengths,next_focus,signal)
VALUES
 ('d2000000-0000-4000-8000-000000000001',
 'd0000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000002',
 'a0000000-0000-4000-8000-000000000002','milestone','Quiz project milestone',
 'Mia wrote a working quiz and is practising more complex branching.',
 'Score tracking','Nested conditions','reinforce')
ON CONFLICT(id) DO UPDATE SET summary=excluded.summary,signal=excluded.signal,updated_at=now();

COMMIT;

-- Read-only quick summary; for stronger checks run 03_VERIFY_DEV_PERSONAS.sql.
SELECT
 (SELECT count(*) FROM auth.users WHERE lower(email) IN
  ('qa-admin@robotronix.local','qa-admin-2@robotronix.local',
   'qa-trainer@robotronix.local','qa-trainer-2@robotronix.local',
   'qa-parent@robotronix.local','qa-parent-us@robotronix.local',
   'qa-student@robotronix.local','qa-student-us@robotronix.local')) AS qa_auth_accounts,
 (SELECT count(*) FROM public.students WHERE id::text LIKE 'd0000000-0000-4000-8000-00000000000%') AS qa_students,
 (SELECT count(*) FROM public.enrollments WHERE id::text LIKE 'e0000000-0000-4000-8000-00000000000%') AS qa_enrollments;
