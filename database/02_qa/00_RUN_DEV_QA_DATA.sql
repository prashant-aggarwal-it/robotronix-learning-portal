-- ROBOTRONIX DEV QA: SINGLE DATASET SCRIPT (8 pre-created Auth users + profiles)
-- Run ONCE in a dedicated DEV database AFTER the fresh schema/reference install.
-- Requires all eight existing Auth users and correct active public.profiles roles.
-- Does NOT create, delete, alter or elevate profiles; no Auth passwords, RLS or triggers changed.
-- All business fixture changes are atomic. Never run on PROD.
-- IMPORTANT: All QA dates use the same IST calendar date as the enrollment
-- start-date validation trigger. CURRENT_DATE depends on the SQL session
-- timezone and can be one day behind IST near midnight.

BEGIN;

DO $check$
DECLARE failures text;
BEGIN
 SELECT string_agg(v.email || ' [' || v.role || ']', ', ' ORDER BY v.email) INTO failures
 FROM (VALUES
 ('qa-admin@robotronix.local','admin'),('qa-admin-2@robotronix.local','admin'),
 ('qa-trainer@robotronix.local','trainer'),('qa-trainer-2@robotronix.local','trainer'),
 ('qa-parent@robotronix.local','parent'),('qa-parent-us@robotronix.local','parent'),
 ('qa-student@robotronix.local','student'),('qa-student-us@robotronix.local','student')
 ) v(email,role)
 LEFT JOIN auth.users u ON lower(u.email)=v.email
 LEFT JOIN public.profiles p ON p.id=u.id
 WHERE u.id IS NULL OR p.id IS NULL OR p.role<>v.role OR p.active IS DISTINCT FROM true;
 IF failures IS NOT NULL THEN
  RAISE EXCEPTION 'DEV Auth/Profile prerequisite missing or wrong role: %',failures;
 END IF;
END $check$;

-- PART A: ORIGINAL BASELINE QA BUSINESS DATA


do $$
begin
  if not exists(select 1 from auth.users where email='qa-admin@robotronix.local') then raise exception 'Create qa-admin@robotronix.local in Supabase Auth first'; end if;
  if not exists(select 1 from auth.users where email='qa-trainer@robotronix.local') then raise exception 'Create qa-trainer@robotronix.local in Supabase Auth first'; end if;
  if not exists(select 1 from auth.users where email='qa-parent@robotronix.local') then raise exception 'Create qa-parent@robotronix.local in Supabase Auth first'; end if;
  if not exists(select 1 from auth.users where email='qa-student@robotronix.local') then raise exception 'Create qa-student@robotronix.local in Supabase Auth first'; end if;
end
$$;

-- Existing 8 Auth-linked profiles are preserved; no profile writes in this script.


-- Fail fast if any QA Auth UUID is not mapped to the same public.profiles UUID/role.
do $$
declare
  bad_count integer;
begin
  select count(*) into bad_count
  from (
    values
      ('qa-admin@robotronix.local','admin'),
      ('qa-trainer@robotronix.local','trainer'),
      ('qa-parent@robotronix.local','parent'),
      ('qa-student@robotronix.local','student')
  ) as expected(email, role)
  left join auth.users u on lower(u.email)=expected.email
  left join public.profiles p on p.id=u.id
  where u.id is null
     or p.id is null
     or p.id <> u.id
     or p.role <> expected.role
     or p.active is distinct from true;

  if bad_count <> 0 then
    raise exception 'QA Auth/Profile mapping verification failed for % account(s). Delete/recreate QA Auth users, then rerun this seed.', bad_count;
  end if;
end $$;

-- Human-readable Auth/Profile link report: expected exactly four rows, ids_match=true, active=true.
select
  lower(u.email) as email,
  p.role,
  p.active,
  u.id as auth_user_id,
  p.id as profile_id,
  (u.id=p.id) as ids_match
from auth.users u
left join public.profiles p on p.id=u.id
where lower(u.email) in (
  'qa-admin@robotronix.local',
  'qa-trainer@robotronix.local',
  'qa-parent@robotronix.local',
  'qa-student@robotronix.local'
)
order by lower(u.email);

-- ============================================================
-- 2) QA COURSE
-- ============================================================

insert into public.courses (
  id, slug, title, short_title, code, category,
  grade_from, grade_to, age_from, age_to,
  level, total_sessions, session_duration, planned_hours,
  delivery_modes, coding_type, technologies,
  description, outcomes, projects, assessment_pattern,
  practice_missions, certificate, status,
  public_name, internal_name, outcome_subtitle,
  default_cohort_capacity, minimum_cohort_size
)
values (
  'c0000000-0000-4000-8000-000000000001',
  'qa-robotics-foundations',
  'QA Robotics Foundations',
  'QA Robotics',
  'QA-RF-01',
  'Robotics',
  5, 8, 10, 14,
  'Beginner',
  12,
  60,
  12,
  array['1-to-1','Cohort'],
  'Block + Electronics',
  array['Robotics','Sensors','Programming'],
  'QA-only course used for automated portal testing.',
  array['Build simple mechanisms','Understand sensors','Practice computational thinking'],
  array['Sensor challenge','Mini robot build'],
  'Session observations + project check',
  true,
  true,
  'active',
  'QA Robotics Foundations',
  'QA Robotics Foundations',
  'Hands-on QA course for portal testing',
  4,
  2
)
on conflict (id) do update set
  title = excluded.title,
  short_title = excluded.short_title,
  public_name = excluded.public_name,
  internal_name = excluded.internal_name,
  status = 'active',
  updated_at = now();

-- ============================================================
-- 3) QA TRAINER
-- ============================================================

insert into public.trainers (
  id, profile_id, full_name, mobile, email, city,
  designation, joining_date, specialties,
  record_status, login_linked,
  country, state, timezone
)
values (
  'a0000000-0000-4000-8000-000000000001',
  (select id from auth.users where email='qa-trainer@robotronix.local' limit 1),
  'QA Trainer',
  '+919999999001',
  'qa-trainer@robotronix.local',
  'Delhi',
  'QA Robotics Trainer',
  ((now() AT TIME ZONE 'Asia/Kolkata')::date),
  array['Robotics','STEM','Coding'],
  'active',
  true,
  'India',
  'Delhi',
  'Asia/Kolkata'
)
on conflict (id) do update set
  profile_id = excluded.profile_id,
  full_name = excluded.full_name,
  email = excluded.email,
  record_status = 'active',
  login_linked = true,
  updated_at = now();

insert into public.trainer_courses (trainer_id, course_id)
values (
  'a0000000-0000-4000-8000-000000000001',
  'c0000000-0000-4000-8000-000000000001'
)
on conflict (trainer_id, course_id) do nothing;

-- ============================================================
-- 4) QA PARENT
-- ============================================================

insert into public.parents (
  id, profile_id, primary_phone
)
values (
  'b0000000-0000-4000-8000-000000000001',
  (select id from auth.users where email='qa-parent@robotronix.local' limit 1),
  '+919999999002'
)
on conflict (id) do update set
  profile_id = excluded.profile_id,
  primary_phone = excluded.primary_phone;

-- ============================================================
-- 5) QA STUDENT
-- ============================================================

insert into public.students (
  id, profile_id, full_name, dob, grade, school,
  city, state, country, timezone,
  preferred_class_days, preferred_time_windows,
  interests, previous_experience, source, record_status
)
values (
  'd0000000-0000-4000-8000-000000000001',
  (select id from auth.users where email='qa-student@robotronix.local' limit 1),
  'QA Student',
  ((now() AT TIME ZONE 'Asia/Kolkata')::date) - interval '12 years',
  'Grade 6',
  'Robotronix QA School',
  'Delhi',
  'Delhi',
  'India',
  'Asia/Kolkata',
  array['Monday','Wednesday'],
  '16:00-18:00',
  array['Robotics','Coding'],
  'Beginner',
  'Other',
  'active'
)
on conflict (id) do update set
  profile_id = excluded.profile_id,
  full_name = excluded.full_name,
  grade = excluded.grade,
  record_status = 'active',
  updated_at = now();

-- Private guardian/contact record used by parent/admin flows.
insert into public.student_guardians (
  student_id,
  mother_name, mother_mobile,
  father_name, father_mobile,
  primary_contact,
  primary_whatsapp, alternate_whatsapp,
  parent_login_email,
  primary_guardian_name,
  primary_guardian_relationship,
  primary_guardian_mobile,
  secondary_guardian_name,
  secondary_guardian_relationship,
  secondary_guardian_mobile,
  billing_name,
  billing_email,
  billing_phone,
  billing_address_line1,
  billing_address_line2,
  billing_city,
  billing_state,
  billing_postal_code,
  billing_country
)
values (
  'd0000000-0000-4000-8000-000000000001',
  'QA Parent', '+919999999002',
  '', '',
  'mother',
  '+919999999002', '',
  'qa-parent@robotronix.local',
  'QA Parent',
  'mother',
  '+919999999002',
  '',
  null,
  '',
  'QA Parent',
  'qa-parent@robotronix.local',
  '+919999999002',
  'QA Test Address',
  '',
  'Delhi',
  'Delhi',
  '110001',
  'India'
)
on conflict (student_id) do update set
  parent_login_email = excluded.parent_login_email,
  primary_guardian_name = excluded.primary_guardian_name,
  primary_guardian_relationship = excluded.primary_guardian_relationship,
  primary_guardian_mobile = excluded.primary_guardian_mobile,
  primary_whatsapp = excluded.primary_whatsapp,
  billing_name = excluded.billing_name,
  billing_email = excluded.billing_email,
  billing_phone = excluded.billing_phone,
  billing_address_line1 = excluded.billing_address_line1,
  billing_address_line2 = excluded.billing_address_line2,
  billing_city = excluded.billing_city,
  billing_state = excluded.billing_state,
  billing_postal_code = excluded.billing_postal_code,
  billing_country = excluded.billing_country,
  updated_at = now();

-- Parent -> learner relationship
insert into public.parent_students (
  parent_id, student_id, relationship_label
)
values (
  'b0000000-0000-4000-8000-000000000001',
  'd0000000-0000-4000-8000-000000000001',
  'Parent'
)
on conflict (parent_id, student_id) do update set
  relationship_label = excluded.relationship_label;

-- ============================================================
-- 6) QA ENROLLMENT
-- ============================================================

insert into public.enrollments (
  id,
  student_id,
  course_id,
  trainer_id,
  enrollment_type,
  cohort_id,
  status,
  started_at,
  schedule_timezone,
  schedule_rules,
  delivery_channel,
  center_location,
  schedule_mode
)
values (
  'e0000000-0000-4000-8000-000000000001',
  'd0000000-0000-4000-8000-000000000001',
  'c0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001',
  'one_to_one',
  null,
  'active',
  (now() AT TIME ZONE 'Asia/Kolkata')::date,
  'Asia/Kolkata',
  '[
    {"dayOfWeek": 1, "startTime": "16:00", "endTime": "17:00"},
    {"dayOfWeek": 3, "startTime": "16:00", "endTime": "17:00"}
  ]'::jsonb,
  'online',
  '',
  'recurring'
)
on conflict (id) do update set
  student_id = excluded.student_id,
  course_id = excluded.course_id,
  trainer_id = excluded.trainer_id,
  status = 'active',
  schedule_timezone = excluded.schedule_timezone,
  updated_at = now();

-- ============================================================
-- 7) PORTAL ACCESS STATUS FOR TRAINER / STUDENT
-- ============================================================

insert into public.portal_access_requests (
  target_type, target_id, login_email, status, invited_at, updated_at, last_actor_id
)
values
  (
    'trainer',
    'a0000000-0000-4000-8000-000000000001',
    'qa-trainer@robotronix.local',
    'linked',
    now(),
    now(),
    (select id from auth.users where email='qa-admin@robotronix.local' limit 1)
  ),
  (
    'student',
    'd0000000-0000-4000-8000-000000000001',
    'qa-student@robotronix.local',
    'linked',
    now(),
    now(),
    (select id from auth.users where email='qa-admin@robotronix.local' limit 1)
  )
on conflict (target_type, target_id) do update set
  login_email = excluded.login_email,
  status = 'linked',
  updated_at = now(),
  last_actor_id = excluded.last_actor_id;

-- ============================================================
-- 8) ONE COMPLETED QA CLASS (yesterday)
-- ============================================================

insert into public.schedule_events (
  id,
  trainer_id, course_id, enrollment_id, cohort_id, student_id,
  title, date, start_time, end_time, timezone,
  event_type, delivery_mode, status,
  notes, occurrence_kind, requested_by,
  session_topic, project_worked_on, skills_worked
)
values (
  'f0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001',
  'c0000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000001',
  null,
  'd0000000-0000-4000-8000-000000000001',
  'QA Robotics Class — Completed',
  ((now() AT TIME ZONE 'Asia/Kolkata')::date) - 1,
  '16:00',
  '17:00',
  'Asia/Kolkata',
  'class',
  'one_to_one',
  'conducted',
  'QA completed class used for automated testing.',
  'regular',
  'admin',
  'Introduction to sensors',
  'Sensor challenge',
  array['Sensors','Problem Solving']
)
on conflict (id) do update set
  status = 'conducted',
  notes = excluded.notes,
  updated_at = now();

insert into public.class_attendance (
  id, schedule_event_id, student_id, enrollment_id, status, note
)
values (
  'f1000000-0000-4000-8000-000000000001',
  'f0000000-0000-4000-8000-000000000001',
  'd0000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000001',
  'attended',
  'QA attendance record'
)
on conflict (schedule_event_id, student_id) do update set
  enrollment_id = excluded.enrollment_id,
  status = 'attended',
  note = excluded.note,
  updated_at = now();

-- Student/Parent dashboard uses session_records for recent attendance/status.
insert into public.session_records (
  id, enrollment_id, student_id, trainer_id,
  session_date, attendance, understanding, participation,
  practice_status, note, created_by
)
values (
  'f2000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000001',
  'd0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001',
  ((now() AT TIME ZONE 'Asia/Kolkata')::date) - 1,
  'attended',
  'got_it',
  'steady',
  'optional',
  'QA session record',
  (select id from auth.users where email='qa-admin@robotronix.local' limit 1)
)
on conflict (id) do update set
  attendance = 'attended',
  understanding = 'got_it',
  note = excluded.note;

-- ============================================================
-- 9) ONE UPCOMING QA CLASS (tomorrow)
-- ============================================================

insert into public.schedule_events (
  id,
  trainer_id, course_id, enrollment_id, cohort_id, student_id,
  title, date, start_time, end_time, timezone,
  event_type, delivery_mode, status,
  notes, occurrence_kind, requested_by
)
values (
  'f0000000-0000-4000-8000-000000000002',
  'a0000000-0000-4000-8000-000000000001',
  'c0000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000001',
  null,
  'd0000000-0000-4000-8000-000000000001',
  'QA Robotics Class — Upcoming',
  ((now() AT TIME ZONE 'Asia/Kolkata')::date) + 1,
  '16:00',
  '17:00',
  'Asia/Kolkata',
  'class',
  'one_to_one',
  'scheduled',
  'QA upcoming class used for automated testing.',
  'regular',
  'admin'
)
on conflict (id) do update set
  date = ((now() AT TIME ZONE 'Asia/Kolkata')::date) + 1,
  status = 'scheduled',
  updated_at = now();


-- PART B: EXTENDED INDIA/OVERSEAS BUSINESS DATA
-- qa-admin-2: existing active admin profile (no separate admin business table).
-- qa-trainer-2: creates Meera Iyer trainer row.
-- qa-parent-us: creates Olivia Patel parent row and links children.
-- qa-student-us: creates Mia Patel student row linked to Auth.
-- Other child records intentionally have no personal Auth login.
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
  RAISE EXCEPTION 'Baseline DEV fixtures missing within consolidated setup. Stop and share the first SQL error; do not run legacy QA seed separately.';
 END IF;
END $guard$;

-- 2 accounts for each role, including original baseline fixtures.
-- Auth and role mappings were checked; no profile writes or security trigger changes in this script.


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
 ((now() AT TIME ZONE 'Asia/Kolkata')::date)-120,ARRAY['Python','Scratch','Robotics'],'active',true,
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
  'Mia Patel (QA USA)',(((now() AT TIME ZONE 'Asia/Kolkata')::date)-interval '12 years')::date,'Grade 7','QA International School',
  'New York','New York','United States','America/New_York',
  ARRAY['Friday'],'09:00-10:00',ARRAY['Python','AI'],'Beginner','Website','active'),
 ('d0000000-0000-4000-8000-000000000003',NULL,'Aarav Sharma (QA India)',
  (((now() AT TIME ZONE 'Asia/Kolkata')::date)-interval '11 years')::date,'Grade 6','QA Delhi School','Delhi','Delhi','India',
  'Asia/Kolkata',ARRAY['Monday'],'17:00-19:00',ARRAY['Robotics'],'Beginner','Instagram','active'),
 ('d0000000-0000-4000-8000-000000000004',NULL,'Noah Patel (QA USA)',
  (((now() AT TIME ZONE 'Asia/Kolkata')::date)-interval '9 years')::date,'Grade 4','QA Elementary School','New York','New York',
  'United States','America/New_York',ARRAY['Saturday'],'10:00-12:00',
  ARRAY['Robotics'],'Beginner','Parent referral','active'),
 ('d0000000-0000-4000-8000-000000000005',NULL,'Anaya Sharma (QA Cohort)',
  (((now() AT TIME ZONE 'Asia/Kolkata')::date)-interval '10 years')::date,'Grade 5','QA Delhi School','Delhi','Delhi','India',
  'Asia/Kolkata',ARRAY['Saturday'],'19:00-21:00',ARRAY['Coding','Robotics'],'Beginner','School','active')
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
 'a0000000-0000-4000-8000-000000000002',6,'active',((now() AT TIME ZONE 'Asia/Kolkata')::date)-7,
 ARRAY[6],'19:30','20:30','A','Asia/Kolkata',
 '[{"dayOfWeek":6,"startTime":"19:30","endTime":"20:30"}]'::jsonb,'Saturday 7:30 PM IST (10 AM EDT / 9 AM EST)')
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
 'one_to_one',NULL,'active',((now() AT TIME ZONE 'Asia/Kolkata')::date),'America/New_York',
 '[{"dayOfWeek":5,"startTime":"09:00","endTime":"10:00"}]'::jsonb,'online','recurring',NULL,NULL,NULL),
 ('e0000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-000000000003',
 'c0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001',
 'one_to_one',NULL,'on_hold',((now() AT TIME ZONE 'Asia/Kolkata')::date),'Asia/Kolkata',
 '[{"dayOfWeek":1,"startTime":"17:00","endTime":"18:00"}]'::jsonb,
 'online','recurring','exams',((now() AT TIME ZONE 'Asia/Kolkata')::date),((now() AT TIME ZONE 'Asia/Kolkata')::date)+10),
 ('e0000000-0000-4000-8000-000000000004','d0000000-0000-4000-8000-000000000004',
 'c0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000002',
 'small_group','c1000000-0000-4000-8000-000000000001','active',((now() AT TIME ZONE 'Asia/Kolkata')::date),
 'Asia/Kolkata','[{"dayOfWeek":6,"startTime":"19:30","endTime":"20:30"}]'::jsonb,
 'online','recurring',NULL,NULL,NULL),
 ('e0000000-0000-4000-8000-000000000005','d0000000-0000-4000-8000-000000000005',
 'c0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000002',
 'small_group','c1000000-0000-4000-8000-000000000001','active',((now() AT TIME ZONE 'Asia/Kolkata')::date),
 'Asia/Kolkata','[{"dayOfWeek":6,"startTime":"19:30","endTime":"20:30"}]'::jsonb,
 'online','recurring',NULL,NULL,NULL)
ON CONFLICT(id) DO UPDATE SET status=excluded.status,trainer_id=excluded.trainer_id,
 schedule_timezone=excluded.schedule_timezone,hold_reason=excluded.hold_reason,
 hold_from=excluded.hold_from,hold_until=excluded.hold_until,updated_at=now();

INSERT INTO public.enrollment_holds(id,enrollment_id,student_id,reason,start_date,end_date,status,note)
VALUES('a1000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000003',
'd0000000-0000-4000-8000-000000000003','exams',((now() AT TIME ZONE 'Asia/Kolkata')::date),((now() AT TIME ZONE 'Asia/Kolkata')::date)+10,'active',
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
 'QA Python Quiz',((now() AT TIME ZONE 'Asia/Kolkata')::date)-((extract(dow from ((now() AT TIME ZONE 'Asia/Kolkata')::date))::int+2)%7)-7,'09:00','10:00','America/New_York','class','one_to_one','conducted',
 'Synthetic teaching record','regular','admin','Python conditionals and quiz scoring','Quiz game',
 ARRAY['Conditionals','Debugging']),
 ('f0000000-0000-4000-8000-000000000012',
 'a0000000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-000000000002',
 'e0000000-0000-4000-8000-000000000002',NULL,'d0000000-0000-4000-8000-000000000002',
 'QA Python Next Class',((now() AT TIME ZONE 'Asia/Kolkata')::date)+((5-extract(dow from ((now() AT TIME ZONE 'Asia/Kolkata')::date))::int+7)%7)+7,'09:00','10:00','America/New_York','class','one_to_one','scheduled',
 'No Zoom room expected until JIT window','regular','admin','','',ARRAY[]::text[]),
 ('f0000000-0000-4000-8000-000000000013',
 'a0000000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-000000000001',
 NULL,'c1000000-0000-4000-8000-000000000001',NULL,
 'QA Cohort Sensor Challenge',((now() AT TIME ZONE 'Asia/Kolkata')::date)-((extract(dow from ((now() AT TIME ZONE 'Asia/Kolkata')::date))::int+1)%7)-7,'19:30','20:30','Asia/Kolkata','class','small_group',
 'conducted','Two cohort members, mixed attendance','regular','admin',
 'Sensor readings and conditional logic','Sensor challenge',ARRAY['Sensors','Conditional logic']),
 ('f0000000-0000-4000-8000-000000000014',
 'a0000000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-000000000001',
 NULL,'c1000000-0000-4000-8000-000000000001',NULL,
 'QA Cohort Upcoming',((now() AT TIME ZONE 'Asia/Kolkata')::date)+((6-extract(dow from ((now() AT TIME ZONE 'Asia/Kolkata')::date))::int+7)%7)+7,'19:30','20:30','Asia/Kolkata','class','small_group',
 'scheduled','Mixed timezones, learner local presentation','regular','admin','', '',ARRAY[]::text[]),
 ('f0000000-0000-4000-8000-000000000015',
 'a0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001',
 'e0000000-0000-4000-8000-000000000003',NULL,'d0000000-0000-4000-8000-000000000003',
 'QA Exam Hold Class',((now() AT TIME ZONE 'Asia/Kolkata')::date)+2,'17:00','18:00','Asia/Kolkata','class','one_to_one',
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
 ARRAY['Python','Conditionals'],((now() AT TIME ZONE 'Asia/Kolkata')::date)-9,'Awaiting trainer review'),
 ('d1000000-0000-4000-8000-000000000002',
 'd0000000-0000-4000-8000-000000000004','e0000000-0000-4000-8000-000000000004',
 'c0000000-0000-4000-8000-000000000001','Sensor Alarm','guided','completed',
 ARRAY['Electronics','Sensors'],((now() AT TIME ZONE 'Asia/Kolkata')::date)-14,'Built and tested the sensor alarm')
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


-- Onboarding review workflow: new, setup pending, and activated/linked.
-- These synthetic submissions also exercise Admin notification creation.
INSERT INTO public.onboarding_submissions(
 id,user_id,login_email,primary_guardian_name,primary_guardian_relationship,
 city,state,country,timezone,child_name,grade,school,source,goal,
 data_consent,status,assigned_course_id,assigned_trainer_id,
 activated_student_id,activated_enrollment_id,enrollment_type,start_date,
 draft_schedule_timezone,draft_schedule_rules)
VALUES
 ('91000000-0000-4000-8000-000000000011',
 (SELECT id FROM auth.users WHERE lower(email)='qa-parent@robotronix.local'),
 'qa-parent@robotronix.local','QA Parent','mother',
 'Delhi','Delhi','India','Asia/Kolkata','Ishaan (New Onboarding)','Grade 5',
 'QA Delhi School','Website','Explore robotics',true,'new',
 NULL,NULL,NULL,NULL,NULL,NULL,NULL,'[]'::jsonb),
 ('91000000-0000-4000-8000-000000000012',
 (SELECT id FROM auth.users WHERE lower(email)='qa-parent-us@robotronix.local'),
 'qa-parent-us@robotronix.local','Olivia Patel (QA)','mother',
 'New York','New York','United States','America/New_York',
 'Sophia (Setup Pending)','Grade 6','QA International School','Referral',
 'Learn coding fundamentals',true,'setup_pending',
 'c0000000-0000-4000-8000-000000000002',
 'a0000000-0000-4000-8000-000000000002',
 NULL,NULL,'one_to_one',((now() AT TIME ZONE 'Asia/Kolkata')::date)+7,'America/New_York',
 '[{"dayOfWeek":5,"startTime":"09:00","endTime":"10:00"}]'::jsonb),
 ('91000000-0000-4000-8000-000000000013',
 (SELECT id FROM auth.users WHERE lower(email)='qa-parent-us@robotronix.local'),
 'qa-parent-us@robotronix.local','Olivia Patel (QA)','mother',
 'New York','New York','United States','America/New_York',
 'Mia Patel (QA USA)','Grade 7','QA International School','Website',
 'Build a Python quiz',true,'active',
 'c0000000-0000-4000-8000-000000000002',
 'a0000000-0000-4000-8000-000000000002',
 'd0000000-0000-4000-8000-000000000002',
 'e0000000-0000-4000-8000-000000000002',
 'one_to_one',((now() AT TIME ZONE 'Asia/Kolkata')::date),'America/New_York',
 '[{"dayOfWeek":5,"startTime":"09:00","endTime":"10:00"}]'::jsonb)
ON CONFLICT(id) DO UPDATE SET status=excluded.status,
 assigned_course_id=excluded.assigned_course_id,
 assigned_trainer_id=excluded.assigned_trainer_id,
 activated_student_id=excluded.activated_student_id,
 activated_enrollment_id=excluded.activated_enrollment_id,updated_at=now();

-- Trainer availability: two different weekly patterns; overrides exercise
-- exception rendering without creating real Zoom rooms.
INSERT INTO public.trainer_availability(trainer_id,day_of_week,start_time,end_time,enabled)
VALUES
 ('a0000000-0000-4000-8000-000000000001',1,'15:00','19:00',true),
 ('a0000000-0000-4000-8000-000000000002',5,'17:00','21:00',true),
 ('a0000000-0000-4000-8000-000000000002',6,'18:00','22:00',true)
ON CONFLICT(trainer_id,day_of_week,start_time,end_time) DO UPDATE SET enabled=true;

-- Billing setup only: no payment success, provider invoice, webhook or payouts fabricated.
-- The empty-invoice state remains meaningful and Admin can test package management.
INSERT INTO public.student_fee_packages(
 id,enrollment_id,name,scheme,currency,amount,sessions,start_date,end_date,installments)
VALUES(
 'b0000000-0000-4000-8000-000000000098',
 'e0000000-0000-4000-8000-000000000002',
 'DEV US Python Fee Package','Custom','USD',180.00,12,((now() AT TIME ZONE 'Asia/Kolkata')::date),
 ((now() AT TIME ZONE 'Asia/Kolkata')::date)+90,
 jsonb_build_array(jsonb_build_object('amount',180.00,'due',((now() AT TIME ZONE 'Asia/Kolkata')::date)::text)))
ON CONFLICT(id) DO UPDATE SET name=excluded.name,amount=excluded.amount,
 currency=excluded.currency,start_date=excluded.start_date,
 end_date=excluded.end_date,installments=excluded.installments;


COMMIT;

-- Verification summary; run 01_VERIFY_DEV_QA.sql for all checks.
SELECT 'DEV QA DATA COMMITTED' AS status,
 (SELECT count(*) FROM public.students WHERE id::text LIKE 'd0000000-0000-4000-8000-00000000000%') AS qa_students,
 (SELECT count(*) FROM public.enrollments WHERE id::text LIKE 'e0000000-0000-4000-8000-00000000000%') AS qa_enrollments;
