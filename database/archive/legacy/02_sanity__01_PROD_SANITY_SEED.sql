-- ARCHIVED LEGACY SCRIPT. DO NOT EXECUTE AS PART OF CURRENT INSTALLATION.
-- ============================================================================
-- Robotronix™ Learning Portal — PRODUCTION SANITY SEED
-- Temporary deterministic fixtures for post-deployment validation only.
-- Uses the same fixed record IDs/labels as automated QA so the existing Playwright
-- suites can validate production safely against synthetic data.
-- Prerequisite: run `npm run sanity:create-users` with SANITY_* credentials first.
-- After sanity passes, run 02_PROD_SANITY_CLEANUP.sql and `npm run sanity:delete-users`.
-- DO NOT keep these synthetic records in the live database.
-- ============================================================================

-- Robotronix™ Learning Portal — Production v1.0.0
-- PRODUCTION SANITY FIXTURES. Temporary synthetic data for controlled post-deploy sanity only.

-- Robotronix Learning Portal — production sanity seed
-- NOT business data. May be run on a fresh/controlled production database only for temporary post-deploy sanity, then clean it completely.
--
-- Prerequisite: create these four Supabase Auth email/password users first:
--   prod-sanity-admin@robotronix.local
--   prod-sanity-trainer@robotronix.local
--   prod-sanity-parent@robotronix.local
--   prod-sanity-student@robotronix.local
--
-- Auth UUIDs are resolved by email, so this file is portable across Supabase projects.
-- Safe to re-run for the fixed QA domain IDs used by Playwright.

begin;

do $$
begin
  if not exists(select 1 from auth.users where email='prod-sanity-admin@robotronix.local') then raise exception 'Create prod-sanity-admin@robotronix.local in Supabase Auth first'; end if;
  if not exists(select 1 from auth.users where email='prod-sanity-trainer@robotronix.local') then raise exception 'Create prod-sanity-trainer@robotronix.local in Supabase Auth first'; end if;
  if not exists(select 1 from auth.users where email='prod-sanity-parent@robotronix.local') then raise exception 'Create prod-sanity-parent@robotronix.local in Supabase Auth first'; end if;
  if not exists(select 1 from auth.users where email='prod-sanity-student@robotronix.local') then raise exception 'Create prod-sanity-student@robotronix.local in Supabase Auth first'; end if;
end
$$;

alter table public.profiles disable trigger protect_profile_privileges_trg;

insert into public.profiles (id, full_name, role, active)
select id,'QA Admin','admin',true from auth.users where email='prod-sanity-admin@robotronix.local'
on conflict (id) do update set full_name=excluded.full_name,role=excluded.role,active=true,updated_at=now();
insert into public.profiles (id, full_name, role, active)
select id,'QA Trainer','trainer',true from auth.users where email='prod-sanity-trainer@robotronix.local'
on conflict (id) do update set full_name=excluded.full_name,role=excluded.role,active=true,updated_at=now();
insert into public.profiles (id, full_name, role, active)
select id,'QA Parent','parent',true from auth.users where email='prod-sanity-parent@robotronix.local'
on conflict (id) do update set full_name=excluded.full_name,role=excluded.role,active=true,updated_at=now();
insert into public.profiles (id, full_name, role, active)
select id,'QA Student','student',true from auth.users where email='prod-sanity-student@robotronix.local'
on conflict (id) do update set full_name=excluded.full_name,role=excluded.role,active=true,updated_at=now();

alter table public.profiles enable trigger protect_profile_privileges_trg;

-- Fail fast if any Production sanity Auth UUID is not mapped to the same public.profiles UUID/role.
do $$
declare
  bad_count integer;
begin
  select count(*) into bad_count
  from (
    values
      ('prod-sanity-admin@robotronix.local','admin'),
      ('prod-sanity-trainer@robotronix.local','trainer'),
      ('prod-sanity-parent@robotronix.local','parent'),
      ('prod-sanity-student@robotronix.local','student')
  ) as expected(email, role)
  left join auth.users u on lower(u.email)=expected.email
  left join public.profiles p on p.id=u.id
  where u.id is null
     or p.id is null
     or p.id <> u.id
     or p.role <> expected.role
     or p.active is distinct from true;

  if bad_count <> 0 then
    raise exception 'Production sanity Auth/Profile mapping verification failed for % account(s). Delete/recreate Production sanity Auth users, then rerun this seed.', bad_count;
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
  'prod-sanity-admin@robotronix.local',
  'prod-sanity-trainer@robotronix.local',
  'prod-sanity-parent@robotronix.local',
  'prod-sanity-student@robotronix.local'
)
order by lower(u.email);

-- ============================================================
-- 2) PRODUCTION SANITY COURSE
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
  'Temporary sanity course used for automated portal testing.',
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
-- 3) PRODUCTION SANITY TRAINER
-- ============================================================

insert into public.trainers (
  id, profile_id, full_name, mobile, email, city,
  designation, joining_date, specialties,
  record_status, login_linked,
  country, state, timezone
)
values (
  'a0000000-0000-4000-8000-000000000001',
  (select id from auth.users where email='prod-sanity-trainer@robotronix.local' limit 1),
  'QA Trainer',
  '+919999999001',
  'prod-sanity-trainer@robotronix.local',
  'Delhi',
  'QA Robotics Trainer',
  current_date,
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
-- 4) PRODUCTION SANITY PARENT
-- ============================================================

insert into public.parents (
  id, profile_id, primary_phone
)
values (
  'b0000000-0000-4000-8000-000000000001',
  (select id from auth.users where email='prod-sanity-parent@robotronix.local' limit 1),
  '+919999999002'
)
on conflict (id) do update set
  profile_id = excluded.profile_id,
  primary_phone = excluded.primary_phone;

-- ============================================================
-- 5) PRODUCTION SANITY STUDENT
-- ============================================================

insert into public.students (
  id, profile_id, full_name, dob, grade, school,
  city, state, country, timezone,
  preferred_class_days, preferred_time_windows,
  interests, previous_experience, source, record_status
)
values (
  'd0000000-0000-4000-8000-000000000001',
  (select id from auth.users where email='prod-sanity-student@robotronix.local' limit 1),
  'QA Student',
  current_date - interval '12 years',
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
  'prod-sanity-parent@robotronix.local',
  'QA Parent',
  'mother',
  '+919999999002',
  '',
  null,
  '',
  'QA Parent',
  'prod-sanity-parent@robotronix.local',
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
  current_date,
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
    'prod-sanity-trainer@robotronix.local',
    'linked',
    now(),
    now(),
    (select id from auth.users where email='prod-sanity-admin@robotronix.local' limit 1)
  ),
  (
    'student',
    'd0000000-0000-4000-8000-000000000001',
    'prod-sanity-student@robotronix.local',
    'linked',
    now(),
    now(),
    (select id from auth.users where email='prod-sanity-admin@robotronix.local' limit 1)
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
  current_date - 1,
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
  current_date - 1,
  'attended',
  'got_it',
  'steady',
  'optional',
  'QA session record',
  (select id from auth.users where email='prod-sanity-admin@robotronix.local' limit 1)
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
  current_date + 1,
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
  date = current_date + 1,
  status = 'scheduled',
  updated_at = now();

commit;

-- ============================================================
-- 10) VERIFICATION
-- ============================================================

select 'profiles' as item, count(*) as qa_rows
from public.profiles
where id in (
  (select id from auth.users where email='prod-sanity-admin@robotronix.local' limit 1),
  (select id from auth.users where email='prod-sanity-trainer@robotronix.local' limit 1),
  (select id from auth.users where email='prod-sanity-parent@robotronix.local' limit 1),
  (select id from auth.users where email='prod-sanity-student@robotronix.local' limit 1)
)
union all
select 'trainer', count(*) from public.trainers
where id='a0000000-0000-4000-8000-000000000001'
union all
select 'parent', count(*) from public.parents
where id='b0000000-0000-4000-8000-000000000001'
union all
select 'student', count(*) from public.students
where id='d0000000-0000-4000-8000-000000000001'
union all
select 'course', count(*) from public.courses
where id='c0000000-0000-4000-8000-000000000001'
union all
select 'enrollment', count(*) from public.enrollments
where id='e0000000-0000-4000-8000-000000000001'
union all
select 'classes', count(*) from public.schedule_events
where id in (
  'f0000000-0000-4000-8000-000000000001',
  'f0000000-0000-4000-8000-000000000002'
);

-- Expected result:
-- profiles   4
-- trainer    1
-- parent     1
-- student    1
-- course     1
-- enrollment 1
-- classes    2


-- ---------------------------------------------------------------------------
-- Razorpay international SANITY candidate (Development / QA only)
-- This deliberately converts only the deterministic QA parent billing profile
-- to an international test profile and creates one AED SANITY package.
-- Never run this section against production customer data.
-- ---------------------------------------------------------------------------

UPDATE public.parent_billing_profiles pb
SET
  same_as_primary_guardian = true,
  same_as_primary_address = false,
  billing_name = 'QA Parent - SANITY Razorpay',
  billing_email = 'prod-sanity-parent@robotronix.local',
  billing_phone = '+971501234567',
  billing_address_line1 = 'QA Test Address',
  billing_address_line2 = '',
  billing_city = 'Dubai',
  billing_state = 'Dubai',
  billing_postal_code = '00000',
  billing_country = 'United Arab Emirates',
  billing_country_code = 'AE',
  updated_at = now()
WHERE pb.parent_id IN (
  SELECT ps.parent_id FROM public.parent_students ps
  WHERE ps.student_id = 'd0000000-0000-4000-8000-000000000001'
);

WITH package_dates AS (
  SELECT greatest(current_date, coalesce(max(end_date) + 1, current_date)) AS start_date
  FROM public.student_fee_packages
  WHERE enrollment_id = 'e0000000-0000-4000-8000-000000000001'
    AND id <> 'b0000000-0000-4000-8000-000000000099'
)
INSERT INTO public.student_fee_packages (
  id,enrollment_id,name,scheme,currency,amount,sessions,start_date,end_date,installments
)
SELECT
  'b0000000-0000-4000-8000-000000000099',
  'e0000000-0000-4000-8000-000000000001',
  'SANITY Razorpay International Test Package',
  'Custom','AED',250.00,8,d.start_date,d.start_date + 30,
  jsonb_build_array(jsonb_build_object('amount',250.00,'due',d.start_date::text))
FROM package_dates d
ON CONFLICT (id) DO UPDATE SET
  name=excluded.name, scheme=excluded.scheme, currency=excluded.currency,
  amount=excluded.amount, sessions=excluded.sessions,
  start_date=excluded.start_date, end_date=excluded.end_date,
  installments=excluded.installments;

SELECT 'QA seed + Razorpay SANITY package ready' AS status;
