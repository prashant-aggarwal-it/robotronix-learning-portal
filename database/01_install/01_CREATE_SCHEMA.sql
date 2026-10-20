-- Robotronix™ Learning Portal — Production v1.0.0
-- Generated consolidated release file. Fresh-install oriented; historical patch files are intentionally omitted.


-- ============================================================================
-- CORE PRODUCTION V1 BASELINE
-- ============================================================================

-- Robotronix Learning Portal — Production V1 database baseline
-- Fresh production database: run this file once in a new Supabase project.
-- Complete schema, RLS, triggers, functions, audit, finance, payroll and portal-access controls.
-- No historical migrations or hotfix scripts are required for a fresh Production V1 install.
-- This file creates schema only; it does not insert customer/demo data.

-- Run in a new Supabase project. This schema keeps operational data separate:
-- Student, Trainer and Course are masters; Enrollment connects them; Cohort exists only for cohort delivery.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null check (role in ('student','parent','trainer','admin')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.parents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique not null references public.profiles(id) on delete cascade,
  primary_phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  short_title text not null default '',
  code text unique not null,
  category text not null,
  grade_from int not null,
  grade_to int not null,
  age_from int,
  age_to int,
  level text not null default 'Beginner',
  total_sessions int not null check (total_sessions > 0),
  session_duration int not null default 60 check (session_duration in (60,90,120,150)),
  planned_hours numeric(8,2),
  delivery_modes text[] not null default array['1-to-1','Cohort'],
  coding_type text,
  technologies text[] not null default '{}',
  description text not null default '',
  outcomes text[] not null default '{}',
  projects text[] not null default '{}',
  assessment_pattern text not null default '',
  practice_missions boolean not null default true,
  certificate boolean not null default true,
  status text not null default 'draft' check (status in ('draft','active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trainers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  full_name text not null,
  mobile text not null default '',
  email text not null default '',
  city text not null default '',
  designation text not null default 'Trainer',
  joining_date date,
  specialties text[] not null default '{}',
  record_status text not null default 'active' check (record_status in ('active','inactive','archived')),
  login_linked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trainer_courses (
  trainer_id uuid not null references public.trainers(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  primary key (trainer_id, course_id)
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  full_name text not null,
  dob date,
  grade text not null default '',
  school text not null default '',
  city text not null default '',
  state text not null default '',
  country text not null default 'India',
  timezone text not null default 'Asia/Kolkata',
  preferred_class_days text[] not null default '{}',
  preferred_time_windows text not null default '',
  interests text[] not null default '{}',
  previous_experience text not null default '',
  source text not null default '',
  record_status text not null default 'active' check (record_status in ('active','inactive','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Parent/guardian contact details are intentionally isolated from the teaching record.
create table if not exists public.student_guardians (
  student_id uuid primary key references public.students(id) on delete cascade,
  mother_name text not null default '',
  mother_mobile text not null default '',
  father_name text not null default '',
  father_mobile text not null default '',
  primary_contact text not null default 'mother' check (primary_contact in ('mother','father','guardian')),
  primary_whatsapp text not null default '',
  alternate_whatsapp text not null default '',
  parent_login_email text not null default '',
  primary_guardian_name text not null default '',
  primary_guardian_relationship text not null default 'guardian' check (primary_guardian_relationship in ('mother','father','guardian','grandparent','relative','other')),
  primary_guardian_mobile text not null default '',
  secondary_guardian_name text not null default '',
  secondary_guardian_relationship text check (secondary_guardian_relationship is null or secondary_guardian_relationship in ('mother','father','guardian','grandparent','relative','other')),
  secondary_guardian_mobile text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.parent_students (
  parent_id uuid not null references public.parents(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  relationship_label text not null default 'Parent',
  primary key (parent_id, student_id)
);

create table if not exists public.cohorts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique not null,
  course_id uuid not null references public.courses(id) on delete restrict,
  trainer_id uuid references public.trainers(id) on delete set null,
  capacity int not null default 6 check (capacity > 0),
  status text not null default 'planned' check (status in ('planned','active','completed','archived')),
  started_at date,
  days_of_week int[] not null default '{}',
  start_time time,
  end_time time,
  cohort_label text not null default 'A',
  schedule_timezone text not null default 'Asia/Kolkata',
  schedule_rules jsonb not null default '[]'::jsonb,
  schedule_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  course_id uuid not null references public.courses(id) on delete restrict,
  trainer_id uuid not null references public.trainers(id) on delete restrict,
  enrollment_type text not null check (enrollment_type in ('one_to_one','small_group')),
  cohort_id uuid references public.cohorts(id) on delete set null,
  status text not null default 'active' check (status in ('active','on_hold','completed','cancelled')),
  started_at date not null,
  completed_at date,
  hold_reason text check (hold_reason is null or hold_reason in ('exams','medical','travel','family','other')),
  hold_from date,
  hold_until date,
  hold_note text,
  schedule_timezone text not null default 'Asia/Kolkata',
  schedule_rules jsonb not null default '[]'::jsonb,
  schedule_override_confirmed boolean not null default false,
  schedule_override_note text,
  -- Opening position supports currently-active learners migrated at portal launch without fabricating historical classes.
  migration_type text not null default 'native' check (migration_type in ('native','active_existing')),
  opening_completed_sessions int not null default 0 check (opening_completed_sessions >= 0),
  opening_completed_minutes int not null default 0 check (opening_completed_minutes >= 0),
  migration_note text,
  portal_tracking_started_at date,
  -- Cached values maintained automatically from opening position + attended class records.
  sessions_completed int not null default 0,
  progress_percent numeric(5,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cohort_required_for_group check (
    (enrollment_type='one_to_one' and cohort_id is null) or
    (enrollment_type='small_group' and cohort_id is not null)
  )
);

create index if not exists enrollments_student_idx on public.enrollments(student_id);
create index if not exists enrollments_trainer_idx on public.enrollments(trainer_id);
create index if not exists enrollments_cohort_idx on public.enrollments(cohort_id);

create table if not exists public.onboarding_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  login_email text not null default '',
  mother_name text not null default '', mother_mobile text not null default '',
  father_name text not null default '', father_mobile text not null default '',
  primary_contact text not null default 'mother' check (primary_contact in ('mother','father','guardian')),
  primary_whatsapp text not null default '', alternate_whatsapp text not null default '',
  primary_guardian_name text not null default '',
  primary_guardian_relationship text not null default 'guardian' check (primary_guardian_relationship in ('mother','father','guardian','grandparent','relative','other')),
  primary_guardian_mobile text not null default '',
  secondary_guardian_name text not null default '',
  secondary_guardian_relationship text check (secondary_guardian_relationship is null or secondary_guardian_relationship in ('mother','father','guardian','grandparent','relative','other')),
  secondary_guardian_mobile text not null default '',
  city text not null default '', state text not null default '', country text not null default 'India', timezone text not null default 'Asia/Kolkata',
  child_name text not null, child_dob date, grade text not null default '', school text not null default '',
  preferred_class_days text[] not null default '{}', preferred_time_windows text not null default '',
  interests text[] not null default '{}', goal text not null default '',
  coding_experience text not null default '', robotics_experience text not null default '',
  source text not null,
  data_consent boolean not null default false,
  portfolio_consent boolean not null default false,
  marketing_media_consent boolean not null default false,
  status text not null default 'new' check (status in ('draft','new','setup_pending','active')),
  assigned_course_id uuid references public.courses(id) on delete set null,
  assigned_trainer_id uuid references public.trainers(id) on delete set null,
  enrollment_type text check (enrollment_type is null or enrollment_type in ('one_to_one','small_group')),
  cohort_id uuid references public.cohorts(id) on delete set null,
  start_date date,
  draft_schedule_timezone text,
  draft_schedule_rules jsonb not null default '[]'::jsonb,
  submitted_at timestamptz not null default now(),
  activated_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.trainer_availability (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  enabled boolean not null default true,
  unique(trainer_id, day_of_week, start_time, end_time),
  check (end_time > start_time)
);

create table if not exists public.trainer_availability_overrides (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers(id) on delete cascade,
  date date not null,
  start_time time not null,
  end_time time not null,
  override_type text not null check (override_type in ('available','unavailable')),
  reason text not null default '',
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);

create table if not exists public.schedule_events (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers(id) on delete restrict,
  course_id uuid references public.courses(id) on delete set null,
  enrollment_id uuid references public.enrollments(id) on delete set null,
  cohort_id uuid references public.cohorts(id) on delete set null,
  student_id uuid references public.students(id) on delete set null,
  title text not null,
  date date not null,
  start_time time not null,
  end_time time not null,
  timezone text not null default 'Asia/Kolkata',
  event_type text not null check (event_type in ('class','demo','school','workshop','meeting','training','blocked','leave')),
  delivery_mode text not null default 'one_to_one' check (delivery_mode in ('one_to_one','small_group','school','online','offline')),
  status text not null default 'scheduled' check (status in ('scheduled','tentative','conducted','cancelled','rescheduled','blocked')),
  notes text,
  rescheduled_to_id uuid references public.schedule_events(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);
create index if not exists schedule_trainer_date_idx on public.schedule_events(trainer_id,date,start_time);

create table if not exists public.class_attendance (
  id uuid primary key default gen_random_uuid(),
  schedule_event_id uuid not null references public.schedule_events(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  status text not null check (status in ('attended','late','absent','excused')),
  note text,
  updated_at timestamptz not null default now(),
  unique(schedule_event_id, student_id)
);


-- ---------------- Progress Core ----------------
-- Learning observations are concise per-class signals. They are separate from attendance so missed classes do not create false academic judgments.
create table if not exists public.learning_observations (
  id uuid primary key default gen_random_uuid(),
  schedule_event_id uuid not null references public.schedule_events(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  trainer_id uuid not null references public.trainers(id) on delete restrict,
  signal text not null default 'on_track' check (signal in ('on_track','reinforce','follow_up')),
  strength text not null default '',
  next_focus text not null default '',
  feedback text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(schedule_event_id, student_id)
);
create index if not exists learning_observations_enrollment_idx on public.learning_observations(enrollment_id, created_at desc);

-- Internal class notes are deliberately stored separately so Parent/Student RLS can never expose them.
create table if not exists public.learning_observation_internal_notes (
  schedule_event_id uuid not null references public.schedule_events(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  trainer_id uuid not null references public.trainers(id) on delete restrict,
  note text not null default '',
  updated_at timestamptz not null default now(),
  primary key(schedule_event_id, student_id)
);

-- Milestone/general trainer feedback. Session-level feedback stays in learning_observations.
create table if not exists public.trainer_feedback (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  trainer_id uuid not null references public.trainers(id) on delete restrict,
  feedback_type text not null default 'general' check (feedback_type in ('session','milestone','general')),
  title text not null,
  summary text not null default '',
  strengths text not null default '',
  next_focus text not null default '',
  signal text not null default 'on_track' check (signal in ('on_track','reinforce','follow_up')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists trainer_feedback_enrollment_idx on public.trainer_feedback(enrollment_id, created_at desc);

-- Learner project tracking. A future Learning layer may optionally link these to reusable project definitions.
create table if not exists public.learner_projects (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete restrict,
  title text not null,
  project_type text not null default 'guided' check (project_type in ('guided','milestone','independent','competition','other')),
  status text not null default 'not_started' check (status in ('not_started','in_progress','submitted','reviewed','completed')),
  skills text[] not null default '{}',
  evidence_url text,
  student_reflection text,
  trainer_feedback text,
  started_at date not null default current_date,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists learner_projects_enrollment_idx on public.learner_projects(enrollment_id, updated_at desc);

-- Hold history is retained separately even after an enrollment resumes.
create table if not exists public.enrollment_holds (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  reason text not null check (reason in ('exams','medical','travel','family','other')),
  start_date date not null,
  end_date date,
  status text not null default 'active' check (status in ('active','ended')),
  note text,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
create index if not exists enrollment_holds_enrollment_idx on public.enrollment_holds(enrollment_id, start_date desc);

-- Alert decisions are stored separately from rule-derived alerts so alerts can be recalculated without losing human review state.
create table if not exists public.progress_alert_actions (
  id uuid primary key default gen_random_uuid(),
  rule_key text unique not null,
  student_id uuid not null references public.students(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  status text not null default 'open' check (status in ('open','reviewed','resolved','dismissed')),
  note text,
  reviewed_at timestamptz,
  resolved_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Lightweight learning tables retained for the existing Student/Parent UI; the full Learning Layer is added later.
create table if not exists public.session_records (
  id uuid primary key default gen_random_uuid(), enrollment_id uuid references public.enrollments(id) on delete cascade,
  course_session_id uuid, student_id uuid references public.students(id) on delete cascade, trainer_id uuid references public.trainers(id) on delete set null,
  session_date date not null default current_date, attendance text not null default 'attended' check(attendance in ('attended','late','absent','excused')),
  understanding text default 'got_it', participation text default 'steady', practice_status text default 'optional', note text,
  created_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now()
);
create table if not exists public.quizzes (id uuid primary key default gen_random_uuid(),slug text unique not null,title text not null);
create table if not exists public.quiz_attempts (id uuid primary key default gen_random_uuid(),quiz_id uuid references public.quizzes(id) on delete cascade,student_id uuid references public.students(id) on delete cascade,score_percent numeric(5,2),completed_at timestamptz not null default now());
create table if not exists public.projects (id uuid primary key default gen_random_uuid(),title text not null,skills text[] not null default '{}');
create table if not exists public.project_submissions (id uuid primary key default gen_random_uuid(),project_id uuid references public.projects(id) on delete set null,student_id uuid references public.students(id) on delete cascade,status text not null default 'in_progress',score numeric(5,2),student_reflection text,mentor_feedback text,submitted_at timestamptz not null default now());
create table if not exists public.xp_transactions (id uuid primary key default gen_random_uuid(),student_id uuid references public.students(id) on delete cascade,points int not null,reason text not null,created_by uuid references public.profiles(id) on delete set null,created_at timestamptz not null default now());

-- Progress is a result of ACTUAL learner attendance, never manual entry.
create or replace function public.refresh_enrollment_progress(p_enrollment uuid) returns void language plpgsql security definer set search_path=public as $$
declare v_count int; v_total int; v_opening int;
begin
  select coalesce(opening_completed_sessions,0) into v_opening from public.enrollments where id=p_enrollment;
  select coalesce(v_opening,0)+count(*) into v_count from public.class_attendance where enrollment_id=p_enrollment and status in ('attended','late');
  select c.total_sessions into v_total from public.enrollments e join public.courses c on c.id=e.course_id where e.id=p_enrollment;
  update public.enrollments set sessions_completed=coalesce(v_count,0), progress_percent=case when coalesce(v_total,0)>0 then least(100,round((v_count::numeric/v_total::numeric)*100,2)) else 0 end, updated_at=now() where id=p_enrollment;
end $$;
create or replace function public.on_class_attendance_change() returns trigger language plpgsql security definer set search_path=public as $$
begin
  perform public.refresh_enrollment_progress(coalesce(new.enrollment_id,old.enrollment_id));
  return coalesce(new,old);
end $$;
drop trigger if exists class_attendance_progress_trigger on public.class_attendance;
create trigger class_attendance_progress_trigger after insert or update or delete on public.class_attendance for each row execute function public.on_class_attendance_change();

-- ---------------- Access helpers ----------------
create or replace function public.current_role() returns text language sql stable security definer set search_path=public as $$ select role from public.profiles where id=auth.uid() $$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select coalesce(public.current_role()='admin',false) $$;
create or replace function public.current_trainer_id() returns uuid language sql stable security definer set search_path=public as $$ select id from public.trainers where profile_id=auth.uid() $$;
create or replace function public.current_parent_id() returns uuid language sql stable security definer set search_path=public as $$ select id from public.parents where profile_id=auth.uid() $$;

alter table public.profiles enable row level security; alter table public.parents enable row level security; alter table public.courses enable row level security;
alter table public.trainers enable row level security; alter table public.trainer_courses enable row level security; alter table public.students enable row level security;
alter table public.student_guardians enable row level security; alter table public.parent_students enable row level security; alter table public.cohorts enable row level security;
alter table public.enrollments enable row level security; alter table public.onboarding_submissions enable row level security; alter table public.trainer_availability enable row level security;
alter table public.trainer_availability_overrides enable row level security; alter table public.schedule_events enable row level security; alter table public.class_attendance enable row level security;
alter table public.session_records enable row level security; alter table public.quizzes enable row level security; alter table public.quiz_attempts enable row level security; alter table public.projects enable row level security; alter table public.project_submissions enable row level security; alter table public.xp_transactions enable row level security;
alter table public.learning_observations enable row level security; alter table public.trainer_feedback enable row level security; alter table public.learner_projects enable row level security; alter table public.enrollment_holds enable row level security; alter table public.progress_alert_actions enable row level security;

-- Profiles / parent setup
create policy profiles_select on public.profiles for select using (public.is_admin() or id=auth.uid());
create policy profiles_insert_own on public.profiles for insert with check (id=auth.uid());
create policy profiles_update on public.profiles for update using (public.is_admin() or id=auth.uid()) with check (public.is_admin() or id=auth.uid());

-- Self-service users may update their name, but cannot promote or reactivate themselves.
create or replace function public.protect_profile_privileges() returns trigger language plpgsql security definer set search_path=public as $$begin
 if auth.role()='service_role' or public.is_admin() then return new; end if;
 if tg_op='INSERT' then
  if new.id is distinct from auth.uid() then raise exception 'A user can create only their own profile.'; end if;
  new.role:='parent'; new.active:=true;
 elsif new.id is distinct from auth.uid() then
  raise exception 'A user can update only their own profile.';
 elsif new.role is distinct from old.role or new.active is distinct from old.active then
  raise exception 'Role and account status can be changed only by an administrator.';
 end if;
 return new;
end$$;
drop trigger if exists protect_profile_privileges_trg on public.profiles;
create trigger protect_profile_privileges_trg before insert or update on public.profiles for each row execute function public.protect_profile_privileges();
create policy parents_select on public.parents for select using (public.is_admin() or profile_id=auth.uid());
create policy parents_insert_own on public.parents for insert with check (profile_id=auth.uid());
create policy parents_update_own on public.parents for update using (public.is_admin() or profile_id=auth.uid());

-- Master data
create policy courses_select on public.courses for select using (public.is_admin() or exists(select 1 from public.trainer_courses tc where tc.course_id=id and tc.trainer_id=public.current_trainer_id()) or exists(select 1 from public.enrollments e where e.course_id=id and (e.student_id in (select s.id from public.students s where s.profile_id=auth.uid()) or e.student_id in (select ps.student_id from public.parent_students ps where ps.parent_id=public.current_parent_id()))));
create policy courses_admin_write on public.courses for all using(public.is_admin()) with check(public.is_admin());
create policy trainers_select on public.trainers for select using (public.is_admin() or profile_id=auth.uid() or exists(select 1 from public.enrollments e where e.trainer_id=id and (e.student_id in(select s.id from public.students s where s.profile_id=auth.uid()) or e.student_id in(select ps.student_id from public.parent_students ps where ps.parent_id=public.current_parent_id()))));
create policy trainers_admin_write on public.trainers for all using(public.is_admin()) with check(public.is_admin());
create policy trainer_courses_select on public.trainer_courses for select using(public.is_admin() or trainer_id=public.current_trainer_id());
create policy trainer_courses_admin_write on public.trainer_courses for all using(public.is_admin()) with check(public.is_admin());

-- Student identity is visible only when linked/assigned. Guardian contacts remain ADMIN ONLY.
create policy students_select on public.students for select using (public.is_admin() or profile_id=auth.uid() or id in(select ps.student_id from public.parent_students ps where ps.parent_id=public.current_parent_id()) or exists(select 1 from public.enrollments e where e.student_id=id and e.trainer_id=public.current_trainer_id()));
create policy students_admin_write on public.students for all using(public.is_admin()) with check(public.is_admin());
create policy guardians_admin_only on public.student_guardians for all using(public.is_admin()) with check(public.is_admin());
create policy parent_students_select on public.parent_students for select using(public.is_admin() or parent_id=public.current_parent_id());
create policy parent_students_admin_write on public.parent_students for all using(public.is_admin()) with check(public.is_admin());

-- Delivery relationships
create policy enrollments_select on public.enrollments for select using(public.is_admin() or trainer_id=public.current_trainer_id() or student_id in(select s.id from public.students s where s.profile_id=auth.uid()) or student_id in(select ps.student_id from public.parent_students ps where ps.parent_id=public.current_parent_id()));
create policy enrollments_admin_write on public.enrollments for all using(public.is_admin()) with check(public.is_admin());
create policy cohorts_select on public.cohorts for select using(public.is_admin() or trainer_id=public.current_trainer_id() or exists(select 1 from public.enrollments e where e.cohort_id=id and (e.student_id in(select s.id from public.students s where s.profile_id=auth.uid()) or e.student_id in(select ps.student_id from public.parent_students ps where ps.parent_id=public.current_parent_id()))));
create policy cohorts_admin_write on public.cohorts for all using(public.is_admin()) with check(public.is_admin());

-- Onboarding: parent owns submission; only Admin can operationally activate it.
create policy onboarding_select on public.onboarding_submissions for select using(public.is_admin() or user_id=auth.uid());
create policy onboarding_insert on public.onboarding_submissions for insert with check(user_id=auth.uid());
create policy onboarding_parent_update on public.onboarding_submissions for update using(user_id=auth.uid() and status in('draft','new')) with check(user_id=auth.uid() and status in('draft','new'));
create policy onboarding_admin_update on public.onboarding_submissions for update using(public.is_admin()) with check(public.is_admin());

-- Availability: Admin manages; trainer can read their own.
create policy availability_select on public.trainer_availability for select using(public.is_admin() or trainer_id=public.current_trainer_id());
create policy availability_admin_write on public.trainer_availability for all using(public.is_admin()) with check(public.is_admin());
create policy availability_override_select on public.trainer_availability_overrides for select using(public.is_admin() or trainer_id=public.current_trainer_id());
create policy availability_override_admin_write on public.trainer_availability_overrides for all using(public.is_admin()) with check(public.is_admin());

-- Schedule: Admin manages whole calendar; trainer can see own; families see only linked class events.
create policy schedule_select on public.schedule_events for select using(public.is_admin() or trainer_id=public.current_trainer_id() or student_id in(select s.id from public.students s where s.profile_id=auth.uid()) or student_id in(select ps.student_id from public.parent_students ps where ps.parent_id=public.current_parent_id()) or enrollment_id in(select e.id from public.enrollments e where e.student_id in(select s.id from public.students s where s.profile_id=auth.uid()) or e.student_id in(select ps.student_id from public.parent_students ps where ps.parent_id=public.current_parent_id())) or cohort_id in(select e.cohort_id from public.enrollments e where e.cohort_id is not null and (e.student_id in(select s.id from public.students s where s.profile_id=auth.uid()) or e.student_id in(select ps.student_id from public.parent_students ps where ps.parent_id=public.current_parent_id()))));
create policy schedule_admin_write on public.schedule_events for all using(public.is_admin()) with check(public.is_admin());
create policy schedule_trainer_outcome on public.schedule_events for update using(trainer_id=public.current_trainer_id()) with check(trainer_id=public.current_trainer_id());

-- Class attendance: Admin + assigned trainer write. Parent/student can read own rows.
create policy attendance_select on public.class_attendance for select using(public.is_admin() or exists(select 1 from public.enrollments e where e.id=enrollment_id and e.trainer_id=public.current_trainer_id()) or student_id in(select s.id from public.students s where s.profile_id=auth.uid()) or student_id in(select ps.student_id from public.parent_students ps where ps.parent_id=public.current_parent_id()));
create policy attendance_admin_all on public.class_attendance for all using(public.is_admin()) with check(public.is_admin());
create policy attendance_trainer_insert on public.class_attendance for insert with check(exists(select 1 from public.enrollments e where e.id=enrollment_id and e.trainer_id=public.current_trainer_id()));
create policy attendance_trainer_update on public.class_attendance for update using(exists(select 1 from public.enrollments e where e.id=enrollment_id and e.trainer_id=public.current_trainer_id())) with check(exists(select 1 from public.enrollments e where e.id=enrollment_id and e.trainer_id=public.current_trainer_id()));


-- Progress Core: Admin sees all; assigned trainer can write/read; families read only their own learner records.
create policy learning_observations_select on public.learning_observations for select using(public.is_admin() or trainer_id=public.current_trainer_id() or student_id in(select s.id from public.students s where s.profile_id=auth.uid()) or student_id in(select ps.student_id from public.parent_students ps where ps.parent_id=public.current_parent_id()));
create policy learning_observations_admin_all on public.learning_observations for all using(public.is_admin()) with check(public.is_admin());
create policy learning_observations_trainer_insert on public.learning_observations for insert with check(trainer_id=public.current_trainer_id() and exists(select 1 from public.enrollments e where e.id=enrollment_id and e.trainer_id=public.current_trainer_id()));
create policy learning_observations_trainer_update on public.learning_observations for update using(trainer_id=public.current_trainer_id()) with check(trainer_id=public.current_trainer_id());

alter table public.learning_observation_internal_notes enable row level security;
drop policy if exists learning_internal_notes_select on public.learning_observation_internal_notes;
create policy learning_internal_notes_select on public.learning_observation_internal_notes for select using(public.is_admin() or exists(select 1 from public.enrollments e where e.id=enrollment_id and e.trainer_id=public.current_trainer_id()));
drop policy if exists learning_internal_notes_admin_all on public.learning_observation_internal_notes;
create policy learning_internal_notes_admin_all on public.learning_observation_internal_notes for all using(public.is_admin()) with check(public.is_admin());
drop policy if exists learning_internal_notes_trainer_insert on public.learning_observation_internal_notes;
create policy learning_internal_notes_trainer_insert on public.learning_observation_internal_notes for insert with check(trainer_id=public.current_trainer_id() and exists(select 1 from public.enrollments e where e.id=enrollment_id and e.trainer_id=public.current_trainer_id()));
drop policy if exists learning_internal_notes_trainer_update on public.learning_observation_internal_notes;
create policy learning_internal_notes_trainer_update on public.learning_observation_internal_notes for update using(trainer_id=public.current_trainer_id()) with check(trainer_id=public.current_trainer_id());

create policy trainer_feedback_select on public.trainer_feedback for select using(public.is_admin() or trainer_id=public.current_trainer_id() or student_id in(select s.id from public.students s where s.profile_id=auth.uid()) or student_id in(select ps.student_id from public.parent_students ps where ps.parent_id=public.current_parent_id()));
create policy trainer_feedback_admin_all on public.trainer_feedback for all using(public.is_admin()) with check(public.is_admin());
create policy trainer_feedback_trainer_insert on public.trainer_feedback for insert with check(trainer_id=public.current_trainer_id() and exists(select 1 from public.enrollments e where e.id=enrollment_id and e.trainer_id=public.current_trainer_id()));
create policy trainer_feedback_trainer_update on public.trainer_feedback for update using(trainer_id=public.current_trainer_id()) with check(trainer_id=public.current_trainer_id());

create policy learner_projects_select on public.learner_projects for select using(public.is_admin() or exists(select 1 from public.enrollments e where e.id=enrollment_id and e.trainer_id=public.current_trainer_id()) or student_id in(select s.id from public.students s where s.profile_id=auth.uid()) or student_id in(select ps.student_id from public.parent_students ps where ps.parent_id=public.current_parent_id()));
create policy learner_projects_admin_all on public.learner_projects for all using(public.is_admin()) with check(public.is_admin());
create policy learner_projects_trainer_insert on public.learner_projects for insert with check(exists(select 1 from public.enrollments e where e.id=enrollment_id and e.trainer_id=public.current_trainer_id()));
create policy learner_projects_trainer_update on public.learner_projects for update using(exists(select 1 from public.enrollments e where e.id=enrollment_id and e.trainer_id=public.current_trainer_id())) with check(exists(select 1 from public.enrollments e where e.id=enrollment_id and e.trainer_id=public.current_trainer_id()));

create policy enrollment_holds_select on public.enrollment_holds for select using(public.is_admin() or exists(select 1 from public.enrollments e where e.id=enrollment_id and e.trainer_id=public.current_trainer_id()) or student_id in(select s.id from public.students s where s.profile_id=auth.uid()) or student_id in(select ps.student_id from public.parent_students ps where ps.parent_id=public.current_parent_id()));
create policy enrollment_holds_admin_write on public.enrollment_holds for all using(public.is_admin()) with check(public.is_admin());

create policy progress_alert_actions_select on public.progress_alert_actions for select using(public.is_admin() or exists(select 1 from public.enrollments e where e.id=enrollment_id and e.trainer_id=public.current_trainer_id()));
create policy progress_alert_actions_admin_all on public.progress_alert_actions for all using(public.is_admin()) with check(public.is_admin());
create policy progress_alert_actions_trainer_insert on public.progress_alert_actions for insert with check(exists(select 1 from public.enrollments e where e.id=enrollment_id and e.trainer_id=public.current_trainer_id()));
create policy progress_alert_actions_trainer_update on public.progress_alert_actions for update using(exists(select 1 from public.enrollments e where e.id=enrollment_id and e.trainer_id=public.current_trainer_id())) with check(exists(select 1 from public.enrollments e where e.id=enrollment_id and e.trainer_id=public.current_trainer_id()));

-- Existing lightweight learning data policies.
create policy session_records_select on public.session_records for select using(public.is_admin() or trainer_id=public.current_trainer_id() or student_id in(select s.id from public.students s where s.profile_id=auth.uid()) or student_id in(select ps.student_id from public.parent_students ps where ps.parent_id=public.current_parent_id()));
create policy session_records_trainer_write on public.session_records for insert with check(public.is_admin() or trainer_id=public.current_trainer_id());
create policy quizzes_read on public.quizzes for select using(auth.uid() is not null);
create policy quiz_attempts_select on public.quiz_attempts for select using(public.is_admin() or student_id in(select s.id from public.students s where s.profile_id=auth.uid()) or student_id in(select ps.student_id from public.parent_students ps where ps.parent_id=public.current_parent_id()) or exists(select 1 from public.enrollments e where e.student_id=quiz_attempts.student_id and e.trainer_id=public.current_trainer_id()));
create policy quiz_attempts_insert_self on public.quiz_attempts for insert with check(student_id in(select s.id from public.students s where s.profile_id=auth.uid()));
create policy projects_read on public.projects for select using(auth.uid() is not null);
create policy project_submissions_select on public.project_submissions for select using(public.is_admin() or student_id in(select s.id from public.students s where s.profile_id=auth.uid()) or student_id in(select ps.student_id from public.parent_students ps where ps.parent_id=public.current_parent_id()) or exists(select 1 from public.enrollments e where e.student_id=project_submissions.student_id and e.trainer_id=public.current_trainer_id()));
create policy xp_select on public.xp_transactions for select using(public.is_admin() or student_id in(select s.id from public.students s where s.profile_id=auth.uid()) or student_id in(select ps.student_id from public.parent_students ps where ps.parent_id=public.current_parent_id()));
create policy xp_insert_self on public.xp_transactions for insert with check(student_id in(select s.id from public.students s where s.profile_id=auth.uid()));

-- ============================================================
-- Notifications + Realtime Communication
-- In-app communication only. Realtime delivery uses Supabase Postgres Changes.
-- No email, WhatsApp, SMS or mobile push delivery is included.
-- ============================================================
create table if not exists public.portal_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_role text not null check (recipient_role in ('admin','trainer','parent','student')),
  recipient_profile_id uuid references public.profiles(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  trainer_id uuid references public.trainers(id) on delete cascade,
  type text not null,
  priority text not null default 'info' check (priority in ('info','action','important')),
  title text not null,
  message text not null,
  href text not null default '/',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists portal_notifications_role_created_idx on public.portal_notifications(recipient_role,created_at desc);
create index if not exists portal_notifications_student_idx on public.portal_notifications(student_id,created_at desc);
create index if not exists portal_notifications_trainer_idx on public.portal_notifications(trainer_id,created_at desc);

create table if not exists public.communication_threads (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('schedule','progress','attendance','technical','project','general')),
  status text not null default 'open' check (status in ('open','waiting_parent','waiting_team','resolved')),
  subject text not null,
  student_id uuid references public.students(id) on delete set null,
  student_name text,
  parent_id uuid references public.parents(id) on delete set null,
  parent_name text,
  trainer_id uuid references public.trainers(id) on delete set null,
  trainer_name text,
  assigned_to text not null default 'Learning Support',
  last_message_at timestamptz not null default now(),
  last_message_preview text not null default '',
  unread_admin integer not null default 0,
  unread_parent integer not null default 0,
  unread_trainer integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists communication_threads_parent_idx on public.communication_threads(parent_id,last_message_at desc);
create index if not exists communication_threads_trainer_idx on public.communication_threads(trainer_id,last_message_at desc);
create index if not exists communication_threads_student_idx on public.communication_threads(student_id,last_message_at desc);

create table if not exists public.communication_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.communication_threads(id) on delete cascade,
  sender_profile_id uuid references public.profiles(id) on delete set null,
  sender_role text not null check (sender_role in ('admin','trainer','parent')),
  sender_name text not null,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists communication_messages_thread_idx on public.communication_messages(thread_id,created_at);

alter table public.portal_notifications enable row level security;
alter table public.communication_threads enable row level security;
alter table public.communication_messages enable row level security;

-- Notification visibility is role-specific. A trainer must never be able to read a
-- parent notification merely because the same learner/trainer ids appear on the row,
-- and a parent must never see trainer/admin notifications linked to their child.
drop policy if exists notifications_select on public.portal_notifications;
create policy notifications_select on public.portal_notifications for select using(
  public.is_admin()
  or (recipient_role='trainer' and trainer_id=public.current_trainer_id())
  or (recipient_role='parent' and (recipient_profile_id=auth.uid() or student_id in(select ps.student_id from public.parent_students ps where ps.parent_id=public.current_parent_id())))
  or (recipient_role='student' and (recipient_profile_id=auth.uid() or student_id in(select s.id from public.students s where s.profile_id=auth.uid())))
);
drop policy if exists notifications_update on public.portal_notifications;
create policy notifications_update on public.portal_notifications for update using(
  public.is_admin()
  or (recipient_role='trainer' and trainer_id=public.current_trainer_id())
  or (recipient_role='parent' and (recipient_profile_id=auth.uid() or student_id in(select ps.student_id from public.parent_students ps where ps.parent_id=public.current_parent_id())))
  or (recipient_role='student' and (recipient_profile_id=auth.uid() or student_id in(select s.id from public.students s where s.profile_id=auth.uid())))
) with check(
  public.is_admin()
  or (recipient_role='trainer' and trainer_id=public.current_trainer_id())
  or (recipient_role='parent' and (recipient_profile_id=auth.uid() or student_id in(select ps.student_id from public.parent_students ps where ps.parent_id=public.current_parent_id())))
  or (recipient_role='student' and (recipient_profile_id=auth.uid() or student_id in(select s.id from public.students s where s.profile_id=auth.uid())))
);
drop policy if exists notifications_admin_insert on public.portal_notifications;
create policy notifications_admin_insert on public.portal_notifications for insert with check(public.is_admin());
drop policy if exists notifications_trainer_insert on public.portal_notifications;
create policy notifications_trainer_insert on public.portal_notifications for insert with check(
  recipient_role='trainer' and trainer_id=public.current_trainer_id()
);

drop policy if exists communication_threads_select on public.communication_threads;
create policy communication_threads_select on public.communication_threads for select using(
  public.is_admin()
  or trainer_id=public.current_trainer_id()
  or parent_id=public.current_parent_id()
);
drop policy if exists communication_threads_admin_all on public.communication_threads;
create policy communication_threads_admin_all on public.communication_threads for all using(public.is_admin()) with check(public.is_admin());

-- Parents can open a thread only for their own learner. If they address a trainer,
-- that trainer must be assigned to that learner through an active/on-hold enrollment.
drop policy if exists communication_threads_parent_insert on public.communication_threads;
create policy communication_threads_parent_insert on public.communication_threads for insert with check(
  parent_id=public.current_parent_id()
  and (
    (student_id is null and trainer_id is null)
    or (
      student_id in(select ps.student_id from public.parent_students ps where ps.parent_id=public.current_parent_id())
      and (trainer_id is null or exists(select 1 from public.enrollments e where e.student_id=communication_threads.student_id and e.trainer_id=communication_threads.trainer_id and e.status in ('active','on_hold')))
    )
  )
);

-- Trainers can start communication only for learners currently assigned to them.
drop policy if exists communication_threads_trainer_insert on public.communication_threads;
create policy communication_threads_trainer_insert on public.communication_threads for insert with check(
  trainer_id=public.current_trainer_id()
  and (student_id is null or exists(select 1 from public.enrollments e where e.student_id=communication_threads.student_id and e.trainer_id=public.current_trainer_id() and e.status in ('active','on_hold')))
);

-- Non-admin clients cannot directly edit arbitrary thread metadata. Read counters and
-- workflow status are changed through constrained RPCs below.
drop policy if exists communication_threads_parent_update on public.communication_threads;
drop policy if exists communication_threads_trainer_update on public.communication_threads;

drop policy if exists communication_messages_select on public.communication_messages;
create policy communication_messages_select on public.communication_messages for select using(
  exists(select 1 from public.communication_threads t where t.id=thread_id and (public.is_admin() or t.trainer_id=public.current_trainer_id() or t.parent_id=public.current_parent_id()))
);
drop policy if exists communication_messages_insert on public.communication_messages;
create policy communication_messages_insert on public.communication_messages for insert with check(
  exists(select 1 from public.communication_threads t where t.id=thread_id and (public.is_admin() or t.trainer_id=public.current_trainer_id() or t.parent_id=public.current_parent_id()))
  and ((sender_role='admin' and public.is_admin()) or (sender_role='trainer' and exists(select 1 from public.communication_threads t where t.id=thread_id and t.trainer_id=public.current_trainer_id())) or (sender_role='parent' and exists(select 1 from public.communication_threads t where t.id=thread_id and t.parent_id=public.current_parent_id())))
);

-- Resolve participant ids inside the database so Trainer clients never need to query private family links.
create or replace function public.prepare_communication_thread() returns trigger language plpgsql security definer set search_path=public as $$
declare v_role text; v_name text; v_student_name text;
begin
  v_role:=public.current_role();
  if new.student_id is not null then
    select full_name into v_student_name from public.students where id=new.student_id;
    if coalesce(v_student_name,'')<>'' then new.student_name:=v_student_name; end if;
  end if;
  if v_role='parent' then
    new.parent_id:=public.current_parent_id();
    select p.full_name into v_name from public.parents pa join public.profiles p on p.id=pa.profile_id where pa.id=new.parent_id;
    if coalesce(v_name,'')<>'' then new.parent_name:=v_name; end if;
    if new.student_id is not null and new.trainer_id is null then
      select e.trainer_id into new.trainer_id from public.enrollments e where e.student_id=new.student_id and e.status in ('active','on_hold') order by e.created_at desc limit 1;
    end if;
  elsif v_role='trainer' then
    new.trainer_id:=public.current_trainer_id();
    select p.full_name into v_name from public.trainers tr join public.profiles p on p.id=tr.profile_id where tr.id=new.trainer_id;
    if coalesce(v_name,'')<>'' then new.trainer_name:=v_name; end if;
    if new.student_id is not null then
      select ps.parent_id into new.parent_id from public.parent_students ps where ps.student_id=new.student_id limit 1;
      if new.parent_id is not null then
        select p.full_name into v_name from public.parents pa join public.profiles p on p.id=pa.profile_id where pa.id=new.parent_id;
        if coalesce(v_name,'')<>'' then new.parent_name:=v_name; end if;
      end if;
    else
      new.parent_id:=null;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists communication_thread_before_insert on public.communication_threads;
create trigger communication_thread_before_insert before insert on public.communication_threads for each row execute function public.prepare_communication_thread();

-- Force message identity from the authenticated profile instead of trusting a browser-
-- supplied profile id/name. The sender role remains protected by the insert policy above.
create or replace function public.prepare_communication_message() returns trigger language plpgsql security definer set search_path=public as $$
declare v_name text;
begin
  new.sender_profile_id := auth.uid();
  select full_name into v_name from public.profiles where id=auth.uid();
  if coalesce(v_name,'')<>'' then new.sender_name:=v_name; end if;
  return new;
end $$;
drop trigger if exists communication_message_before_insert on public.communication_messages;
create trigger communication_message_before_insert before insert on public.communication_messages for each row execute function public.prepare_communication_message();

-- Safe read-state mutation: each role can clear only its own unread counter on an
-- authorized thread. This avoids granting broad UPDATE rights on the thread table.
create or replace function public.mark_communication_thread_read(p_thread_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin
  if public.is_admin() then
    update public.communication_threads set unread_admin=0,updated_at=now() where id=p_thread_id and unread_admin<>0;
  elsif public.current_role()='trainer' then
    update public.communication_threads set unread_trainer=0,updated_at=now() where id=p_thread_id and trainer_id=public.current_trainer_id() and unread_trainer<>0;
  elsif public.current_role()='parent' then
    update public.communication_threads set unread_parent=0,updated_at=now() where id=p_thread_id and parent_id=public.current_parent_id() and unread_parent<>0;
  else
    raise exception 'Not authorized';
  end if;
end $$;
revoke all on function public.mark_communication_thread_read(uuid) from public;
grant execute on function public.mark_communication_thread_read(uuid) to authenticated;

-- Only Admin and the assigned Trainer can move a thread through the support workflow.
create or replace function public.set_communication_thread_status(p_thread_id uuid,p_status text) returns void language plpgsql security definer set search_path=public as $$
begin
  if p_status not in ('open','waiting_parent','waiting_team','resolved') then raise exception 'Invalid thread status'; end if;
  if public.is_admin() then
    update public.communication_threads set status=p_status,updated_at=now() where id=p_thread_id;
  elsif public.current_role()='trainer' then
    update public.communication_threads set status=p_status,updated_at=now() where id=p_thread_id and trainer_id=public.current_trainer_id();
    if not found then raise exception 'Not authorized'; end if;
  else
    raise exception 'Not authorized';
  end if;
end $$;
revoke all on function public.set_communication_thread_status(uuid,text) from public;
grant execute on function public.set_communication_thread_status(uuid,text) to authenticated;

-- Keep thread inbox metadata and in-app notifications synchronized when a message is sent.
create or replace function public.handle_communication_message() returns trigger language plpgsql security definer set search_path=public as $$
declare t public.communication_threads;
begin
  select * into t from public.communication_threads where id=new.thread_id;
  update public.communication_threads set
    last_message_at=new.created_at,
    last_message_preview=left(new.body,240),
    status=case when new.sender_role='parent' then 'waiting_team' else 'waiting_parent' end,
    unread_admin=case when new.sender_role='parent' then unread_admin+1 else unread_admin end,
    unread_parent=case when new.sender_role<>'parent' then unread_parent+1 else unread_parent end,
    unread_trainer=case when new.sender_role='parent' and trainer_id is not null then unread_trainer+1 else unread_trainer end,
    updated_at=now()
  where id=new.thread_id;
  if new.sender_role='parent' then
    insert into public.portal_notifications(recipient_role,student_id,trainer_id,type,priority,title,message,href)
    values('admin',t.student_id,t.trainer_id,'message_received','action','Parent message awaiting response',left(new.body,180),'/admin/messages/'||new.thread_id);
    if t.trainer_id is not null then
      insert into public.portal_notifications(recipient_role,student_id,trainer_id,type,priority,title,message,href)
      values('trainer',t.student_id,t.trainer_id,'message_received','action','Parent message awaiting reply',left(new.body,180),'/trainer/messages/'||new.thread_id);
    end if;
  else
    insert into public.portal_notifications(recipient_role,student_id,trainer_id,type,priority,title,message,href)
    values('parent',t.student_id,t.trainer_id,'message_received','action','New message from Robotronix™',left(new.body,180),'/parent/messages/'||new.thread_id);
  end if;
  return new;
end $$;
drop trigger if exists communication_message_after_insert on public.communication_messages;
create trigger communication_message_after_insert after insert on public.communication_messages for each row execute function public.handle_communication_message();

-- Important operational events create in-app notifications. These triggers are intentionally
-- selective so parents are not notified about every low-value internal update.
create or replace function public.notify_schedule_change() returns trigger language plpgsql security definer set search_path=public as $$
declare event_type text; title_text text; msg text;
begin
  if tg_op='INSERT' then event_type:='class_scheduled'; title_text:='Class scheduled'; msg:='A learning session has been scheduled.';
  elsif new.status='cancelled' and old.status is distinct from new.status then event_type:='class_cancelled'; title_text:='Class cancelled'; msg:='A scheduled learning session has been cancelled.';
  elsif new.status='rescheduled' or new.date is distinct from old.date or new.start_time is distinct from old.start_time then event_type:='class_rescheduled'; title_text:='Class schedule updated'; msg:='A learning session has a revised date or time.';
  else return new; end if;
  if new.student_id is not null then
    insert into public.portal_notifications(recipient_role,student_id,trainer_id,type,priority,title,message,href) values('parent',new.student_id,new.trainer_id,event_type,'action',title_text,msg,'/parent');
    insert into public.portal_notifications(recipient_role,student_id,trainer_id,type,priority,title,message,href) values('student',new.student_id,new.trainer_id,event_type,'info',title_text,msg,'/student');
  end if;
  insert into public.portal_notifications(recipient_role,student_id,trainer_id,type,priority,title,message,href) values('trainer',new.student_id,new.trainer_id,event_type,'info',title_text,msg,'/trainer/schedule');
  return new;
end $$;
drop trigger if exists schedule_notification_insert on public.schedule_events;
create trigger schedule_notification_insert after insert on public.schedule_events for each row when (new.event_type='class') execute function public.notify_schedule_change();
drop trigger if exists schedule_notification_update on public.schedule_events;
create trigger schedule_notification_update after update on public.schedule_events for each row when (new.event_type='class') execute function public.notify_schedule_change();

create or replace function public.notify_absence() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' then
    if new.status='absent' then
      insert into public.portal_notifications(recipient_role,student_id,type,priority,title,message,href)
      values('parent',new.student_id,'attendance_absent','important','Attendance update','Your child was marked absent for a scheduled class.','/parent');
    end if;
  elsif new.status='absent' and old.status is distinct from new.status then
    insert into public.portal_notifications(recipient_role,student_id,type,priority,title,message,href)
    values('parent',new.student_id,'attendance_absent','important','Attendance update','Your child was marked absent for a scheduled class.','/parent');
  end if;
  return new;
end $$;
drop trigger if exists attendance_notification on public.class_attendance;
create trigger attendance_notification after insert or update on public.class_attendance for each row execute function public.notify_absence();

create or replace function public.notify_feedback() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.portal_notifications(recipient_role,student_id,trainer_id,type,priority,title,message,href) values('parent',new.student_id,new.trainer_id,'feedback_posted','info','New mentor feedback','A mentor has shared a new learning update.','/parent');
  insert into public.portal_notifications(recipient_role,student_id,trainer_id,type,priority,title,message,href) values('student',new.student_id,new.trainer_id,'feedback_posted','info','New mentor feedback','Your mentor has shared a new learning update.','/student');
  return new;
end $$;
drop trigger if exists trainer_feedback_notification on public.trainer_feedback;
create trigger trainer_feedback_notification after insert on public.trainer_feedback for each row execute function public.notify_feedback();

create or replace function public.notify_project_review() returns trigger language plpgsql security definer set search_path=public as $$
declare tr uuid;
begin
  if new.status in ('reviewed','completed') and old.status is distinct from new.status then
    select trainer_id into tr from public.enrollments where id=new.enrollment_id;
    insert into public.portal_notifications(recipient_role,student_id,trainer_id,type,priority,title,message,href)
    values('parent',new.student_id,tr,'project_reviewed','info','Project reviewed',new.title||' has a new mentor review.','/parent');
    insert into public.portal_notifications(recipient_role,student_id,trainer_id,type,priority,title,message,href)
    values('student',new.student_id,tr,'project_reviewed','info','Project review complete',new.title||' has a new mentor review.','/student/portfolio');
  end if;
  return new;
end $$;
drop trigger if exists learner_project_review_notification on public.learner_projects;
create trigger learner_project_review_notification after update on public.learner_projects for each row execute function public.notify_project_review();

create or replace function public.notify_enrollment_hold() returns trigger language plpgsql security definer set search_path=public as $$
declare kind text; title_text text; body text;
begin
  if tg_op='INSERT' and new.status='active' then kind:='hold_started'; title_text:='Learning pause recorded'; body:='A temporary enrollment hold has been recorded.';
  elsif tg_op='UPDATE' and new.status='ended' and old.status is distinct from new.status then kind:='hold_ended'; title_text:='Learning pause ended'; body:='The enrollment hold has ended and learning can resume.';
  else return new; end if;
  insert into public.portal_notifications(recipient_role,student_id,type,priority,title,message,href) values('parent',new.student_id,kind,'info',title_text,body,'/parent');
  insert into public.portal_notifications(recipient_role,student_id,type,priority,title,message,href) values('student',new.student_id,kind,'info',title_text,body,'/student');
  return new;
end $$;
drop trigger if exists enrollment_hold_notification_insert on public.enrollment_holds;
create trigger enrollment_hold_notification_insert after insert on public.enrollment_holds for each row execute function public.notify_enrollment_hold();
drop trigger if exists enrollment_hold_notification_update on public.enrollment_holds;
create trigger enrollment_hold_notification_update after update on public.enrollment_holds for each row execute function public.notify_enrollment_hold();

create or replace function public.notify_onboarding_activation() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status='active' and old.status is distinct from new.status and new.user_id is not null then
    insert into public.portal_notifications(recipient_role,recipient_profile_id,type,priority,title,message,href)
    values('parent',new.user_id,'enrollment_activated','important','Learner profile activated','Your child’s Robotronix™ enrollment is active. You can now view learning progress and schedule updates.','/parent');
  end if;
  return new;
end $$;
drop trigger if exists onboarding_activation_notification on public.onboarding_submissions;
create trigger onboarding_activation_notification after update on public.onboarding_submissions for each row execute function public.notify_onboarding_activation();


-- ============================================================
-- Supabase Realtime publication
-- RLS continues to decide which authenticated subscribers receive each row.
-- ============================================================
alter table public.portal_notifications replica identity full;
alter table public.communication_threads replica identity full;
alter table public.communication_messages replica identity full;

do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='portal_notifications') then
    alter publication supabase_realtime add table public.portal_notifications;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='communication_threads') then
    alter publication supabase_realtime add table public.communication_threads;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='communication_messages') then
    alter publication supabase_realtime add table public.communication_messages;
  end if;
end $$;

-- ============================================================
-- Operations additions
-- ============================================================
-- Operations and workflow controls

-- Outcome-led course catalogue metadata and flexible Maker Lab tracking.
alter table public.courses add column if not exists public_name text;
alter table public.courses add column if not exists internal_name text;
alter table public.courses add column if not exists outcome_subtitle text not null default '';
update public.courses set public_name=coalesce(public_name,title), internal_name=coalesce(internal_name,nullif(short_title,''),title);
alter table public.courses alter column public_name set not null;
alter table public.courses alter column internal_name set not null;
alter table public.courses drop constraint if exists courses_total_sessions_check;
alter table public.courses add constraint courses_total_sessions_check check(total_sessions >= 0);

-- Delivery channel / offline Maker Lab tracking.
alter table public.cohorts add column if not exists delivery_channel text not null default 'online';
alter table public.cohorts add column if not exists center_location text not null default '';
alter table public.cohorts add column if not exists schedule_mode text not null default 'recurring';
alter table public.cohorts drop constraint if exists cohorts_delivery_channel_check;
alter table public.cohorts add constraint cohorts_delivery_channel_check check(delivery_channel in ('online','offline','hybrid'));
alter table public.cohorts drop constraint if exists cohorts_schedule_mode_check;
alter table public.cohorts add constraint cohorts_schedule_mode_check check(schedule_mode in ('recurring','flexible','ad_hoc'));
alter table public.enrollments add column if not exists delivery_channel text not null default 'online';
alter table public.enrollments add column if not exists center_location text not null default '';
alter table public.enrollments add column if not exists schedule_mode text not null default 'recurring';
alter table public.enrollments drop constraint if exists enrollments_delivery_channel_check;
alter table public.enrollments add constraint enrollments_delivery_channel_check check(delivery_channel in ('online','offline','hybrid'));
alter table public.enrollments drop constraint if exists enrollments_schedule_mode_check;
alter table public.enrollments add constraint enrollments_schedule_mode_check check(schedule_mode in ('recurring','flexible','ad_hoc'));

-- Actual occurrence history / reschedule linkage.
alter table public.schedule_events add column if not exists occurrence_kind text not null default 'regular';
alter table public.schedule_events add column if not exists original_event_id uuid references public.schedule_events(id) on delete set null;
alter table public.schedule_events add column if not exists requested_by text;
alter table public.schedule_events add column if not exists change_reason text;
alter table public.schedule_events add column if not exists session_topic text;
alter table public.schedule_events add column if not exists project_worked_on text;
alter table public.schedule_events add column if not exists skills_worked text[] not null default '{}';
alter table public.schedule_events drop constraint if exists schedule_events_occurrence_kind_check;
alter table public.schedule_events add constraint schedule_events_occurrence_kind_check check(occurrence_kind in ('regular','rescheduled_replacement','makeup','ad_hoc','extra'));
alter table public.schedule_events drop constraint if exists schedule_events_requested_by_check;
alter table public.schedule_events add constraint schedule_events_requested_by_check check(requested_by is null or requested_by in ('parent','student','trainer','admin'));
alter table public.schedule_events drop constraint if exists schedule_events_status_check;
alter table public.schedule_events add constraint schedule_events_status_check check(status in ('scheduled','tentative','conducted','cancelled','rescheduled','blocked','missed','makeup'));
alter table public.schedule_events drop constraint if exists schedule_events_delivery_mode_check;
alter table public.schedule_events add constraint schedule_events_delivery_mode_check check(delivery_mode in ('one_to_one','small_group','school','online','offline','hybrid'));

-- Restricted trainer payout/compliance record. No Aadhaar is collected.
create table if not exists public.trainer_finance (
 id uuid primary key default gen_random_uuid(),
 trainer_id uuid not null unique references public.trainers(id) on delete restrict,
 account_holder_name text not null default '', bank_name text not null default '', account_number text not null default '',
 ifsc text not null default '', upi_id text not null default '',
 preferred_payout_method text not null default 'bank' check(preferred_payout_method in ('bank','upi','other')),
 payment_model text not null default 'per_class' check(payment_model in ('per_class','hourly','monthly','retainer','other')),
 payment_rate numeric(12,2), pan text not null default '',
 compliance_status text not null default 'pending' check(compliance_status in ('pending','verified','needs_update')),
 notes text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.trainer_finance enable row level security;
drop policy if exists trainer_finance_admin_select on public.trainer_finance;
create policy trainer_finance_admin_select on public.trainer_finance for select using(public.is_admin());
drop policy if exists trainer_finance_admin_insert on public.trainer_finance;
create policy trainer_finance_admin_insert on public.trainer_finance for insert with check(public.is_admin());
drop policy if exists trainer_finance_admin_update on public.trainer_finance;
create policy trainer_finance_admin_update on public.trainer_finance for update using(public.is_admin()) with check(public.is_admin());
drop policy if exists trainer_finance_admin_delete on public.trainer_finance;
create policy trainer_finance_admin_delete on public.trainer_finance for delete using(public.is_admin());

-- Configurable in-app reminder policies.
create table if not exists public.reminder_policies (
 id text primary key,
 event_type text not null check(event_type in ('class','attendance_pending')),
 recipient_role text not null check(recipient_role in ('trainer','parent','student','admin')),
 minutes_before int, minutes_after int, enabled boolean not null default true,
 updated_at timestamptz not null default now(),
 check((event_type='class' and minutes_before is not null and minutes_before >= 0) or (event_type='attendance_pending' and minutes_after is not null and minutes_after >= 0))
);
insert into public.reminder_policies(id,event_type,recipient_role,minutes_before,minutes_after,enabled) values
 ('rem-trainer-30','class','trainer',30,null,true),
 ('rem-trainer-10','class','trainer',10,null,true),
 ('rem-parent-30','class','parent',30,null,true),
 ('rem-student-15','class','student',15,null,true),
 ('rem-trainer-update-30','attendance_pending','trainer',null,30,true)
on conflict(id) do nothing;
alter table public.reminder_policies enable row level security;
drop policy if exists reminder_policies_admin_all on public.reminder_policies;
create policy reminder_policies_admin_all on public.reminder_policies for all using(public.is_admin()) with check(public.is_admin());

-- Notification dedupe lets a scheduled job safely run repeatedly.
alter table public.portal_notifications add column if not exists dedupe_key text;
create unique index if not exists portal_notifications_dedupe_uidx on public.portal_notifications(dedupe_key) where dedupe_key is not null;

-- Produce class reminders from the actual dated occurrence. PostgreSQL AT TIME ZONE uses the IANA timezone database,
-- so DST and non-hour offsets are resolved per class date rather than hard-coded.
create or replace function public.process_class_reminders()
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 p record; e record; sid uuid; class_at timestamptz; end_at timestamptz; target_at timestamptz; inserted_count int:=0; rc int:=0;
begin
 for p in select * from public.reminder_policies where enabled loop
  for e in select se.* from public.schedule_events se where se.event_type='class' and se.status='scheduled' loop
   class_at := (e.date + e.start_time) at time zone e.timezone;
   end_at := (e.date + e.end_time) at time zone e.timezone;
   if p.event_type='class' then target_at:=class_at-make_interval(mins=>p.minutes_before);
   else target_at:=end_at+make_interval(mins=>p.minutes_after); end if;
   -- 10 minute catch-up window makes a 5-minute scheduler resilient to brief delay.
   if now() < target_at or now() >= target_at + interval '10 minutes' then continue; end if;
   if p.event_type='attendance_pending' and exists(select 1 from public.class_attendance ca where ca.schedule_event_id=e.id) then continue; end if;
   if p.recipient_role='trainer' then
    insert into public.portal_notifications(recipient_role,trainer_id,student_id,type,priority,title,message,href,dedupe_key)
    values('trainer',e.trainer_id,e.student_id,case when p.event_type='class' then 'class_reminder' else 'attendance_update_pending' end,
      case when p.event_type='class' then 'info' else 'action' end,
      case when p.event_type='class' then 'Upcoming class' else 'Class update pending' end,
      case when p.event_type='class' then e.title||' starts in '||p.minutes_before||' minutes.' else e.title||' ended '||p.minutes_after||' minutes ago. Please record attendance and learning updates.' end,
      '/trainer/classes',e.id::text||':'||p.id)
    on conflict(dedupe_key) where dedupe_key is not null do nothing;
    get diagnostics rc = row_count; inserted_count := inserted_count + rc;
   elsif p.recipient_role in ('parent','student') and p.event_type='class' then
    for sid in
      select distinct x.student_id from (
        select e.student_id as student_id where e.student_id is not null
        union all
        select en.student_id from public.enrollments en where e.cohort_id is not null and en.cohort_id=e.cohort_id and en.status='active'
      ) x where x.student_id is not null
    loop
      insert into public.portal_notifications(recipient_role,student_id,trainer_id,type,priority,title,message,href,dedupe_key)
      values(p.recipient_role,sid,e.trainer_id,'class_reminder','info','Class reminder',
        'Your Robotronix™ class starts in '||p.minutes_before||' minutes.',case when p.recipient_role='parent' then '/parent' else '/student' end,
        e.id::text||':'||p.id||':'||sid::text)
      on conflict(dedupe_key) where dedupe_key is not null do nothing;
      get diagnostics rc = row_count; inserted_count := inserted_count + rc;
    end loop;
   end if;
  end loop;
 end loop;
 return jsonb_build_object('ok',true,'processed_at',now(),'inserted',inserted_count);
end $$;
revoke all on function public.process_class_reminders() from public, anon, authenticated;
grant execute on function public.process_class_reminders() to service_role;

-- Safe-delete protection at DB level. Core/history records should be archived/deactivated rather than destroyed.
create or replace function public.guard_course_delete() returns trigger language plpgsql as $$begin
 if exists(select 1 from public.enrollments where course_id=old.id) or exists(select 1 from public.cohorts where course_id=old.id) or exists(select 1 from public.schedule_events where course_id=old.id) or exists(select 1 from public.trainer_courses where course_id=old.id) or exists(select 1 from public.learner_projects where course_id=old.id) then raise exception 'Course/program has operational or historical references. Archive it instead.'; end if; return old; end$$;
drop trigger if exists guard_course_delete_trg on public.courses;create trigger guard_course_delete_trg before delete on public.courses for each row execute function public.guard_course_delete();

create or replace function public.guard_trainer_delete() returns trigger language plpgsql as $$begin
 if exists(select 1 from public.enrollments where trainer_id=old.id) or exists(select 1 from public.cohorts where trainer_id=old.id) or exists(select 1 from public.schedule_events where trainer_id=old.id) or exists(select 1 from public.trainer_feedback where trainer_id=old.id) or exists(select 1 from public.learning_observations where trainer_id=old.id) or exists(select 1 from public.trainer_finance where trainer_id=old.id) then raise exception 'Trainer has operational or historical references. Deactivate/offboard instead.'; end if; return old; end$$;
drop trigger if exists guard_trainer_delete_trg on public.trainers;create trigger guard_trainer_delete_trg before delete on public.trainers for each row execute function public.guard_trainer_delete();

create or replace function public.guard_student_delete() returns trigger language plpgsql as $$begin
 if exists(select 1 from public.enrollments where student_id=old.id) or exists(select 1 from public.schedule_events where student_id=old.id) or exists(select 1 from public.class_attendance where student_id=old.id) or exists(select 1 from public.learner_projects where student_id=old.id) or exists(select 1 from public.trainer_feedback where student_id=old.id) then raise exception 'Learner has history. Archive the learner instead.'; end if; return old; end$$;
drop trigger if exists guard_student_delete_trg on public.students;create trigger guard_student_delete_trg before delete on public.students for each row execute function public.guard_student_delete();

create or replace function public.guard_enrollment_delete() returns trigger language plpgsql as $$begin
 if exists(select 1 from public.schedule_events where enrollment_id=old.id) or exists(select 1 from public.class_attendance where enrollment_id=old.id) or exists(select 1 from public.learning_observations where enrollment_id=old.id) or exists(select 1 from public.trainer_feedback where enrollment_id=old.id) or exists(select 1 from public.learner_projects where enrollment_id=old.id) or exists(select 1 from public.enrollment_holds where enrollment_id=old.id) then raise exception 'Enrollment has learning/history records. Complete, cancel or archive it instead.'; end if; return old; end$$;
drop trigger if exists guard_enrollment_delete_trg on public.enrollments;create trigger guard_enrollment_delete_trg before delete on public.enrollments for each row execute function public.guard_enrollment_delete();

create or replace function public.guard_cohort_delete() returns trigger language plpgsql as $$begin
 if exists(select 1 from public.enrollments where cohort_id=old.id) or exists(select 1 from public.schedule_events where cohort_id=old.id) then raise exception 'Cohort has learner/class history. Archive or complete it instead.'; end if; return old; end$$;
drop trigger if exists guard_cohort_delete_trg on public.cohorts;create trigger guard_cohort_delete_trg before delete on public.cohorts for each row execute function public.guard_cohort_delete();

create or replace function public.guard_schedule_delete() returns trigger language plpgsql as $$begin
 if exists(select 1 from public.class_attendance where schedule_event_id=old.id) or exists(select 1 from public.learning_observations where schedule_event_id=old.id) then raise exception 'Class has attendance/progress history. Cancel/reschedule it instead of deleting.'; end if; return old; end$$;
drop trigger if exists guard_schedule_delete_trg on public.schedule_events;create trigger guard_schedule_delete_trg before delete on public.schedule_events for each row execute function public.guard_schedule_delete();

-- Minimal audit trail for consequential operational/finance changes.
create table if not exists public.portal_audit_log(
 id bigint generated always as identity primary key, actor_profile_id uuid, entity_type text not null, entity_id text not null,
 action text not null, before_data jsonb, after_data jsonb, created_at timestamptz not null default now()
);
alter table public.portal_audit_log enable row level security;
drop policy if exists audit_admin_select on public.portal_audit_log;create policy audit_admin_select on public.portal_audit_log for select using(public.is_admin());
create or replace function public.audit_core_change()
returns trigger language plpgsql security definer set search_path=public as $$
declare
 row_data jsonb;
 eid text;
begin
 row_data:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 eid:=coalesce(
   row_data->>'id',
   case when row_data ? 'parent_id' and row_data ? 'student_id' then (row_data->>'parent_id')||':'||(row_data->>'student_id') end,
   case when row_data ? 'trainer_id' and row_data ? 'course_id' then (row_data->>'trainer_id')||':'||(row_data->>'course_id') end,
   case when row_data ? 'target_type' and row_data ? 'target_id' then (row_data->>'target_type')||':'||(row_data->>'target_id') end,
   row_data->>'student_id', row_data->>'enrollment_id', row_data->>'schedule_event_id',
   row_data->>'trainer_id', row_data->>'course_id', row_data->>'target_id', md5(row_data::text)
 );
 insert into public.portal_audit_log(actor_profile_id,entity_type,entity_id,action,before_data,after_data)
 values(auth.uid(),tg_table_name,eid,tg_op,case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end);
 if tg_op='DELETE' then return old; else return new; end if;
end$$;
do $$declare t text;begin foreach t in array array['courses','trainers','students','student_guardians','parent_students','enrollments','cohorts','onboarding_submissions','schedule_events','class_attendance','learning_observations','learning_observation_internal_notes','trainer_feedback','learner_projects','enrollment_holds','trainer_availability','trainer_availability_overrides','trainer_finance','trainer_compensation_plans','trainer_earnings','trainer_payouts','student_fee_packages','student_fee_payments','correction_requests'] loop if to_regclass('public.'||t) is not null then execute format('drop trigger if exists audit_%I on public.%I',t,t);execute format('create trigger audit_%I after insert or update or delete on public.%I for each row execute function public.audit_core_change()',t,t);end if;end loop;end$$;

-- Trainer Payroll / Class Earnings — class delivery is the source of truth.

create table if not exists public.trainer_compensation_plans(
 id uuid primary key default gen_random_uuid(),
 trainer_id uuid not null references public.trainers(id) on delete restrict,
 timezone text not null default 'Asia/Kolkata',
 day_start time not null default '08:00', day_end time not null default '22:00',
 one_to_one_day numeric(12,2) not null default 300, one_to_one_night numeric(12,2) not null default 400,
 group_day numeric(12,2) not null default 350, group_night numeric(12,2) not null default 450,
 demo_day numeric(12,2) not null default 80, demo_night numeric(12,2) not null default 100,
 demo_conversion_day numeric(12,2) not null default 50, demo_conversion_night numeric(12,2) not null default 100,
 no_show_percent numeric(5,2) not null default 0 check(no_show_percent between 0 and 100),
 cancelled_percent numeric(5,2) not null default 0 check(cancelled_percent between 0 and 100),
 effective_from date not null default current_date,
 notes text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(trainer_id,effective_from)
);

create table if not exists public.trainer_earnings(
 id uuid primary key default gen_random_uuid(),
 trainer_id uuid not null references public.trainers(id) on delete restrict,
 schedule_event_id uuid not null unique references public.schedule_events(id) on delete restrict,
 earning_date date not null,
 session_type text not null check(session_type in ('one_to_one','small_group','demo','school','workshop','other')),
 pay_band text not null check(pay_band in ('day','night')),
 duration_minutes int not null default 60 check(duration_minutes > 0), learner_count int not null default 1 check(learner_count >= 0),
 class_outcome text not null check(class_outcome in ('completed','no_show','cancelled')),
 base_rate numeric(12,2) not null default 0, duration_factor numeric(8,4) not null default 1,
 conversion_bonus numeric(12,2) not null default 0, adjustment numeric(12,2) not null default 0,
 total_amount numeric(12,2) not null default 0, conversion_applied boolean not null default false,
 status text not null default 'pending' check(status in ('pending','approved','paid','void')),
 adjustment_reason text, notes text, approved_at timestamptz, paid_at timestamptz, payment_reference text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists trainer_earnings_trainer_date_idx on public.trainer_earnings(trainer_id,earning_date desc);

create table if not exists public.trainer_payouts(
 id uuid primary key default gen_random_uuid(), trainer_id uuid not null references public.trainers(id) on delete restrict,
 period_month text not null check(period_month ~ '^[0-9]{4}-[0-9]{2}$'),
 gross_amount numeric(12,2) not null default 0, adjustment_amount numeric(12,2) not null default 0, payable_amount numeric(12,2) not null default 0,
 status text not null default 'draft' check(status in ('draft','approved','paid')),
 approved_at timestamptz, paid_at timestamptz, payment_reference text, notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(trainer_id,period_month)
);

alter table public.trainer_compensation_plans enable row level security;
alter table public.trainer_earnings enable row level security;
alter table public.trainer_payouts enable row level security;

drop policy if exists trainer_comp_plans_admin_all on public.trainer_compensation_plans;
create policy trainer_comp_plans_admin_all on public.trainer_compensation_plans for all using(public.is_admin()) with check(public.is_admin());
drop policy if exists trainer_comp_plans_trainer_select on public.trainer_compensation_plans;
create policy trainer_comp_plans_trainer_select on public.trainer_compensation_plans for select using(trainer_id=public.current_trainer_id());

drop policy if exists trainer_earnings_admin_all on public.trainer_earnings;
create policy trainer_earnings_admin_all on public.trainer_earnings for all using(public.is_admin()) with check(public.is_admin());
drop policy if exists trainer_earnings_trainer_select on public.trainer_earnings;
create policy trainer_earnings_trainer_select on public.trainer_earnings for select using(trainer_id=public.current_trainer_id());

drop policy if exists trainer_payouts_admin_all on public.trainer_payouts;
create policy trainer_payouts_admin_all on public.trainer_payouts for all using(public.is_admin()) with check(public.is_admin());
drop policy if exists trainer_payouts_trainer_select on public.trainer_payouts;
create policy trainer_payouts_trainer_select on public.trainer_payouts for select using(trainer_id=public.current_trainer_id());

-- Defaults only if no plan exists. Admin can change each trainer independently.
insert into public.trainer_compensation_plans(trainer_id,effective_from)
select t.id,current_date from public.trainers t
where not exists(select 1 from public.trainer_compensation_plans p where p.trainer_id=t.id)
on conflict do nothing;

create or replace function public.sync_trainer_earning(p_event_id uuid,p_force boolean default false)
returns uuid language plpgsql security definer set search_path=public as $$
declare
 e public.schedule_events%rowtype; p public.trainer_compensation_plans%rowtype; olde public.trainer_earnings%rowtype;
 class_at timestamptz; end_at timestamptz; pay_local timestamp; band text; stype text; outcome text;
 att_total int:=0; present_count int:=0; learner_count int:=0; duration_mins int:=60;
 base numeric:=0; factor numeric:=1; pct numeric:=100; bonus numeric:=0; adj numeric:=0; total numeric:=0; result_id uuid;
begin
 select * into e from public.schedule_events where id=p_event_id;
 if not found then return null; end if;
 if e.event_type not in ('class','demo') then return null; end if;
 if not (public.is_admin() or e.trainer_id=public.current_trainer_id() or current_user in ('postgres','service_role')) then raise exception 'Not authorized to generate this earning.'; end if;
 select * into p from public.trainer_compensation_plans where trainer_id=e.trainer_id and effective_from<=e.date order by effective_from desc limit 1;
 if not found then
   insert into public.trainer_compensation_plans(trainer_id,effective_from) values(e.trainer_id,e.date) returning * into p;
 end if;
 select * into olde from public.trainer_earnings where schedule_event_id=e.id;
 if found and olde.status in ('approved','paid') and not p_force then return olde.id; end if;
 if e.status not in ('conducted','cancelled') then return coalesce(olde.id,null); end if;
 class_at := (e.date + e.start_time) at time zone e.timezone;
 end_at := (e.date + e.end_time) at time zone e.timezone;
 pay_local := class_at at time zone p.timezone;
 duration_mins := greatest(1,round(extract(epoch from (end_at-class_at))/60)::int);
 band := case when p.day_start<p.day_end and pay_local::time>=p.day_start and pay_local::time<p.day_end then 'day'
              when p.day_start>p.day_end and (pay_local::time>=p.day_start or pay_local::time<p.day_end) then 'day' else 'night' end;
 stype := case when e.event_type='demo' then 'demo' when e.event_type='school' then 'school' when e.event_type='workshop' then 'workshop'
               when e.cohort_id is not null or e.delivery_mode='small_group' then 'small_group' else 'one_to_one' end;
 select count(*),count(*) filter(where ca.status in ('attended','late')) into att_total,present_count from public.class_attendance ca where ca.schedule_event_id=e.id;
 if e.cohort_id is not null then select count(*) into learner_count from public.enrollments en where en.cohort_id=e.cohort_id and en.status<>'cancelled';
 else learner_count:=case when e.student_id is not null or e.enrollment_id is not null then 1 else att_total end; end if;
 if stype='demo' and learner_count=0 then learner_count:=1; end if;
 outcome := case when e.status='cancelled' then 'cancelled' when e.status='conducted' and stype<>'demo' and att_total>0 and present_count=0 then 'no_show' else 'completed' end;
 base := case when stype='one_to_one' and band='day' then p.one_to_one_day when stype='one_to_one' then p.one_to_one_night
              when stype='small_group' and band='day' then p.group_day when stype='small_group' then p.group_night
              when stype='demo' and band='day' then p.demo_day when stype='demo' then p.demo_night else 0 end;
 factor := case when stype='demo' then 1 else greatest(.25,duration_mins/60.0) end;
 pct := case when outcome='no_show' then p.no_show_percent when outcome='cancelled' then p.cancelled_percent else 100 end;
 if olde.id is not null then bonus:=case when olde.conversion_applied and stype='demo' then case when band='day' then p.demo_conversion_day else p.demo_conversion_night end else 0 end; adj:=olde.adjustment; end if;
 total:=greatest(0,round((base*factor*(pct/100.0)+bonus+adj)::numeric,2));
 insert into public.trainer_earnings(trainer_id,schedule_event_id,earning_date,session_type,pay_band,duration_minutes,learner_count,class_outcome,base_rate,duration_factor,conversion_bonus,adjustment,total_amount,conversion_applied,status,adjustment_reason,notes,approved_at,paid_at,payment_reference,updated_at)
 values(e.trainer_id,e.id,(pay_local::date),stype,band,duration_mins,learner_count,outcome,base,factor,bonus,coalesce(olde.adjustment,0),total,coalesce(olde.conversion_applied,false),case when e.status='cancelled' and p.cancelled_percent=0 then 'void' else coalesce(olde.status,'pending') end,olde.adjustment_reason,olde.notes,olde.approved_at,olde.paid_at,olde.payment_reference,now())
 on conflict(schedule_event_id) do update set trainer_id=excluded.trainer_id,earning_date=excluded.earning_date,session_type=excluded.session_type,pay_band=excluded.pay_band,duration_minutes=excluded.duration_minutes,learner_count=excluded.learner_count,class_outcome=excluded.class_outcome,base_rate=excluded.base_rate,duration_factor=excluded.duration_factor,conversion_bonus=excluded.conversion_bonus,total_amount=excluded.total_amount,status=case when public.trainer_earnings.status in ('approved','paid') and not p_force then public.trainer_earnings.status else excluded.status end,updated_at=now()
 returning id into result_id;
 return result_id;
end $$;
revoke all on function public.sync_trainer_earning(uuid,boolean) from public,anon;
grant execute on function public.sync_trainer_earning(uuid,boolean) to authenticated,service_role;

create or replace function public.trg_sync_trainer_earning() returns trigger language plpgsql security definer set search_path=public as $$begin
 if new.event_type in ('class','demo') and new.status in ('conducted','cancelled') then perform public.sync_trainer_earning(new.id,false); end if; return new; end$$;
drop trigger if exists sync_trainer_earning_on_event on public.schedule_events;
create trigger sync_trainer_earning_on_event after insert or update of status,date,start_time,end_time,timezone,trainer_id,delivery_mode,event_type on public.schedule_events for each row execute function public.trg_sync_trainer_earning();

create or replace function public.trg_sync_trainer_earning_from_attendance() returns trigger language plpgsql security definer set search_path=public as $$declare eid uuid;begin if tg_op='DELETE' then eid:=old.schedule_event_id; else eid:=new.schedule_event_id; end if;if exists(select 1 from public.schedule_events where id=eid and status='conducted') then perform public.sync_trainer_earning(eid,false);end if;if tg_op='DELETE' then return old; else return new; end if;end$$;
drop trigger if exists sync_trainer_earning_on_attendance on public.class_attendance;
create trigger sync_trainer_earning_on_attendance after insert or update or delete on public.class_attendance for each row execute function public.trg_sync_trainer_earning_from_attendance();

-- Include payroll records in delete protection and audit history.
create or replace function public.guard_trainer_delete() returns trigger language plpgsql as $$begin
 if exists(select 1 from public.enrollments where trainer_id=old.id) or exists(select 1 from public.cohorts where trainer_id=old.id) or exists(select 1 from public.schedule_events where trainer_id=old.id) or exists(select 1 from public.trainer_feedback where trainer_id=old.id) or exists(select 1 from public.learning_observations where trainer_id=old.id) or exists(select 1 from public.trainer_finance where trainer_id=old.id) or exists(select 1 from public.trainer_compensation_plans where trainer_id=old.id) or exists(select 1 from public.trainer_earnings where trainer_id=old.id) or exists(select 1 from public.trainer_payouts where trainer_id=old.id) then raise exception 'Trainer has operational, finance or historical references. Deactivate/offboard instead.'; end if; return old; end$$;

create or replace function public.guard_schedule_delete() returns trigger language plpgsql as $$begin
 if exists(select 1 from public.class_attendance where schedule_event_id=old.id) or exists(select 1 from public.learning_observations where schedule_event_id=old.id) or exists(select 1 from public.trainer_earnings where schedule_event_id=old.id) then raise exception 'Class has attendance, learning or payroll history. Cancel/reschedule it instead of deleting.'; end if; return old; end$$;

-- Update manual earning changes server-side so bonus/adjustment total stays correct.
create or replace function public.recalc_trainer_earning_manual() returns trigger language plpgsql as $$declare p public.trainer_compensation_plans%rowtype;begin
 if new.status='paid' and old.status='paid' then return new; end if;
 select * into p from public.trainer_compensation_plans where trainer_id=new.trainer_id and effective_from<=new.earning_date order by effective_from desc limit 1;
 new.conversion_bonus:=case when new.conversion_applied and new.session_type='demo' then case when new.pay_band='day' then p.demo_conversion_day else p.demo_conversion_night end else 0 end;
 new.total_amount:=greatest(0,round((new.base_rate*new.duration_factor*(case when new.class_outcome='no_show' then p.no_show_percent when new.class_outcome='cancelled' then p.cancelled_percent else 100 end)/100.0+new.conversion_bonus+new.adjustment)::numeric,2));
 new.updated_at:=now();return new;end$$;
drop trigger if exists recalc_trainer_earning_manual_trg on public.trainer_earnings;
create trigger recalc_trainer_earning_manual_trg before update of conversion_applied,adjustment,adjustment_reason on public.trainer_earnings for each row execute function public.recalc_trainer_earning_manual();

-- Audit payroll changes.
do $$declare t text;begin foreach t in array array['trainer_compensation_plans','trainer_earnings','trainer_payouts'] loop execute format('drop trigger if exists audit_%I on public.%I',t,t);execute format('create trigger audit_%I after insert or update or delete on public.%I for each row execute function public.audit_core_change()',t,t);end loop;end$$;

-- Final audit coverage for finance and operations tables.
do $$declare t text;begin foreach t in array array['profiles','parents','courses','trainers','trainer_courses','students','student_guardians','parent_students','enrollments','cohorts','onboarding_submissions','schedule_events','class_attendance','learning_observations','learning_observation_internal_notes','trainer_feedback','learner_projects','enrollment_holds','trainer_availability','trainer_availability_overrides','trainer_finance','trainer_compensation_plans','trainer_earnings','trainer_payouts','student_fee_packages','student_fee_payments','correction_requests'] loop if to_regclass('public.'||t) is not null then execute format('drop trigger if exists audit_%I on public.%I',t,t);execute format('create trigger audit_%I after insert or update or delete on public.%I for each row execute function public.audit_core_change()',t,t);end if;end loop;end$$;
revoke insert,update,delete on public.portal_audit_log from anon,authenticated;
-- Portal access controls. Never expose service-role credentials in client bundles.
alter table public.trainers add column if not exists country text not null default 'India';
alter table public.trainers add column if not exists state text not null default '';
alter table public.trainers add column if not exists timezone text not null default 'Asia/Kolkata';

create table if not exists public.portal_access_requests (
 target_type text not null check(target_type in ('trainer','student')),
 target_id uuid not null,
 login_email text not null,
 status text not null check(status in ('invited','linked','disabled')),
 invited_at timestamptz,
 updated_at timestamptz not null default now(),
 last_actor_id uuid references public.profiles(id) on delete set null,
 primary key(target_type,target_id)
);
alter table public.portal_access_requests enable row level security;
-- Only admins may read these records from ordinary clients; write operations are server-only using service role.
drop policy if exists portal_access_requests_admin_read on public.portal_access_requests;
create policy portal_access_requests_admin_read on public.portal_access_requests for select using(public.is_admin());
-- Block disabled users in role-derived RLS checks as well as in the UI's RoleGuard.
create or replace function public.current_role() returns text language sql stable security definer set search_path=public as $$
 select role from public.profiles where id=auth.uid() and active=true
$$;
create or replace function public.current_parent_id() returns uuid language sql stable security definer set search_path=public as $$
 select pa.id from public.parents pa join public.profiles p on p.id=pa.profile_id where pa.profile_id=auth.uid() and p.active=true
$$;
create or replace function public.current_trainer_id() returns uuid language sql stable security definer set search_path=public as $$
 select t.id from public.trainers t join public.profiles p on p.id=t.profile_id where t.profile_id=auth.uid() and p.active=true
$$;
-- Operations simplification and delivery-center model.

alter table public.courses add column if not exists default_cohort_capacity integer not null default 4;
alter table public.courses add column if not exists minimum_cohort_size integer not null default 2;
alter table public.cohorts add column if not exists minimum_start_size integer not null default 2;
alter table public.cohorts alter column capacity set default 4;

-- Reusable offline/partner delivery locations. Existing enrollments/cohorts continue to keep center_location text.
create table if not exists public.delivery_centers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  center_type text not null default 'Other',
  area text,
  city text not null default '',
  state text,
  country text not null default 'India',
  address text not null default '',
  contact_person text,
  contact_number text,
  capacity integer,
  notes text,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint delivery_centers_capacity_positive check (capacity is null or capacity > 0)
);

alter table public.delivery_centers enable row level security;
drop policy if exists delivery_centers_admin_all on public.delivery_centers;
create policy delivery_centers_admin_all on public.delivery_centers for all using(public.is_admin()) with check(public.is_admin());

create index if not exists delivery_centers_name_idx on public.delivery_centers(lower(name));
create index if not exists delivery_centers_city_idx on public.delivery_centers(lower(city));


-- ============================================================
-- Non-recursive Student / Enrollment RLS
-- ============================================================
-- Robotronix Learning Portal — Production V1
-- Student / Enrollment relationship-aware RLS
-- Fixes: ERROR: infinite recursion detected in policy for relation "students"
--
-- Safe for the existing Production V1 database.
-- Run once in Supabase SQL Editor.

begin;

-- These helpers run as the function owner and therefore can inspect relationship
-- tables without recursively re-entering their RLS policies.
create or replace function public.is_own_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.students s
    where s.id = p_student_id
      and s.profile_id = auth.uid()
  )
$$;

create or replace function public.is_parent_of_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.parent_students ps
    join public.parents p on p.id = ps.parent_id
    where ps.student_id = p_student_id
      and p.profile_id = auth.uid()
  )
$$;

create or replace function public.is_trainer_of_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.enrollments e
    join public.trainers t on t.id = e.trainer_id
    where e.student_id = p_student_id
      and t.profile_id = auth.uid()
  )
$$;

create or replace function public.can_read_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select
    public.is_admin()
    or public.is_own_student(p_student_id)
    or public.is_parent_of_student(p_student_id)
    or public.is_trainer_of_student(p_student_id)
$$;

-- Replace the recursive students SELECT policy.
drop policy if exists students_select on public.students;
create policy students_select
on public.students
for select
using (
  public.can_read_student(id)
);

-- Replace the recursive enrollments SELECT policy.
drop policy if exists enrollments_select on public.enrollments;
create policy enrollments_select
on public.enrollments
for select
using (
  public.is_admin()
  or trainer_id = public.current_trainer_id()
  or public.is_own_student(student_id)
  or public.is_parent_of_student(student_id)
);

-- Also rewrite the most common student-linked policies so they use the same
-- non-recursive helper and cannot recreate the students <-> enrollments loop.
drop policy if exists attendance_select on public.class_attendance;
create policy attendance_select
on public.class_attendance
for select
using (
  public.can_read_student(student_id)
);

drop policy if exists learning_observations_select on public.learning_observations;
create policy learning_observations_select
on public.learning_observations
for select
using (
  public.can_read_student(student_id)
);

drop policy if exists trainer_feedback_select on public.trainer_feedback;
create policy trainer_feedback_select
on public.trainer_feedback
for select
using (
  public.can_read_student(student_id)
);

drop policy if exists learner_projects_select on public.learner_projects;
create policy learner_projects_select
on public.learner_projects
for select
using (
  public.can_read_student(student_id)
);

drop policy if exists enrollment_holds_select on public.enrollment_holds;
create policy enrollment_holds_select
on public.enrollment_holds
for select
using (
  public.can_read_student(student_id)
);

drop policy if exists session_records_select on public.session_records;
create policy session_records_select
on public.session_records
for select
using (
  public.can_read_student(student_id)
);

-- Schedule events can be linked directly to a student or indirectly to an enrollment.
drop policy if exists schedule_select on public.schedule_events;
create policy schedule_select
on public.schedule_events
for select
using (
  public.is_admin()
  or trainer_id = public.current_trainer_id()
  or (student_id is not null and public.can_read_student(student_id))
  or (
    enrollment_id is not null
    and exists(
      select 1
      from public.enrollments e
      where e.id = schedule_events.enrollment_id
        and (
          e.trainer_id = public.current_trainer_id()
          or public.is_own_student(e.student_id)
          or public.is_parent_of_student(e.student_id)
        )
    )
  )
);

commit;


-- ============================================================================
-- FINAL RELEASE CONSOLIDATION: actual instructional duration and earnings
-- ============================================================================
-- Planned vs verified actual instructional duration.
alter table if exists public.schedule_events add column if not exists actual_duration_minutes integer;
alter table if exists public.schedule_events drop constraint if exists actual_duration_half_hour_check;
alter table if exists public.schedule_events add constraint actual_duration_half_hour_check check(actual_duration_minutes is null or(actual_duration_minutes between 30 and 480 and actual_duration_minutes % 30=0));
comment on column public.schedule_events.actual_duration_minutes is 'Verified actual taught minutes on a conducted class; scheduled end time remains the original plan.';

create or replace function public.sync_trainer_earning(p_event_id uuid,p_force boolean default false)
returns uuid language plpgsql security definer set search_path=public as $$
declare
 e public.schedule_events%rowtype; p public.trainer_compensation_plans%rowtype; olde public.trainer_earnings%rowtype;
 class_at timestamptz; end_at timestamptz; pay_local timestamp; band text; stype text; outcome text;
 att_total int:=0; present_count int:=0; learner_count int:=0; duration_mins int:=60;
 base numeric:=0; factor numeric:=1; pct numeric:=100; bonus numeric:=0; adj numeric:=0; total numeric:=0; result_id uuid;
begin
 select * into e from public.schedule_events where id=p_event_id;
 if not found then return null; end if;
 if e.event_type not in ('class','demo') then return null; end if;
 if not (public.is_admin() or e.trainer_id=public.current_trainer_id() or current_user in ('postgres','service_role')) then raise exception 'Not authorized to generate this earning.'; end if;
 select * into p from public.trainer_compensation_plans where trainer_id=e.trainer_id and effective_from<=e.date order by effective_from desc limit 1;
 if not found then
   insert into public.trainer_compensation_plans(trainer_id,effective_from) values(e.trainer_id,e.date) returning * into p;
 end if;
 select * into olde from public.trainer_earnings where schedule_event_id=e.id;
 if found and olde.status in ('approved','paid') and not p_force then return olde.id; end if;
 if e.status not in ('conducted','cancelled') then return coalesce(olde.id,null); end if;
 class_at := (e.date + e.start_time) at time zone e.timezone;
 end_at := (e.date + e.end_time) at time zone e.timezone;
 pay_local := class_at at time zone p.timezone;
 duration_mins := case when e.status='conducted' and e.actual_duration_minutes is not null then e.actual_duration_minutes else greatest(1,round(extract(epoch from (end_at-class_at))/60)::int) end;
 band := case when p.day_start<p.day_end and pay_local::time>=p.day_start and pay_local::time<p.day_end then 'day'
              when p.day_start>p.day_end and (pay_local::time>=p.day_start or pay_local::time<p.day_end) then 'day' else 'night' end;
 stype := case when e.event_type='demo' then 'demo' when e.event_type='school' then 'school' when e.event_type='workshop' then 'workshop'
               when e.cohort_id is not null or e.delivery_mode='small_group' then 'small_group' else 'one_to_one' end;
 select count(*),count(*) filter(where ca.status in ('attended','late')) into att_total,present_count from public.class_attendance ca where ca.schedule_event_id=e.id;
 if e.cohort_id is not null then select count(*) into learner_count from public.enrollments en where en.cohort_id=e.cohort_id and en.status<>'cancelled';
 else learner_count:=case when e.student_id is not null or e.enrollment_id is not null then 1 else att_total end; end if;
 if stype='demo' and learner_count=0 then learner_count:=1; end if;
 outcome := case when e.status='cancelled' then 'cancelled' when e.status='conducted' and stype<>'demo' and att_total>0 and present_count=0 then 'no_show' else 'completed' end;
 base := case when stype='one_to_one' and band='day' then p.one_to_one_day when stype='one_to_one' then p.one_to_one_night
              when stype='small_group' and band='day' then p.group_day when stype='small_group' then p.group_night
              when stype='demo' and band='day' then p.demo_day when stype='demo' then p.demo_night else 0 end;
 factor := case when stype='demo' then 1 else greatest(.25,duration_mins/60.0) end;
 pct := case when outcome='no_show' then p.no_show_percent when outcome='cancelled' then p.cancelled_percent else 100 end;
 if olde.id is not null then bonus:=case when olde.conversion_applied and stype='demo' then case when band='day' then p.demo_conversion_day else p.demo_conversion_night end else 0 end; adj:=olde.adjustment; end if;
 total:=greatest(0,round((base*factor*(pct/100.0)+bonus+adj)::numeric,2));
 insert into public.trainer_earnings(trainer_id,schedule_event_id,earning_date,session_type,pay_band,duration_minutes,learner_count,class_outcome,base_rate,duration_factor,conversion_bonus,adjustment,total_amount,conversion_applied,status,adjustment_reason,notes,approved_at,paid_at,payment_reference,updated_at)
 values(e.trainer_id,e.id,(pay_local::date),stype,band,duration_mins,learner_count,outcome,base,factor,bonus,coalesce(olde.adjustment,0),total,coalesce(olde.conversion_applied,false),case when e.status='cancelled' and p.cancelled_percent=0 then 'void' else coalesce(olde.status,'pending') end,olde.adjustment_reason,olde.notes,olde.approved_at,olde.paid_at,olde.payment_reference,now())
 on conflict(schedule_event_id) do update set trainer_id=excluded.trainer_id,earning_date=excluded.earning_date,session_type=excluded.session_type,pay_band=excluded.pay_band,duration_minutes=excluded.duration_minutes,learner_count=excluded.learner_count,class_outcome=excluded.class_outcome,base_rate=excluded.base_rate,duration_factor=excluded.duration_factor,conversion_bonus=excluded.conversion_bonus,total_amount=excluded.total_amount,status=case when public.trainer_earnings.status in ('approved','paid') and not p_force then public.trainer_earnings.status else excluded.status end,updated_at=now()
 returning id into result_id;
 return result_id;
end $$;
revoke all on function public.sync_trainer_earning(uuid,boolean) from public,anon;
grant execute on function public.sync_trainer_earning(uuid,boolean) to authenticated,service_role;

-- Sync earnings when an approved actual duration is recorded. Approved/paid entries remain locked by existing function.
drop trigger if exists sync_trainer_earning_on_event on public.schedule_events;
create trigger sync_trainer_earning_on_event after insert or update of status,date,start_time,end_time,timezone,trainer_id,delivery_mode,event_type,actual_duration_minutes on public.schedule_events for each row execute function public.trg_sync_trainer_earning();

-- Server-side safety for genuinely NEW enrollments. Historical records remain unchanged on edit.
create or replace function public.enforce_new_enrollment_start_date()
returns trigger language plpgsql as $$
begin
 -- Native/new enrollments cannot be backdated. Existing active learners that
 -- are being migrated into the portal may retain their true historical start date.
 if coalesce(new.migration_type, 'native') <> 'active_existing'
    and new.started_at < (now() at time zone 'Asia/Kolkata')::date then
  raise exception 'Enrollment start date cannot be earlier than today (IST).';
 end if;
 return new;
end $$;
drop trigger if exists validate_new_enrollment_start_date on public.enrollments;
create trigger validate_new_enrollment_start_date before insert on public.enrollments
for each row execute function public.enforce_new_enrollment_start_date();

-- ============================================================================
-- FINAL RELEASE CONSOLIDATION: protected operations / correction requests
-- ============================================================================
-- Robotronix Learning Portal — Production V1
-- Fixes /admin/audit 404s caused by missing correction_requests and restores
-- the protected-operation guards that belong in the Production V1 baseline.
--
-- Safe for the existing Production V1 Supabase database.
-- Run once in Supabase SQL Editor.

begin;

-- ============================================================
-- 1) CORRECTION REQUESTS
-- ============================================================

create table if not exists public.correction_requests(
  id uuid primary key default gen_random_uuid(),
  requested_by_profile_id uuid references public.profiles(id) on delete set null default auth.uid(),
  requested_by_role text not null check(requested_by_role in ('student','parent','trainer','admin')),
  entity_type text not null,
  entity_id text not null,
  reason text not null check(length(trim(reason)) > 0),
  requested_changes text not null check(length(trim(requested_changes)) > 0),
  status text not null default 'open' check(status in ('open','approved','rejected','completed')),
  admin_note text,
  resolved_at timestamptz,
  resolved_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists correction_requests_entity_idx
  on public.correction_requests(entity_type,entity_id,created_at desc);

create index if not exists correction_requests_status_idx
  on public.correction_requests(status,created_at desc);

alter table public.correction_requests enable row level security;

drop policy if exists correction_requests_admin_all on public.correction_requests;
create policy correction_requests_admin_all
on public.correction_requests
for all
using(public.is_admin())
with check(public.is_admin());

drop policy if exists correction_requests_own_select on public.correction_requests;
create policy correction_requests_own_select
on public.correction_requests
for select
using(requested_by_profile_id = auth.uid());

drop policy if exists correction_requests_trainer_insert on public.correction_requests;
create policy correction_requests_trainer_insert
on public.correction_requests
for insert
with check(
  requested_by_profile_id = auth.uid()
  and requested_by_role = public.current_role()
  and (
    public.current_role() = 'admin'
    or (
      public.current_role() = 'trainer'
      and entity_type = 'schedule_event'
      and exists(
        select 1
        from public.schedule_events se
        where se.id::text = entity_id
          and se.trainer_id = public.current_trainer_id()
      )
    )
  )
);

create or replace function public.resolve_correction_request_fields()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if tg_op = 'UPDATE' then
    new.updated_at := now();

    if new.status is distinct from old.status and new.status <> 'open' then
      new.resolved_at := coalesce(new.resolved_at, now());
      new.resolved_by_profile_id :=
        coalesce(new.resolved_by_profile_id, auth.uid());
    end if;
  end if;

  return new;
end
$$;

drop trigger if exists correction_request_fields_trg
on public.correction_requests;

create trigger correction_request_fields_trg
before update on public.correction_requests
for each row execute function public.resolve_correction_request_fields();

-- Use the composite-key-safe audit function defined above.
drop trigger if exists audit_correction_requests
on public.correction_requests;

create trigger audit_correction_requests
after insert or update or delete on public.correction_requests
for each row execute function public.audit_core_change();

-- ============================================================
-- 2) PAID PAYROLL PROTECTION
-- ============================================================

create or replace function public.guard_paid_trainer_earning()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if old.status = 'paid' then
    raise exception
      'Paid earning records are locked. Create a correction and separate adjustment.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end
$$;

drop trigger if exists guard_paid_trainer_earning_trg
on public.trainer_earnings;

create trigger guard_paid_trainer_earning_trg
before update or delete on public.trainer_earnings
for each row execute function public.guard_paid_trainer_earning();

create or replace function public.guard_paid_trainer_payout()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if old.status = 'paid' then
    raise exception
      'Paid payouts are locked. Record a new correction or adjustment.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end
$$;

drop trigger if exists guard_paid_trainer_payout_trg
on public.trainer_payouts;

create trigger guard_paid_trainer_payout_trg
before update or delete on public.trainer_payouts
for each row execute function public.guard_paid_trainer_payout();

-- ============================================================
-- 3) CLASS / ATTENDANCE SOURCE PROTECTION
-- ============================================================

create or replace function public.guard_paid_class_source()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if exists(
    select 1
    from public.trainer_earnings te
    where te.schedule_event_id = old.id
      and te.status = 'paid'
  ) then
    raise exception 'This class is linked to paid payroll and is locked.';
  end if;

  if public.current_role() = 'trainer'
     and tg_op = 'UPDATE'
     and (
       new.trainer_id is distinct from old.trainer_id
       or new.course_id is distinct from old.course_id
       or new.enrollment_id is distinct from old.enrollment_id
       or new.cohort_id is distinct from old.cohort_id
       or new.student_id is distinct from old.student_id
       or new.date is distinct from old.date
       or new.start_time is distinct from old.start_time
       or new.end_time is distinct from old.end_time
       or new.timezone is distinct from old.timezone
       or new.delivery_mode is distinct from old.delivery_mode
       or new.occurrence_kind is distinct from old.occurrence_kind
       or new.original_event_id is distinct from old.original_event_id
       or new.rescheduled_to_id is distinct from old.rescheduled_to_id
     )
  then
    raise exception
      'Trainer cannot edit schedule, assignment or relationship fields. Submit a correction request.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end
$$;

drop trigger if exists guard_paid_class_source_trg
on public.schedule_events;

create trigger guard_paid_class_source_trg
before update or delete on public.schedule_events
for each row execute function public.guard_paid_class_source();

create or replace function public.guard_paid_attendance_source()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  event_id uuid;
begin
  event_id :=
    case
      when tg_op = 'DELETE' then old.schedule_event_id
      else new.schedule_event_id
    end;

  if exists(
    select 1
    from public.trainer_earnings te
    where te.schedule_event_id = event_id
      and te.status = 'paid'
  ) then
    raise exception 'Attendance is linked to paid payroll and is locked.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end
$$;

drop trigger if exists guard_paid_attendance_source_trg
on public.class_attendance;

create trigger guard_paid_attendance_source_trg
before insert or update or delete on public.class_attendance
for each row execute function public.guard_paid_attendance_source();

commit;

-- ============================================================================
-- FINAL RELEASE CONSOLIDATION: student finance schema
-- ============================================================================
-- Robotronix Learning Portal — Production V1
-- Student Finance schema
--
-- Fixes /admin/finance 404s:
--   student_fee_packages
--   student_fee_payments
--
-- The application already depends on these tables, but they were accidentally
-- omitted from the consolidated Production V1 baseline.
--
-- Safe for the current Production V1 database.

begin;

create extension if not exists btree_gist;

create table if not exists public.student_fee_packages (
  id uuid primary key,
  enrollment_id uuid not null references public.enrollments(id) on delete restrict,
  name text not null check(length(trim(name)) > 0),
  scheme text not null check(scheme in ('Monthly','2 Months','Full Course','Custom')),
  currency text not null check(currency in ('INR','USD','AED','GBP','EUR')),
  amount numeric(12,2) not null check(amount > 0),
  sessions integer not null check(sessions > 0),
  start_date date not null,
  end_date date not null check(end_date >= start_date),
  installments jsonb not null,
  source text not null default 'portal' check(source in ('portal','migration')),
  notes text not null default '',
  created_at timestamptz not null default now()
);

-- Add the no-overlap package rule only if it does not already exist.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.student_fee_packages'::regclass
      and contype = 'x'
  ) then
    alter table public.student_fee_packages
      add constraint student_fee_packages_enrollment_period_excl
      exclude using gist (
        enrollment_id with =,
        daterange(start_date,end_date,'[]') with &&
      );
  end if;
end
$$;

create table if not exists public.student_fee_payments (
  id uuid primary key,
  package_id uuid not null references public.student_fee_packages(id) on delete restrict,
  amount numeric(12,2) not null check(amount > 0),
  payment_date date not null,
  method text not null,
  reference text not null check(length(trim(reference)) > 0),
  kind text not null check(kind in ('payment','refund')),
  source text not null default 'portal' check(source in ('portal','migration')),
  created_at timestamptz not null default now(),
  unique(package_id, reference)
);

alter table public.student_fee_packages enable row level security;
alter table public.student_fee_payments enable row level security;

drop policy if exists fees_admin_read on public.student_fee_packages;
create policy fees_admin_read
on public.student_fee_packages
for select to authenticated
using(public.is_admin());

drop policy if exists fees_admin_create on public.student_fee_packages;
create policy fees_admin_create
on public.student_fee_packages
for insert to authenticated
with check(public.is_admin());

drop policy if exists payments_admin_read on public.student_fee_payments;
create policy payments_admin_read
on public.student_fee_payments
for select to authenticated
using(public.is_admin());

drop policy if exists payments_admin_create on public.student_fee_payments;
create policy payments_admin_create
on public.student_fee_payments
for insert to authenticated
with check(public.is_admin());

create or replace function public.validate_fee_package()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  total numeric;
  invalid_count integer;
begin
  if jsonb_typeof(new.installments) <> 'array'
     or jsonb_array_length(new.installments) = 0
  then
    raise exception 'Instalments required';
  end if;

  select
    sum((i->>'amount')::numeric),
    count(*) filter (
      where (i->>'amount')::numeric <= 0
         or (i->>'amount') is null
         or (i->>'due') is null
         or (i->>'due')::date is null
    )
  into total, invalid_count
  from jsonb_array_elements(new.installments) i;

  if invalid_count > 0 or total is distinct from new.amount then
    raise exception 'Instalments must total package amount';
  end if;

  return new;
end
$$;

drop trigger if exists fee_package_validate on public.student_fee_packages;
create trigger fee_package_validate
before insert on public.student_fee_packages
for each row execute function public.validate_fee_package();

create or replace function public.validate_fee_refund()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  net numeric;
begin
  if new.payment_date > (now() at time zone 'Asia/Kolkata')::date then
    raise exception 'Payment date cannot be in the future';
  end if;

  perform 1
  from public.student_fee_packages
  where id = new.package_id
  for update;

  select coalesce(
    sum(case when kind='refund' then -amount else amount end),
    0
  )
  into net
  from public.student_fee_payments
  where package_id = new.package_id;

  if new.kind = 'refund' and new.amount > net then
    raise exception 'Refund exceeds net receipts';
  end if;

  return new;
end
$$;

drop trigger if exists fee_refund_validate on public.student_fee_payments;
create trigger fee_refund_validate
before insert on public.student_fee_payments
for each row execute function public.validate_fee_refund();

-- Add the already-hardened generic audit trigger to the newly restored tables.
drop trigger if exists audit_student_fee_packages on public.student_fee_packages;
create trigger audit_student_fee_packages
after insert or update or delete on public.student_fee_packages
for each row execute function public.audit_core_change();

drop trigger if exists audit_student_fee_payments on public.student_fee_payments;
create trigger audit_student_fee_payments
after insert or update or delete on public.student_fee_payments
for each row execute function public.audit_core_change();

commit;

-- ============================================================================
-- FINAL RELEASE CONSOLIDATION: course/trainer RLS relationship helpers
-- ============================================================================
-- Robotronix Learning Portal — Production V1
-- Course + Trainer RLS for Parent/Student learner experience
--
-- Symptom:
-- QA Parent can read parent_students, students and enrollments, but linked
-- courses/trainers return 0 rows. Parent learner detail therefore cannot
-- construct the course snapshot.
--
-- This replaces nested RLS-dependent relationship checks with small
-- SECURITY DEFINER helpers. It preserves the intended access model:
--   Admin   -> all
--   Trainer -> self + assigned courses
--   Student -> course/trainer from own enrollments
--   Parent  -> course/trainer from linked learner enrollments
--
-- Run once in Supabase SQL Editor.

begin;

-- ------------------------------------------------------------
-- COURSE RELATIONSHIP HELPERS
-- ------------------------------------------------------------

create or replace function public.is_student_enrolled_in_course(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.enrollments e
    join public.students s on s.id = e.student_id
    join public.profiles p on p.id = s.profile_id
    where e.course_id = p_course_id
      and s.profile_id = auth.uid()
      and p.active = true
      and e.status <> 'cancelled'
  )
$$;

create or replace function public.is_parent_linked_to_course(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.enrollments e
    join public.parent_students ps on ps.student_id = e.student_id
    join public.parents pa on pa.id = ps.parent_id
    join public.profiles p on p.id = pa.profile_id
    where e.course_id = p_course_id
      and pa.profile_id = auth.uid()
      and p.active = true
      and e.status <> 'cancelled'
  )
$$;

create or replace function public.is_trainer_assigned_to_course(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.trainer_courses tc
    join public.trainers t on t.id = tc.trainer_id
    join public.profiles p on p.id = t.profile_id
    where tc.course_id = p_course_id
      and t.profile_id = auth.uid()
      and p.active = true
  )
$$;

create or replace function public.can_read_course(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select
    public.is_admin()
    or public.is_trainer_assigned_to_course(p_course_id)
    or public.is_student_enrolled_in_course(p_course_id)
    or public.is_parent_linked_to_course(p_course_id)
$$;

drop policy if exists courses_select on public.courses;

create policy courses_select
on public.courses
for select
using (
  public.can_read_course(id)
);

-- ------------------------------------------------------------
-- TRAINER RELATIONSHIP HELPERS
-- ------------------------------------------------------------

create or replace function public.is_student_linked_to_trainer(p_trainer_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.enrollments e
    join public.students s on s.id = e.student_id
    join public.profiles p on p.id = s.profile_id
    where e.trainer_id = p_trainer_id
      and s.profile_id = auth.uid()
      and p.active = true
      and e.status <> 'cancelled'
  )
$$;

create or replace function public.is_parent_linked_to_trainer(p_trainer_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.enrollments e
    join public.parent_students ps on ps.student_id = e.student_id
    join public.parents pa on pa.id = ps.parent_id
    join public.profiles p on p.id = pa.profile_id
    where e.trainer_id = p_trainer_id
      and pa.profile_id = auth.uid()
      and p.active = true
      and e.status <> 'cancelled'
  )
$$;

create or replace function public.can_read_trainer(p_trainer_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select
    public.is_admin()
    or p_trainer_id = public.current_trainer_id()
    or public.is_student_linked_to_trainer(p_trainer_id)
    or public.is_parent_linked_to_trainer(p_trainer_id)
$$;

drop policy if exists trainers_select on public.trainers;

create policy trainers_select
on public.trainers
for select
using (
  public.can_read_trainer(id)
);

commit;

-- ============================================================================
-- FINAL RELEASE VERIFICATION
-- ============================================================================
do $$
begin
  if to_regclass('public.profiles') is null then raise exception 'Missing profiles table'; end if;
  if to_regclass('public.students') is null then raise exception 'Missing students table'; end if;
  if to_regclass('public.enrollments') is null then raise exception 'Missing enrollments table'; end if;
  if to_regclass('public.schedule_events') is null then raise exception 'Missing schedule_events table'; end if;
  if to_regclass('public.trainer_earnings') is null then raise exception 'Missing trainer_earnings table'; end if;
  if to_regclass('public.student_fee_packages') is null then raise exception 'Missing student_fee_packages table'; end if;
  if to_regclass('public.student_fee_payments') is null then raise exception 'Missing student_fee_payments table'; end if;
  if to_regclass('public.correction_requests') is null then raise exception 'Missing correction_requests table'; end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='schedule_events' and column_name='actual_duration_minutes'
  ) then raise exception 'Missing schedule_events.actual_duration_minutes'; end if;
  if to_regprocedure('public.can_read_student(uuid)') is null then raise exception 'Missing can_read_student helper'; end if;
  if to_regprocedure('public.can_read_course(uuid)') is null then raise exception 'Missing can_read_course helper'; end if;
  if to_regprocedure('public.can_read_trainer(uuid)') is null then raise exception 'Missing can_read_trainer helper'; end if;
  if to_regprocedure('public.sync_trainer_earning(uuid,boolean)') is null then raise exception 'Missing trainer earning sync'; end if;
end
$$;

select 'Robotronix Production V1 database baseline installed successfully' as status, now() as installed_at;


-- ============================================================================
-- RAZORPAY + FAMILY BILLING/ADDRESS MODEL
-- ============================================================================

-- ============================================================
-- ROBOTRONIX™ RAZORPAY + FAMILY ADDRESS MIGRATION V2
-- File: 12_razorpay_invoice_module_v2.sql
--
-- PURPOSE
--   1) Collect a standard family/contact address for EVERY parent/family.
--   2) Reuse that address as the default billing address.
--   3) Allow a separate billing contact/address if needed.
--   4) Add invoice sequencing + invoice snapshot storage.
--   5) Keep invoice snapshots immutable even if the family later moves.
--
-- IMPORTANT
--   * This migration is additive/idempotent where possible.
--   * It does NOT delete existing data.
--   * It does NOT create Razorpay secrets in the database.
--   * Country/State/City continue to use the portal's API-driven location flow.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. STANDARD FAMILY / PARENT ADDRESS
-- ============================================================
-- This is the normal contact address for all families.
-- It is NOT Razorpay-specific.

CREATE TABLE IF NOT EXISTS public.parent_addresses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id uuid NOT NULL REFERENCES public.parents(id) ON DELETE CASCADE,

    address_label text NOT NULL DEFAULT 'Home',
    address_line1 text NOT NULL,
    address_line2 text,
    city text NOT NULL,
    state text,
    postal_code text NOT NULL,
    country text NOT NULL,
    country_code text,

    is_primary boolean NOT NULL DEFAULT true,
    is_active boolean NOT NULL DEFAULT true,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT parent_addresses_line1_nonempty
        CHECK (length(trim(address_line1)) > 0),
    CONSTRAINT parent_addresses_city_nonempty
        CHECK (length(trim(city)) > 0),
    CONSTRAINT parent_addresses_postal_nonempty
        CHECK (length(trim(postal_code)) > 0),
    CONSTRAINT parent_addresses_country_nonempty
        CHECK (length(trim(country)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_parent_addresses_parent_id
    ON public.parent_addresses(parent_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_parent_primary_address
    ON public.parent_addresses(parent_id)
    WHERE is_primary = true AND is_active = true;


-- ============================================================
-- 2. BILLING PROFILE
-- ============================================================
-- Usually "same as primary guardian + primary address".
-- If another person pays, use separate billing contact/address.

CREATE TABLE IF NOT EXISTS public.parent_billing_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id uuid NOT NULL UNIQUE REFERENCES public.parents(id) ON DELETE CASCADE,

    same_as_primary_guardian boolean NOT NULL DEFAULT true,
    same_as_primary_address boolean NOT NULL DEFAULT true,

    billing_name text,
    billing_email text,
    billing_phone text,

    billing_address_line1 text,
    billing_address_line2 text,
    billing_city text,
    billing_state text,
    billing_postal_code text,
    billing_country text,
    billing_country_code text,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parent_billing_profiles_parent_id
    ON public.parent_billing_profiles(parent_id);


-- ============================================================
-- 3. ONBOARDING FIELDS
-- ============================================================
-- Add standard address + billing-contact preferences to onboarding.
-- Existing country/state/city fields are reused if already present.

ALTER TABLE public.onboarding_submissions
    ADD COLUMN IF NOT EXISTS address_line1 text,
    ADD COLUMN IF NOT EXISTS address_line2 text,
    ADD COLUMN IF NOT EXISTS postal_code text,
    ADD COLUMN IF NOT EXISTS billing_same_as_primary_guardian boolean DEFAULT true,
    ADD COLUMN IF NOT EXISTS billing_same_as_primary_address boolean DEFAULT true,
    ADD COLUMN IF NOT EXISTS billing_name text,
    ADD COLUMN IF NOT EXISTS billing_email text,
    ADD COLUMN IF NOT EXISTS billing_phone text,
    ADD COLUMN IF NOT EXISTS billing_address_line1 text,
    ADD COLUMN IF NOT EXISTS billing_address_line2 text,
    ADD COLUMN IF NOT EXISTS billing_city text,
    ADD COLUMN IF NOT EXISTS billing_state text,
    ADD COLUMN IF NOT EXISTS billing_postal_code text,
    ADD COLUMN IF NOT EXISTS billing_country text,
    ADD COLUMN IF NOT EXISTS billing_country_code text;


-- ============================================================
-- 4. GUARDIAN SNAPSHOT FIELDS
-- ============================================================
-- Keep the contact/billing data available against the student's guardian record.
-- These are not the canonical family address table; parent_addresses remains canonical.

ALTER TABLE public.student_guardians
    ADD COLUMN IF NOT EXISTS address_line1 text,
    ADD COLUMN IF NOT EXISTS address_line2 text,
    ADD COLUMN IF NOT EXISTS postal_code text,
    ADD COLUMN IF NOT EXISTS billing_same_as_primary_guardian boolean DEFAULT true,
    ADD COLUMN IF NOT EXISTS billing_same_as_primary_address boolean DEFAULT true,
    ADD COLUMN IF NOT EXISTS billing_name text,
    ADD COLUMN IF NOT EXISTS billing_email text,
    ADD COLUMN IF NOT EXISTS billing_phone text,
    ADD COLUMN IF NOT EXISTS billing_address_line1 text,
    ADD COLUMN IF NOT EXISTS billing_address_line2 text,
    ADD COLUMN IF NOT EXISTS billing_city text,
    ADD COLUMN IF NOT EXISTS billing_state text,
    ADD COLUMN IF NOT EXISTS billing_postal_code text,
    ADD COLUMN IF NOT EXISTS billing_country text,
    ADD COLUMN IF NOT EXISTS billing_country_code text;


-- ============================================================
-- 5. INVOICE SEQUENCES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.invoice_sequences (
    financial_year text PRIMARY KEY,
    last_sequence integer NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT invoice_sequences_nonnegative CHECK (last_sequence >= 0)
);


-- ============================================================
-- 6. STUDENT INVOICES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.student_invoices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    invoice_number text NOT NULL UNIQUE,
    internal_reference text,

    student_id uuid REFERENCES public.students(id) ON DELETE RESTRICT,
    parent_id uuid REFERENCES public.parents(id) ON DELETE RESTRICT,
    enrollment_id uuid REFERENCES public.enrollments(id) ON DELETE SET NULL,
    fee_package_id uuid REFERENCES public.student_fee_packages(id) ON DELETE SET NULL,

    -- Razorpay
    razorpay_invoice_id text UNIQUE,
    razorpay_customer_id text,
    razorpay_short_url text,

    -- lifecycle
    status text NOT NULL DEFAULT 'draft',
    issue_date date NOT NULL DEFAULT CURRENT_DATE,
    due_date date NOT NULL,
    paid_at timestamptz,
    cancelled_at timestamptz,

    -- currency / valuation
    currency text NOT NULL,
    foreign_amount numeric(14,3) NOT NULL,
    fx_rate_to_inr numeric(18,6),
    fx_source text,
    fx_fetched_at timestamptz,
    invoice_value_inr numeric(14,2),

    -- tax/export snapshot
    supplier_name text NOT NULL DEFAULT 'Robotronix Tech Lab',
    supplier_gstin text NOT NULL DEFAULT '07AEIPA4473M1ZB',
    sac_code text NOT NULL DEFAULT '999293',
    purpose_code text NOT NULL DEFAULT 'P1107',
    igst_rate numeric(6,3) NOT NULL DEFAULT 0,
    igst_amount numeric(14,2) NOT NULL DEFAULT 0,
    cgst_sgst_applicable boolean NOT NULL DEFAULT false,
    reverse_charge boolean NOT NULL DEFAULT false,
    export_under_lut boolean NOT NULL DEFAULT true,
    export_declaration text NOT NULL DEFAULT
      'SUPPLY MEANT FOR EXPORT UNDER LETTER OF UNDERTAKING WITHOUT PAYMENT OF INTEGRATED TAX',
    place_of_supply text,
    country_of_destination text,

    -- immutable customer snapshot
    customer_name text NOT NULL,
    customer_email text,
    customer_phone text,
    billing_address_line1 text NOT NULL,
    billing_address_line2 text,
    billing_city text NOT NULL,
    billing_state text,
    billing_postal_code text NOT NULL,
    billing_country text NOT NULL,
    billing_country_code text,

    -- service snapshot
    service_title text NOT NULL,
    service_description text,
    session_count integer,
    delivery_mode text,
    terms_text text,

    -- Razorpay / audit snapshots
    razorpay_payload jsonb,
    razorpay_response jsonb,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT student_invoices_status_check
      CHECK (status IN (
        'draft',
        'reviewed',
        'issued',
        'partially_paid',
        'paid',
        'expired',
        'cancelled',
        'failed'
      )),
    CONSTRAINT student_invoices_foreign_amount_positive
      CHECK (foreign_amount > 0),
    CONSTRAINT student_invoices_due_after_issue
      CHECK (due_date >= issue_date)
);

CREATE INDEX IF NOT EXISTS idx_student_invoices_student_id
    ON public.student_invoices(student_id);

CREATE INDEX IF NOT EXISTS idx_student_invoices_parent_id
    ON public.student_invoices(parent_id);

CREATE INDEX IF NOT EXISTS idx_student_invoices_enrollment_id
    ON public.student_invoices(enrollment_id);

CREATE INDEX IF NOT EXISTS idx_student_invoices_status
    ON public.student_invoices(status);

CREATE INDEX IF NOT EXISTS idx_student_invoices_issue_date
    ON public.student_invoices(issue_date);


-- ============================================================
-- 7. INVOICE NUMBER GENERATOR
-- ============================================================
-- Format: RTX/26-27/0001
-- Financial year follows Indian FY: Apr-Mar.
-- Sequence is never reused.

CREATE OR REPLACE FUNCTION public.next_robotronix_invoice_number(
    p_issue_date date DEFAULT CURRENT_DATE
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
    v_start_year integer;
    v_end_year integer;
    v_fy text;
    v_seq integer;
BEGIN
    IF EXTRACT(MONTH FROM p_issue_date) >= 4 THEN
        v_start_year := EXTRACT(YEAR FROM p_issue_date)::integer;
    ELSE
        v_start_year := EXTRACT(YEAR FROM p_issue_date)::integer - 1;
    END IF;

    v_end_year := v_start_year + 1;

    v_fy :=
        right(v_start_year::text, 2)
        || '-'
        || right(v_end_year::text, 2);

    INSERT INTO public.invoice_sequences(financial_year, last_sequence)
    VALUES (v_fy, 1)
    ON CONFLICT (financial_year)
    DO UPDATE SET
        last_sequence = public.invoice_sequences.last_sequence + 1,
        updated_at = now()
    RETURNING last_sequence INTO v_seq;

    RETURN 'RTX/' || v_fy || '/' || lpad(v_seq::text, 4, '0');
END;
$$;


-- ============================================================
-- SHARED SYSTEM SETTINGS TABLE
-- Consolidated from 04_operations_final_v2.sql.
-- Must exist before invoice/enrollment/community settings are seeded.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value_text TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 8. SYSTEM SETTINGS FOR INVOICING
-- ============================================================
-- Store non-secret application behaviour here.
-- Razorpay Key ID/Secret/Webhook Secret remain in environment variables.

INSERT INTO public.system_settings(key, value_text, description)
VALUES
    ('invoice_provider', 'razorpay', 'Invoice provider for international parent invoices'),
    ('invoice_scope', 'international_only', 'Razorpay invoicing is used for international parents only'),
    ('invoice_default_due_days', '2', 'Default invoice due date offset in days'),
    ('invoice_admin_review_required', 'true', 'Admin must review invoice before Razorpay creation/sending'),
    ('invoice_auto_send', 'false', 'Do not automatically send Razorpay invoices'),
    ('invoice_default_sac', '999293', 'Default SAC code for Robotronix training services'),
    ('invoice_default_purpose_code', 'P1107', 'Default purpose code used for export service invoices'),
    ('invoice_export_under_lut', 'true', 'Export invoices are issued under LUT without payment of IGST'),
    ('invoice_export_igst_rate', '0', 'Default IGST rate for eligible export-under-LUT invoices'),
    ('invoice_number_prefix', 'RTX', 'Robotronix invoice number prefix')
ON CONFLICT (key)
DO UPDATE SET
    value_text = EXCLUDED.value_text,
    description = EXCLUDED.description,
    updated_at = NOW();


-- ============================================================
-- 9. PROTECT ISSUED/PAID INVOICES FROM DELETE
-- ============================================================

CREATE OR REPLACE FUNCTION public.guard_student_invoice_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public
AS $$
BEGIN
    IF OLD.status IN ('issued','partially_paid','paid','expired','cancelled') THEN
        RAISE EXCEPTION
          'Issued financial records must not be deleted. Cancel/retain the invoice instead.';
    END IF;

    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS guard_student_invoice_delete_trg
ON public.student_invoices;

CREATE TRIGGER guard_student_invoice_delete_trg
BEFORE DELETE ON public.student_invoices
FOR EACH ROW
EXECUTE FUNCTION public.guard_student_invoice_delete();


COMMIT;


-- ============================================================
-- QUICK VERIFICATION
-- ============================================================

SELECT
    to_regclass('public.parent_addresses') AS parent_addresses,
    to_regclass('public.parent_billing_profiles') AS parent_billing_profiles,
    to_regclass('public.invoice_sequences') AS invoice_sequences,
    to_regclass('public.student_invoices') AS student_invoices;

SELECT
    key,
    value_text,
    description
FROM public.system_settings
WHERE key LIKE 'invoice_%'
ORDER BY key;

SELECT public.next_robotronix_invoice_number(CURRENT_DATE) AS sample_invoice_number;
-- IMPORTANT:
-- The sample call above CONSUMES one invoice sequence number.
-- If you do not want that during verification, comment it out before running.


-- ============================================================================
-- RAZORPAY PORTAL COMPATIBILITY
-- ============================================================================

-- ============================================================
-- ROBOTRONIX™ RAZORPAY V2 PORTAL COMPATIBILITY MIGRATION
-- File: 14_razorpay_v2_portal_compatibility.sql
--
-- Run AFTER 12_razorpay_invoice_module_v2_FIXED.sql.
-- This aligns the V2 invoice schema with the portal runtime fields needed
-- for Razorpay status/payment tracking while keeping V2 as canonical.
-- Additive only; no invoice or family data is deleted.
-- ============================================================

BEGIN;

-- Extra immutable supplier/audit/lifecycle fields required by the portal.
ALTER TABLE public.student_invoices
  ADD COLUMN IF NOT EXISTS razorpay_invoice_number text,
  ADD COLUMN IF NOT EXISTS razorpay_payment_id text,
  ADD COLUMN IF NOT EXISTS amount_paid numeric(14,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_due numeric(14,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS supplier_address text NOT NULL DEFAULT 'F-184/D, Aggarwals Paliwal Dharamshala Marg, Laxmi Nagar, East Delhi, Delhi 110092, India',
  ADD COLUMN IF NOT EXISTS supplier_email text NOT NULL DEFAULT 'robotronixstemlab@gmail.com',
  ADD COLUMN IF NOT EXISTS supplier_phone text NOT NULL DEFAULT '+918595772008',
  ADD COLUMN IF NOT EXISTS export_eligibility_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Ensure amount_due is sensible for any existing rows created before this patch.
UPDATE public.student_invoices
SET amount_due = CASE
  WHEN status = 'paid' THEN 0
  WHEN amount_due = 0 THEN foreign_amount
  ELSE amount_due
END
WHERE foreign_amount IS NOT NULL;

-- V2 billing profile is intentionally separate from normal family address.
-- Keep one profile per parent and allow the portal to read/write it securely.
ALTER TABLE public.parent_billing_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS parent_billing_admin_read ON public.parent_billing_profiles;
CREATE POLICY parent_billing_admin_read ON public.parent_billing_profiles
FOR SELECT TO authenticated USING(public.is_admin());

DROP POLICY IF EXISTS parent_billing_parent_read ON public.parent_billing_profiles;
CREATE POLICY parent_billing_parent_read ON public.parent_billing_profiles
FOR SELECT TO authenticated USING(
  EXISTS(
    SELECT 1 FROM public.parents p
    WHERE p.id = parent_id AND p.profile_id = auth.uid()
  )
);

DROP POLICY IF EXISTS parent_billing_parent_write ON public.parent_billing_profiles;
CREATE POLICY parent_billing_parent_write ON public.parent_billing_profiles
FOR ALL TO authenticated
USING(
  EXISTS(
    SELECT 1 FROM public.parents p
    WHERE p.id = parent_id AND p.profile_id = auth.uid()
  )
)
WITH CHECK(
  EXISTS(
    SELECT 1 FROM public.parents p
    WHERE p.id = parent_id AND p.profile_id = auth.uid()
  )
);

DROP POLICY IF EXISTS parent_address_admin_read ON public.parent_addresses;
CREATE POLICY parent_address_admin_read ON public.parent_addresses
FOR SELECT TO authenticated USING(public.is_admin());

DROP POLICY IF EXISTS parent_address_parent_read ON public.parent_addresses;
CREATE POLICY parent_address_parent_read ON public.parent_addresses
FOR SELECT TO authenticated USING(
  EXISTS(
    SELECT 1 FROM public.parents p
    WHERE p.id = parent_id AND p.profile_id = auth.uid()
  )
);

DROP POLICY IF EXISTS parent_address_parent_write ON public.parent_addresses;
CREATE POLICY parent_address_parent_write ON public.parent_addresses
FOR ALL TO authenticated
USING(
  EXISTS(
    SELECT 1 FROM public.parents p
    WHERE p.id = parent_id AND p.profile_id = auth.uid()
  )
)
WITH CHECK(
  EXISTS(
    SELECT 1 FROM public.parents p
    WHERE p.id = parent_id AND p.profile_id = auth.uid()
  )
);

DROP POLICY IF EXISTS invoices_admin_read ON public.student_invoices;
CREATE POLICY invoices_admin_read ON public.student_invoices
FOR SELECT TO authenticated USING(public.is_admin());

-- Server/service-role API performs invoice insert/update actions.

COMMIT;

-- Verification
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name='student_invoices'
  AND column_name IN (
    'fee_package_id','foreign_amount','fx_rate_to_inr','fx_source',
    'amount_paid','amount_due','razorpay_invoice_number','razorpay_payment_id',
    'supplier_address','supplier_email','supplier_phone',
    'export_eligibility_confirmed','admin_reviewed_at','admin_reviewed_by'
  )
ORDER BY column_name;


-- ============================================================================
-- ENROLLMENT / NOTIFICATION / AUTH SUPPORT
-- ============================================================================

-- ============================================================
-- ROBOTRONIX™ FUNCTIONAL + DATA MODEL MIGRATION
-- File: 16_v1_2_0_enrollment_notification_auth_support.sql
--
-- Covers:
--   * fixed / short-package / open-ended enrollment models
--   * planned session limits and paid-session balance
--   * auto-completion for fixed programs
--   * safer scheduling support
--   * notification dedupe for class schedule changes
--   * parent onboarding lookup performance
--
-- This migration is additive and preserves existing master data.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Flexible enrollment lifecycle
-- ------------------------------------------------------------

ALTER TABLE public.enrollments
    ADD COLUMN IF NOT EXISTS program_model text NOT NULL DEFAULT 'fixed_program',
    ADD COLUMN IF NOT EXISTS planned_sessions integer,
    ADD COLUMN IF NOT EXISTS paid_session_balance integer,
    ADD COLUMN IF NOT EXISTS planned_end_date date,
    ADD COLUMN IF NOT EXISTS auto_complete_on_session_limit boolean NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='enrollments_program_model_check'
      AND conrelid='public.enrollments'::regclass
  ) THEN
    ALTER TABLE public.enrollments
      ADD CONSTRAINT enrollments_program_model_check
      CHECK (program_model IN ('fixed_program','short_package','open_ended'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='enrollments_planned_sessions_check'
      AND conrelid='public.enrollments'::regclass
  ) THEN
    ALTER TABLE public.enrollments
      ADD CONSTRAINT enrollments_planned_sessions_check
      CHECK (planned_sessions IS NULL OR planned_sessions > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='enrollments_paid_session_balance_check'
      AND conrelid='public.enrollments'::regclass
  ) THEN
    ALTER TABLE public.enrollments
      ADD CONSTRAINT enrollments_paid_session_balance_check
      CHECK (paid_session_balance IS NULL OR paid_session_balance >= 0);
  END IF;
END $$;

-- Existing enrollments use the course session count as their fixed-program target.
UPDATE public.enrollments e
SET planned_sessions = c.total_sessions
FROM public.courses c
WHERE e.course_id=c.id
  AND e.program_model='fixed_program'
  AND e.planned_sessions IS NULL
  AND c.total_sessions IS NOT NULL
  AND c.total_sessions > 0;

-- ------------------------------------------------------------
-- 2. Progress + automatic fixed-program completion
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.refresh_enrollment_progress(p_enrollment uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_count int;
  v_target int;
  v_model text;
  v_auto boolean;
  v_status text;
BEGIN
  SELECT coalesce(e.opening_completed_sessions,0) + count(a.*)
    INTO v_count
  FROM public.enrollments e
  LEFT JOIN public.class_attendance a ON a.enrollment_id=e.id AND a.status IN ('attended','late')
  WHERE e.id=p_enrollment
  GROUP BY e.opening_completed_sessions;

  SELECT
      e.program_model,
      e.auto_complete_on_session_limit,
      e.status,
      CASE
        WHEN e.planned_sessions IS NOT NULL THEN e.planned_sessions
        WHEN e.program_model='fixed_program' THEN c.total_sessions
        ELSE NULL
      END
  INTO v_model, v_auto, v_status, v_target
  FROM public.enrollments e
  JOIN public.courses c ON c.id=e.course_id
  WHERE e.id=p_enrollment;

  UPDATE public.enrollments
  SET
      sessions_completed=coalesce(v_count,0),
      progress_percent=CASE
        WHEN coalesce(v_target,0)>0
          THEN least(100,round((v_count::numeric/v_target::numeric)*100,2))
        ELSE 0
      END,
      status=CASE
        WHEN v_model='fixed_program'
             AND coalesce(v_auto,true)
             AND coalesce(v_target,0)>0
             AND coalesce(v_count,0)>=v_target
             AND v_status='active'
          THEN 'completed'
        ELSE status
      END,
      completed_at=CASE
        WHEN v_model='fixed_program'
             AND coalesce(v_auto,true)
             AND coalesce(v_target,0)>0
             AND coalesce(v_count,0)>=v_target
             AND v_status='active'
          THEN coalesce(completed_at,current_date)
        ELSE completed_at
      END,
      updated_at=now()
  WHERE id=p_enrollment;
END $$;

-- ------------------------------------------------------------
-- 3. Parent onboarding lookup/index for multi-child family flow
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS onboarding_submissions_user_status_idx
ON public.onboarding_submissions(user_id,status,submitted_at DESC);

-- ------------------------------------------------------------
-- 4. Notification dedupe / correct learner scoping
-- ------------------------------------------------------------

ALTER TABLE public.portal_notifications
    ADD COLUMN IF NOT EXISTS dedupe_key text;

CREATE UNIQUE INDEX IF NOT EXISTS portal_notifications_dedupe_uidx
ON public.portal_notifications(dedupe_key)
WHERE dedupe_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.notify_schedule_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  event_type text;
  title_text text;
  msg text;
  sid uuid;
  event_id uuid;
BEGIN
  event_id:=new.id;

  IF tg_op='INSERT' THEN
    event_type:='class_scheduled';
    title_text:='Class scheduled';
    msg:='A learning session has been scheduled.';
  ELSIF new.status='cancelled' AND old.status IS DISTINCT FROM new.status THEN
    event_type:='class_cancelled';
    title_text:='Class cancelled';
    msg:='A scheduled learning session has been cancelled.';
  ELSIF new.status='rescheduled'
        OR new.date IS DISTINCT FROM old.date
        OR new.start_time IS DISTINCT FROM old.start_time
        OR new.end_time IS DISTINCT FROM old.end_time THEN
    event_type:='class_rescheduled';
    title_text:='Class schedule updated';
    msg:='A learning session has a revised date or time.';
  ELSE
    RETURN new;
  END IF;

  -- Resolve all learners belonging to this occurrence.
  FOR sid IN
    SELECT DISTINCT x.student_id
    FROM (
      SELECT new.student_id AS student_id
      WHERE new.student_id IS NOT NULL

      UNION ALL

      SELECT e.student_id
      FROM public.enrollments e
      WHERE new.enrollment_id IS NOT NULL
        AND e.id=new.enrollment_id

      UNION ALL

      SELECT e.student_id
      FROM public.enrollments e
      WHERE new.cohort_id IS NOT NULL
        AND e.cohort_id=new.cohort_id
        AND e.status='active'
    ) x
    WHERE x.student_id IS NOT NULL
  LOOP
    INSERT INTO public.portal_notifications
      (recipient_role,student_id,trainer_id,type,priority,title,message,href,dedupe_key)
    VALUES
      ('parent',sid,new.trainer_id,event_type,'action',title_text,msg,'/parent',
       event_id::text||':'||event_type||':parent:'||sid::text)
    ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL
    DO NOTHING;

    INSERT INTO public.portal_notifications
      (recipient_role,student_id,trainer_id,type,priority,title,message,href,dedupe_key)
    VALUES
      ('student',sid,new.trainer_id,event_type,'info',title_text,msg,'/student',
       event_id::text||':'||event_type||':student:'||sid::text)
    ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL
    DO NOTHING;
  END LOOP;

  INSERT INTO public.portal_notifications
    (recipient_role,student_id,trainer_id,type,priority,title,message,href,dedupe_key)
  VALUES
    ('trainer',new.student_id,new.trainer_id,event_type,'info',title_text,msg,'/trainer/schedule',
     event_id::text||':'||event_type||':trainer:'||new.trainer_id::text)
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL
  DO NOTHING;

  RETURN new;
END $$;

-- ------------------------------------------------------------
-- 5. Non-secret operational settings
-- ------------------------------------------------------------

INSERT INTO public.system_settings(key,value_text,description)
VALUES
  ('enrollment_completion_warning_sessions','4','Warn Admin when a fixed program is approaching completion'),
  ('open_ended_require_paid_balance','true','Open-ended/short-package scheduling is blocked when an explicit paid-session balance reaches zero')
ON CONFLICT(key)
DO UPDATE SET
  value_text=EXCLUDED.value_text,
  description=EXCLUDED.description,
  updated_at=now();

COMMIT;

-- Quick verification
SELECT
  column_name,data_type,is_nullable
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name='enrollments'
  AND column_name IN (
    'program_model','planned_sessions','paid_session_balance',
    'planned_end_date','auto_complete_on_session_limit'
  )
ORDER BY column_name;

SELECT key,value_text
FROM public.system_settings
WHERE key IN ('enrollment_completion_warning_sessions','open_ended_require_paid_balance')
ORDER BY key;


-- ============================================================================
-- TRAINER ACCOUNTABILITY + PAYROLL RULES
-- ============================================================================

-- Robotronix Final v1.0
-- 21_trainer_accountability_payroll.sql
-- Student no-show / cancellation = zero trainer pay.
-- Adds trainer-side no-show / late accountability settings.
-- Allows audited negative earning totals so a no-show penalty can reduce monthly payroll.

begin;

alter table public.trainer_compensation_plans
  add column if not exists trainer_no_show_penalty_percent numeric(6,2) not null default 100 check (trainer_no_show_penalty_percent between 0 and 200),
  add column if not exists late_grace_minutes int not null default 5 check (late_grace_minutes between 0 and 60),
  add column if not exists late_penalty_percent numeric(5,2) not null default 0 check (late_penalty_percent between 0 and 100);

update public.trainer_compensation_plans set no_show_percent=0,cancelled_percent=0 where no_show_percent<>0 or cancelled_percent<>0;

create or replace function public.recalc_trainer_earning_manual() returns trigger language plpgsql as $$
declare p public.trainer_compensation_plans%rowtype;
begin
 if new.status='paid' and tg_op='UPDATE' and (new.adjustment is distinct from old.adjustment or new.conversion_applied is distinct from old.conversion_applied) then raise exception 'Paid earning is locked. Create a later payroll adjustment instead.'; end if;
 select * into p from public.trainer_compensation_plans where trainer_id=new.trainer_id and effective_from<=new.earning_date order by effective_from desc limit 1;
 if not found then return new; end if;
 new.conversion_bonus:=case when new.conversion_applied and new.session_type='demo' then case when new.pay_band='day' then p.demo_conversion_day else p.demo_conversion_night end else 0 end;
 new.total_amount:=round((new.base_rate*new.duration_factor*(case when new.class_outcome='completed' then 100 else 0 end)/100.0+new.conversion_bonus+new.adjustment)::numeric,2);
 new.updated_at:=now();
 return new;
end $$;

drop trigger if exists trainer_earning_manual_recalc on public.trainer_earnings;
create trigger trainer_earning_manual_recalc before update of conversion_applied,adjustment,adjustment_reason,notes,status on public.trainer_earnings for each row execute function public.recalc_trainer_earning_manual();

commit;

select trainer_no_show_penalty_percent,late_grace_minutes,late_penalty_percent,no_show_percent,cancelled_percent from public.trainer_compensation_plans order by updated_at desc limit 5;


-- ============================================================================
-- ROLE PROFILES + PARENT COMMUNITY + TRAINER FINANCE REQUESTS
-- ============================================================================

-- Robotronix v1.0 consolidated update
-- 22_role_profiles_parent_community_trainer_finance_requests.sql
begin;

alter table public.profiles add column if not exists phone text not null default '';
alter table public.profiles add column if not exists timezone text not null default 'Asia/Kolkata';


-- Trainers can read their approved payout record, but cannot edit it directly.
drop policy if exists trainer_finance_trainer_select on public.trainer_finance;
create policy trainer_finance_trainer_select on public.trainer_finance for select using(trainer_id=public.current_trainer_id());

-- Trainer-owned availability editing. Admin policies remain in place.
drop policy if exists availability_trainer_write on public.trainer_availability;
create policy availability_trainer_write on public.trainer_availability for all using(trainer_id=public.current_trainer_id()) with check(trainer_id=public.current_trainer_id());
drop policy if exists availability_override_trainer_write on public.trainer_availability_overrides;
create policy availability_override_trainer_write on public.trainer_availability_overrides for all using(trainer_id=public.current_trainer_id()) with check(trainer_id=public.current_trainer_id());

create table if not exists public.trainer_finance_change_requests(
 id uuid primary key default gen_random_uuid(),
 trainer_id uuid not null references public.trainers(id) on delete cascade,
 account_holder_name text not null default '', bank_name text not null default '', account_number text not null default '', ifsc text not null default '', upi_id text not null default '', pan text not null default '',
 preferred_payout_method text not null default 'bank' check(preferred_payout_method in ('bank','upi','other')),
 status text not null default 'pending' check(status in ('pending','approved','rejected','correction_requested')),
 trainer_note text not null default '', admin_note text not null default '', submitted_at timestamptz not null default now(), reviewed_at timestamptz, reviewed_by uuid references public.profiles(id) on delete set null
);
alter table public.trainer_finance_change_requests enable row level security;
drop policy if exists trainer_finance_requests_select on public.trainer_finance_change_requests;
create policy trainer_finance_requests_select on public.trainer_finance_change_requests for select using(public.is_admin() or trainer_id=public.current_trainer_id());
drop policy if exists trainer_finance_requests_trainer_insert on public.trainer_finance_change_requests;
create policy trainer_finance_requests_trainer_insert on public.trainer_finance_change_requests for insert with check(trainer_id=public.current_trainer_id() and status='pending');
drop policy if exists trainer_finance_requests_admin_update on public.trainer_finance_change_requests;
create policy trainer_finance_requests_admin_update on public.trainer_finance_change_requests for update using(public.is_admin()) with check(public.is_admin());

create table if not exists public.parent_community_profiles(
 parent_id uuid primary key references public.parents(id) on delete cascade,
 profession text not null default '', organization text not null default '', designation text not null default '', linkedin_url text not null default '', instagram_handle text not null default '', facebook_url text not null default '',
 expertise text[] not null default '{}', contribution_interests text[] not null default '{}', foundation_interests text[] not null default '{}',
 ambassador_interest boolean not null default false, social_tag_consent boolean not null default false, community_contact_consent boolean not null default false,
 updated_at timestamptz not null default now()
);
alter table public.parent_community_profiles enable row level security;
drop policy if exists parent_community_select on public.parent_community_profiles;
create policy parent_community_select on public.parent_community_profiles for select using(public.is_admin() or parent_id=public.current_parent_id());
drop policy if exists parent_community_parent_write on public.parent_community_profiles;
create policy parent_community_parent_write on public.parent_community_profiles for all using(parent_id=public.current_parent_id()) with check(parent_id=public.current_parent_id());
drop policy if exists parent_community_admin_write on public.parent_community_profiles;
create policy parent_community_admin_write on public.parent_community_profiles for all using(public.is_admin()) with check(public.is_admin());

create table if not exists public.family_introductions(
 id uuid primary key default gen_random_uuid(), parent_id uuid not null references public.parents(id) on delete cascade,
 introduced_name text not null, introduced_contact text not null default '', note text not null default '',
 status text not null default 'introduced' check(status in ('introduced','contacted','demo_scheduled','enrolled','closed')),
 converted_at timestamptz, benefit_status text not null default 'none' check(benefit_status in ('none','available','redeemed','donated')),
 benefit_value_inr numeric(12,2), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.family_introductions enable row level security;
drop policy if exists family_introductions_select on public.family_introductions;
create policy family_introductions_select on public.family_introductions for select using(public.is_admin() or parent_id=public.current_parent_id());
drop policy if exists family_introductions_parent_insert on public.family_introductions;
create policy family_introductions_parent_insert on public.family_introductions for insert with check(parent_id=public.current_parent_id());
drop policy if exists family_introductions_admin_update on public.family_introductions;
create policy family_introductions_admin_update on public.family_introductions for update using(public.is_admin()) with check(public.is_admin());


create or replace function public.set_family_introduction_benefit()
returns trigger language plpgsql as $$
declare v numeric(12,2);
begin
 if new.status='enrolled' and old.status is distinct from 'enrolled' then
  select nullif(value_text,'')::numeric into v from public.system_settings where key='parent_referral_benefit_value_inr';
  new.converted_at:=coalesce(new.converted_at,now());
  new.benefit_status:='available';
  new.benefit_value_inr:=coalesce(v,750);
 end if;
 new.updated_at:=now();
 return new;
end $$;
drop trigger if exists family_introduction_benefit_trigger on public.family_introductions;
create trigger family_introduction_benefit_trigger before update on public.family_introductions for each row execute function public.set_family_introduction_benefit();

insert into public.system_settings(key,value_text,description,updated_at) values
 ('parent_referral_benefit_value_inr','750','Internal value of one converted Parent Community introduction. Parent-facing UI should call this a Community Benefit, not referral commission.',now())
on conflict(key) do update set description=excluded.description,updated_at=now();

create or replace function public.update_own_trainer_profile(p_mobile text,p_city text,p_state text,p_country text,p_timezone text,p_specialties text[])
returns void language plpgsql security definer set search_path=public as $$
begin
 update public.trainers set mobile=coalesce(p_mobile,''),city=coalesce(p_city,''),state=coalesce(p_state,''),country=coalesce(p_country,'India'),timezone=coalesce(p_timezone,'Asia/Kolkata'),specialties=coalesce(p_specialties,'{}'),updated_at=now()
 where profile_id=auth.uid();
 if not found then raise exception 'Trainer profile not linked'; end if;
end $$;
grant execute on function public.update_own_trainer_profile(text,text,text,text,text,text[]) to authenticated;

create or replace function public.review_trainer_finance_request(p_request_id uuid,p_action text,p_admin_note text default '')
returns void language plpgsql security definer set search_path=public as $$
declare r public.trainer_finance_change_requests%rowtype; target_status text;
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 select * into r from public.trainer_finance_change_requests where id=p_request_id for update;
 if not found then raise exception 'Request not found'; end if;
 if p_action='approve' then target_status:='approved'; elsif p_action='reject' then target_status:='rejected'; elsif p_action='request_correction' then target_status:='correction_requested'; else raise exception 'Invalid review action'; end if;
 if target_status='approved' then
  insert into public.trainer_finance(trainer_id,account_holder_name,bank_name,account_number,ifsc,upi_id,preferred_payout_method,pan,compliance_status,updated_at)
  values(r.trainer_id,r.account_holder_name,r.bank_name,r.account_number,r.ifsc,r.upi_id,r.preferred_payout_method,r.pan,'pending',now())
  on conflict(trainer_id) do update set account_holder_name=excluded.account_holder_name,bank_name=excluded.bank_name,account_number=excluded.account_number,ifsc=excluded.ifsc,upi_id=excluded.upi_id,preferred_payout_method=excluded.preferred_payout_method,pan=excluded.pan,updated_at=now();
 end if;
 update public.trainer_finance_change_requests set status=target_status,admin_note=coalesce(p_admin_note,''),reviewed_at=now(),reviewed_by=auth.uid() where id=p_request_id;
end $$;
grant execute on function public.review_trainer_finance_request(uuid,text,text) to authenticated;

commit;


-- ============================================================================
-- TRAINER FINANCE RATE-CARD VISIBILITY
-- ============================================================================

-- Robotronix v1.0
-- 23_trainer_finance_ratecard_visibility.sql
--
-- Purpose:
--   Ensure a logged-in Trainer can read ONLY their own approved payout details
--   and their own current rate card, while Admin retains full control.
--
-- This does NOT allow a Trainer to edit trainer_finance or compensation plans.
-- Trainer payout changes still go through trainer_finance_change_requests.

begin;

-- Recreate the self-read policies explicitly. This is idempotent and useful
-- when an environment was upgraded through different historical patch paths.
drop policy if exists trainer_finance_trainer_select on public.trainer_finance;
create policy trainer_finance_trainer_select
on public.trainer_finance
for select
using (trainer_id = public.current_trainer_id());

drop policy if exists trainer_comp_plans_trainer_select on public.trainer_compensation_plans;
create policy trainer_comp_plans_trainer_select
on public.trainer_compensation_plans
for select
using (trainer_id = public.current_trainer_id());

-- Keep trainer finance change requests visible only to the owning trainer or Admin.
drop policy if exists trainer_finance_requests_select on public.trainer_finance_change_requests;
create policy trainer_finance_requests_select
on public.trainer_finance_change_requests
for select
using (public.is_admin() or trainer_id = public.current_trainer_id());

commit;

-- READ-ONLY diagnostic:
-- This should show the Trainer record linked to the same profile UUID as the Auth user.
-- Run while inspecting a specific trainer in SQL by replacing the email below if needed.
--
-- select
--   t.id as trainer_id,
--   t.full_name,
--   t.email,
--   t.profile_id,
--   p.email as profile_email,
--   p.role,
--   t.login_linked,
--   exists(select 1 from public.trainer_finance f where f.trainer_id=t.id) as has_finance,
--   exists(select 1 from public.trainer_compensation_plans cp where cp.trainer_id=t.id) as has_rate_card
-- from public.trainers t
-- left join public.profiles p on p.id=t.profile_id
-- where lower(t.email)=lower('TRAINER_EMAIL_HERE');


-- ============================================================================
-- ADMIN NOTIFICATION ON PARENT ONBOARDING
-- ============================================================================

-- Robotronix Production Readiness Patch 24
-- Create an Admin portal notification whenever a parent successfully submits onboarding.
-- Idempotent. No client-side Admin permission is required because the trigger runs in the database.

begin;

create or replace function public.notify_admin_on_onboarding_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.portal_notifications(
    recipient_role, type, priority, title, message, href, created_at
  ) values (
    'admin',
    'onboarding_submitted',
    'action',
    'New family onboarding received',
    coalesce(nullif(trim(new.child_name),''),'A new learner') ||
      ' has been submitted by ' ||
      coalesce(nullif(trim(new.primary_guardian_name),''), nullif(trim(new.login_email),''), 'a parent / guardian') ||
      ' and is awaiting review.',
    '/admin/onboarding/' || new.id::text,
    now()
  );
  return new;
end;
$$;

drop trigger if exists onboarding_submission_admin_notification_trg on public.onboarding_submissions;
create trigger onboarding_submission_admin_notification_trg
after insert on public.onboarding_submissions
for each row execute function public.notify_admin_on_onboarding_submission();

commit;

-- Verification (read-only):
-- select type,priority,title,message,href,created_at
-- from public.portal_notifications
-- where type='onboarding_submitted'
-- order by created_at desc limit 10;


-- ============================================================================
-- CONSOLIDATED FRESH-INSTALL FIXES DISCOVERED DURING PRODUCTION QA
-- ============================================================================

comment on column public.enrollments.schedule_override_confirmed is
'Confirms that an administrator intentionally accepted a schedule override/conflict.';

comment on column public.enrollments.schedule_override_note is
'Optional administrative note explaining a schedule override/conflict.';

-- RLS policies do not themselves grant PostgreSQL table privileges.
-- On a fresh Supabase schema, authenticated users need base DML privileges on
-- RLS-protected tables; the RLS policies continue to control permitted rows/actions.
begin;

grant usage on schema public to authenticated;

do $$
declare
  r record;
begin
  for r in
    select format('%I.%I', n.nspname, c.relname) as fq_table
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r','p')
      and c.relrowsecurity = true
  loop
    execute format(
      'grant select, insert, update, delete on table %s to authenticated',
      r.fq_table
    );
  end loop;
end
$$;

commit;


-- ============================================================================
-- FINAL RELEASE CONSOLIDATION: active-student opening position + private notes
-- ============================================================================
begin;
alter table public.enrollments add column if not exists migration_type text not null default 'native';
alter table public.enrollments add column if not exists opening_completed_sessions integer not null default 0;
alter table public.enrollments add column if not exists opening_completed_minutes integer not null default 0;
alter table public.enrollments add column if not exists migration_note text;
alter table public.enrollments add column if not exists portal_tracking_started_at date;
do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='public.enrollments'::regclass and conname='enrollments_migration_type_check') then alter table public.enrollments add constraint enrollments_migration_type_check check(migration_type in ('native','active_existing')); end if;
 if not exists(select 1 from pg_constraint where conrelid='public.enrollments'::regclass and conname='enrollments_opening_completed_sessions_check') then alter table public.enrollments add constraint enrollments_opening_completed_sessions_check check(opening_completed_sessions>=0); end if;
 if not exists(select 1 from pg_constraint where conrelid='public.enrollments'::regclass and conname='enrollments_opening_completed_minutes_check') then alter table public.enrollments add constraint enrollments_opening_completed_minutes_check check(opening_completed_minutes>=0); end if;
end $$;
alter table public.student_fee_packages add column if not exists source text not null default 'portal';
alter table public.student_fee_packages add column if not exists notes text not null default '';
alter table public.student_fee_payments add column if not exists source text not null default 'portal';
create table if not exists public.learning_observation_internal_notes (schedule_event_id uuid not null references public.schedule_events(id) on delete cascade,student_id uuid not null references public.students(id) on delete cascade,enrollment_id uuid not null references public.enrollments(id) on delete cascade,trainer_id uuid not null references public.trainers(id) on delete restrict,note text not null default '',updated_at timestamptz not null default now(),primary key(schedule_event_id,student_id));
alter table public.learning_observation_internal_notes enable row level security;
grant select,insert,update,delete on public.learning_observation_internal_notes to authenticated;
drop policy if exists learning_internal_notes_select on public.learning_observation_internal_notes; create policy learning_internal_notes_select on public.learning_observation_internal_notes for select using(public.is_admin() or exists(select 1 from public.enrollments e where e.id=enrollment_id and e.trainer_id=public.current_trainer_id()));
drop policy if exists learning_internal_notes_admin_all on public.learning_observation_internal_notes; create policy learning_internal_notes_admin_all on public.learning_observation_internal_notes for all using(public.is_admin()) with check(public.is_admin());
drop policy if exists learning_internal_notes_trainer_insert on public.learning_observation_internal_notes; create policy learning_internal_notes_trainer_insert on public.learning_observation_internal_notes for insert with check(trainer_id=public.current_trainer_id() and exists(select 1 from public.enrollments e where e.id=enrollment_id and e.trainer_id=public.current_trainer_id()));
drop policy if exists learning_internal_notes_trainer_update on public.learning_observation_internal_notes; create policy learning_internal_notes_trainer_update on public.learning_observation_internal_notes for update using(trainer_id=public.current_trainer_id() and exists(select 1 from public.enrollments e where e.id=enrollment_id and e.trainer_id=public.current_trainer_id())) with check(trainer_id=public.current_trainer_id() and exists(select 1 from public.enrollments e where e.id=enrollment_id and e.trainer_id=public.current_trainer_id()));
drop policy if exists learning_internal_notes_trainer_delete on public.learning_observation_internal_notes; create policy learning_internal_notes_trainer_delete on public.learning_observation_internal_notes for delete using(trainer_id=public.current_trainer_id() and exists(select 1 from public.enrollments e where e.id=enrollment_id and e.trainer_id=public.current_trainer_id()));
do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='public.enrollments'::regclass and conname='enrollments_opening_within_plan_check') then alter table public.enrollments add constraint enrollments_opening_within_plan_check check(planned_sessions is null or opening_completed_sessions<=planned_sessions); end if;
 if not exists(select 1 from pg_constraint where conrelid='public.student_fee_packages'::regclass and conname='student_fee_packages_source_check') then alter table public.student_fee_packages add constraint student_fee_packages_source_check check(source in ('portal','migration')); end if;
 if not exists(select 1 from pg_constraint where conrelid='public.student_fee_payments'::regclass and conname='student_fee_payments_source_check') then alter table public.student_fee_payments add constraint student_fee_payments_source_check check(source in ('portal','migration')); end if;
end $$;
commit;

-- ============================================================================
-- FINAL RELEASE CONSOLIDATION: opening progress refresh trigger
-- ============================================================================
-- Existing active learners may begin portal tracking part-way through a course.
-- Keep cached sessions/progress in sync whenever the opening position changes.
create or replace function public.on_enrollment_opening_progress_change()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  perform public.refresh_enrollment_progress(new.id);
  return new;
end
$$;

drop trigger if exists enrollment_opening_progress_trigger on public.enrollments;
create trigger enrollment_opening_progress_trigger
after insert or update of opening_completed_sessions, opening_completed_minutes, planned_sessions, course_id
on public.enrollments
for each row execute function public.on_enrollment_opening_progress_change();

-- ============================================================================
-- FINAL RELEASE CONSOLIDATION: Zoom Classroom POC foundation
-- ============================================================================
-- ============================================================================
-- Robotronix Production V1 - Zoom Classroom POC foundation
-- Supports multiple independently-authorized Zoom host accounts.
-- OAuth access/refresh tokens are encrypted by the application before storage.
-- No browser role receives token columns directly.
-- ============================================================================

create table if not exists public.zoom_host_accounts (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  zoom_user_id text not null unique,
  zoom_email text not null default '',
  zoom_account_id text,
  status text not null default 'connected' check(status in ('connected','disconnected','error')),
  access_token_encrypted text not null,
  refresh_token_encrypted text not null,
  access_token_expires_at timestamptz not null,
  connected_by uuid references public.profiles(id) on delete set null,
  connected_at timestamptz not null default now(),
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.zoom_meetings (
  id uuid primary key default gen_random_uuid(),
  host_account_id uuid not null references public.zoom_host_accounts(id) on delete restrict,
  schedule_event_id uuid references public.schedule_events(id) on delete restrict,
  purpose text not null default 'class' check(purpose in ('class','poc')),
  zoom_meeting_id text not null,
  zoom_meeting_uuid text,
  topic text not null,
  passcode text not null default '',
  join_url text,
  status text not null default 'scheduled' check(status in ('scheduled','started','ended','cancelled','error')),
  scheduled_start timestamptz,
  duration_minutes integer check(duration_minutes is null or duration_minutes > 0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(zoom_meeting_id)
);

create unique index if not exists zoom_meetings_schedule_event_unique
on public.zoom_meetings(schedule_event_id)
where schedule_event_id is not null and purpose='class';

alter table public.zoom_host_accounts enable row level security;
alter table public.zoom_meetings enable row level security;

-- Intentionally no direct browser policies on zoom_host_accounts because it contains
-- encrypted OAuth credentials. Server APIs use the service role and return safe fields only.
-- POC zoom_meetings are also accessed only through authenticated server APIs.

grant all on table public.zoom_host_accounts to service_role;
grant all on table public.zoom_meetings to service_role;



-- Selected operational tables publish live changes to authorized portal clients.
do $$
declare
  t text;
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach t in array array[
      'portal_notifications',
      'demo_guest_requests',
      'demo_sessions',
      'demo_session_participants',
      'schedule_events',
      'onboarding_submissions',
      'class_attendance',
      'session_records',
      'learning_observations',
      'student_invoices',
      'student_fee_payments',
      'trainer_earnings'
    ]
    loop
      if exists(
        select 1 from pg_class c
        join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='public' and c.relname=t and c.relkind='r'
      ) and not exists(
        select 1 from pg_publication_tables
        where pubname='supabase_realtime' and schemaname='public' and tablename=t
      ) then
        execute format('alter publication supabase_realtime add table public.%I',t);
      end if;
    end loop;
  end if;
end $$;

notify pgrst, 'reload schema';


-- ============================================================================
-- FINAL RELEASE CONSOLIDATION: RAZORPAY OPERATIONS HARDENING
-- ============================================================================

alter table public.student_invoices add column if not exists last_synced_at timestamptz;
alter table public.student_invoices add column if not exists sync_error text;

create unique index if not exists student_invoices_fee_package_unique
  on public.student_invoices(fee_package_id)
  where fee_package_id is not null;

create table if not exists public.razorpay_webhook_events (
  event_key text primary key,
  event_type text not null,
  razorpay_event_id text,
  razorpay_invoice_id text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  attempt_count integer not null default 1,
  processing_error text
);

create index if not exists razorpay_webhook_events_invoice_idx
  on public.razorpay_webhook_events(razorpay_invoice_id, received_at desc);

alter table public.razorpay_webhook_events enable row level security;
grant all on table public.razorpay_webhook_events to service_role;

notify pgrst, 'reload schema';


-- ============================================================================
-- FINAL RELEASE CONSOLIDATION: CALENDAR SUBSCRIPTIONS
-- ============================================================================

create table if not exists public.calendar_subscription_tokens (
  id uuid primary key default gen_random_uuid(),
  owner_role text not null check (owner_role in ('trainer')),
  owner_id uuid not null,
  token_hash text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists calendar_subscription_owner_idx
  on public.calendar_subscription_tokens(owner_role, owner_id, active);

alter table public.calendar_subscription_tokens enable row level security;
grant all on table public.calendar_subscription_tokens to service_role;

notify pgrst, 'reload schema';


-- ============================================================================
-- FINAL RELEASE CONSOLIDATION: DEMO EXPERIENCE V1
-- ============================================================================

alter table public.zoom_meetings drop constraint if exists zoom_meetings_purpose_check;
alter table public.zoom_meetings add constraint zoom_meetings_purpose_check
  check (purpose in ('class','poc','general','demo'));

create table if not exists public.demo_leads (
  id uuid primary key default gen_random_uuid(),
  parent_name text not null,
  parent_whatsapp text not null,
  parent_email text,
  child_name text not null,
  grade text not null,
  interest text not null,
  experience_level text not null default 'new' check (experience_level in ('new','some','experienced')),
  source text not null default 'manual',
  status text not null default 'new' check (status in ('new','contacted','demo_scheduled','demo_completed','follow_up','converted','lost')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists demo_leads_status_idx on public.demo_leads(status, updated_at desc);
create index if not exists demo_leads_whatsapp_idx on public.demo_leads(parent_whatsapp);

create table if not exists public.demo_sessions (
  id uuid primary key default gen_random_uuid(),
  schedule_event_id uuid not null unique references public.schedule_events(id) on delete restrict,
  trainer_id uuid not null references public.trainers(id) on delete restrict,
  session_type text not null check (session_type in ('one_to_one','group')),
  focus text not null default 'Discovery Session',
  status text not null default 'scheduled' check (status in ('scheduled','completed','cancelled','no_show')),
  zoom_meeting_id uuid references public.zoom_meetings(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists demo_sessions_trainer_idx on public.demo_sessions(trainer_id, status);

create table if not exists public.demo_session_participants (
  id uuid primary key default gen_random_uuid(),
  demo_session_id uuid not null references public.demo_sessions(id) on delete cascade,
  lead_id uuid not null references public.demo_leads(id) on delete restrict,
  guest_token_hash text not null unique,
  guest_token_expires_at timestamptz not null,
  attendance text not null default 'scheduled' check (attendance in ('scheduled','attended','no_show','cancelled')),
  engagement text check (engagement in ('low','good','excellent')),
  understanding text check (understanding in ('developing','good','strong')),
  problem_solving text check (problem_solving in ('developing','good','strong')),
  confidence text check (confidence in ('low','comfortable','high')),
  explored text,
  strengths text[] not null default '{}',
  mentor_note text,
  recommended_course_id uuid references public.courses(id) on delete set null,
  recommended_format text check (recommended_format in ('one_to_one','small_group')),
  recommended_frequency text,
  fit text check (fit in ('strong','possible','not_now')),
  summary_published_at timestamptz,
  summary_viewed_at timestamptz,
  parent_rating text check (parent_rating in ('excellent','good','not_sure')),
  parent_feedback text,
  converted_student_id uuid references public.students(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(demo_session_id, lead_id)
);
create index if not exists demo_participants_session_idx on public.demo_session_participants(demo_session_id);
create index if not exists demo_participants_lead_idx on public.demo_session_participants(lead_id);

create table if not exists public.demo_guest_requests (
  id uuid primary key default gen_random_uuid(),
  demo_session_participant_id uuid not null references public.demo_session_participants(id) on delete cascade,
  request_type text not null check (request_type in ('reschedule','help')),
  message text not null default '',
  status text not null default 'open' check (status in ('open','resolved','closed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists demo_guest_requests_status_idx on public.demo_guest_requests(status, created_at desc);

alter table public.demo_leads enable row level security;
alter table public.demo_sessions enable row level security;
alter table public.demo_session_participants enable row level security;
alter table public.demo_guest_requests enable row level security;
grant all on table public.demo_leads to service_role;
grant all on table public.demo_sessions to service_role;
grant all on table public.demo_session_participants to service_role;
grant all on table public.demo_guest_requests to service_role;

create unique index if not exists zoom_meetings_demo_schedule_event_unique
  on public.zoom_meetings(schedule_event_id)
  where schedule_event_id is not null and purpose='demo';

notify pgrst, 'reload schema';


-- ============================================================================
-- CONSOLIDATED FEATURE PARITY (2026-10-18)
-- For NEW empty databases only; includes historical additive upgrades.
-- Old 04_upgrade files retained as migration history, not fresh-install steps.
-- ============================================================================

-- BEGIN INTEGRATED 01_ZOOM_CLASSROOM_V1.sql
-- Robotronix Learning Portal — Zoom Classroom V1 production upgrade
-- Safe to run once on an existing Production V1 database; statements are idempotent where practical.

begin;

alter table public.schedule_events add column if not exists zoom_enabled boolean not null default false;

alter table public.zoom_host_accounts add column if not exists enabled boolean not null default true;
alter table public.zoom_host_accounts add column if not exists priority integer not null default 100;
alter table public.zoom_host_accounts add column if not exists recording_enabled boolean not null default true;
alter table public.zoom_host_accounts add column if not exists recording_retention_days integer not null default 60;
alter table public.zoom_host_accounts add column if not exists learner_recording_default boolean not null default false;

alter table public.zoom_host_accounts drop constraint if exists zoom_host_accounts_recording_retention_days_check;
alter table public.zoom_host_accounts add constraint zoom_host_accounts_recording_retention_days_check
  check (recording_retention_days between 1 and 3650);

alter table public.zoom_meetings drop constraint if exists zoom_meetings_purpose_check;
alter table public.zoom_meetings add constraint zoom_meetings_purpose_check
  check (purpose in ('class','poc','general','demo'));

alter table public.zoom_meetings add column if not exists actual_started_at timestamptz;
alter table public.zoom_meetings add column if not exists actual_ended_at timestamptz;
alter table public.zoom_meetings add column if not exists recording_enabled boolean not null default false;
alter table public.zoom_meetings add column if not exists recording_status text not null default 'not_expected';
alter table public.zoom_meetings add column if not exists learner_recording_visible boolean not null default false;
alter table public.zoom_meetings add column if not exists recording_retention_days integer not null default 60;
alter table public.zoom_meetings add column if not exists last_error text;
alter table public.zoom_meetings add column if not exists meeting_notes text;
alter table public.zoom_meetings add column if not exists external_invite_enabled boolean not null default false;

alter table public.zoom_meetings drop constraint if exists zoom_meetings_recording_status_check;
alter table public.zoom_meetings add constraint zoom_meetings_recording_status_check
  check (recording_status in ('not_expected','pending','processing','ready','failed','deleted'));

create index if not exists zoom_meetings_host_window_idx
  on public.zoom_meetings(host_account_id, scheduled_start)
  where status in ('scheduled','started');

create table if not exists public.zoom_join_intents (
  id uuid primary key default gen_random_uuid(),
  zoom_meeting_id uuid not null references public.zoom_meetings(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  portal_role text not null check (portal_role in ('admin','trainer','parent','student')),
  participant_name text not null,
  requested_at timestamptz not null default now(),
  matched_at timestamptz
);
create index if not exists zoom_join_intents_match_idx
  on public.zoom_join_intents(zoom_meeting_id, requested_at desc);

create table if not exists public.zoom_participant_sessions (
  id uuid primary key default gen_random_uuid(),
  zoom_meeting_id uuid not null references public.zoom_meetings(id) on delete cascade,
  zoom_participant_id text,
  participant_name text not null default '',
  portal_profile_id uuid references public.profiles(id) on delete set null,
  portal_role text,
  joined_at timestamptz not null,
  left_at timestamptz,
  leave_reason text,
  duration_seconds integer,
  created_at timestamptz not null default now()
);
create index if not exists zoom_participant_sessions_meeting_idx
  on public.zoom_participant_sessions(zoom_meeting_id, joined_at);
create index if not exists zoom_participant_sessions_profile_idx
  on public.zoom_participant_sessions(portal_profile_id, joined_at desc);

create table if not exists public.zoom_recordings (
  id uuid primary key default gen_random_uuid(),
  zoom_meeting_id uuid not null references public.zoom_meetings(id) on delete cascade,
  zoom_recording_file_id text not null,
  recording_type text not null default '',
  file_type text not null default '',
  file_extension text not null default '',
  file_size_bytes bigint not null default 0,
  recording_start timestamptz,
  recording_end timestamptz,
  play_url text,
  download_url text,
  share_passcode_encrypted text,
  status text not null default 'completed' check(status in ('processing','completed','deleted','failed')),
  learner_visible boolean not null default false,
  retain_until timestamptz,
  protected_from_deletion boolean not null default false,
  deleted_from_zoom_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(zoom_recording_file_id)
);
create index if not exists zoom_recordings_meeting_idx on public.zoom_recordings(zoom_meeting_id);
create index if not exists zoom_recordings_retention_idx
  on public.zoom_recordings(retain_until)
  where status='completed' and protected_from_deletion=false;

create table if not exists public.zoom_webhook_events (
  event_hash text primary key,
  event_type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text,
  attempt_count integer not null default 0
);
alter table public.zoom_webhook_events add column if not exists attempt_count integer not null default 0;

alter table public.zoom_join_intents enable row level security;
alter table public.zoom_participant_sessions enable row level security;
alter table public.zoom_recordings enable row level security;
alter table public.zoom_webhook_events enable row level security;

grant all on table public.zoom_join_intents to service_role;
grant all on table public.zoom_participant_sessions to service_role;
grant all on table public.zoom_recordings to service_role;
grant all on table public.zoom_webhook_events to service_role;

notify pgrst, 'reload schema';
commit;

-- END INTEGRATED 01_ZOOM_CLASSROOM_V1.sql

-- BEGIN INTEGRATED 02_RAZORPAY_OPERATIONS_V1.sql
-- Robotronix Learning Portal — Razorpay Operations hardening
-- Additive production upgrade for webhook reliability, reconciliation and invoice operations.

begin;

alter table public.student_invoices add column if not exists last_synced_at timestamptz;
alter table public.student_invoices add column if not exists sync_error text;

-- One fee package must map to at most one Robotronix invoice.
create unique index if not exists student_invoices_fee_package_unique
  on public.student_invoices(fee_package_id)
  where fee_package_id is not null;

create table if not exists public.razorpay_webhook_events (
  event_key text primary key,
  event_type text not null,
  razorpay_event_id text,
  razorpay_invoice_id text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  attempt_count integer not null default 1,
  processing_error text
);

create index if not exists razorpay_webhook_events_invoice_idx
  on public.razorpay_webhook_events(razorpay_invoice_id, received_at desc);

alter table public.razorpay_webhook_events enable row level security;
grant all on table public.razorpay_webhook_events to service_role;

notify pgrst, 'reload schema';
commit;

-- END INTEGRATED 02_RAZORPAY_OPERATIONS_V1.sql

-- BEGIN INTEGRATED 03_CALENDAR_V1.sql
-- Robotronix Learning Portal — Calendar V1
-- Private trainer calendar subscriptions. Parent/student calendar views use existing RLS schedule data.

begin;

create table if not exists public.calendar_subscription_tokens (
  id uuid primary key default gen_random_uuid(),
  owner_role text not null check (owner_role in ('trainer')),
  owner_id uuid not null,
  token_hash text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists calendar_subscription_owner_idx
  on public.calendar_subscription_tokens(owner_role, owner_id, active);

alter table public.calendar_subscription_tokens enable row level security;
grant all on table public.calendar_subscription_tokens to service_role;

notify pgrst, 'reload schema';
commit;

-- END INTEGRATED 03_CALENDAR_V1.sql

-- BEGIN INTEGRATED 04_DEMO_EXPERIENCE_V1.sql
-- Robotronix Learning Portal — Demo Experience V1
-- Lead-first discovery flow for 1-to-1 and group demos. Parent contact details remain service-role/admin only.

begin;

alter table public.zoom_meetings drop constraint if exists zoom_meetings_purpose_check;
alter table public.zoom_meetings add constraint zoom_meetings_purpose_check
  check (purpose in ('class','poc','general','demo'));

create table if not exists public.demo_leads (
  id uuid primary key default gen_random_uuid(),
  parent_name text not null,
  parent_whatsapp text not null,
  parent_email text,
  child_name text not null,
  grade text not null,
  interest text not null,
  experience_level text not null default 'new' check (experience_level in ('new','some','experienced')),
  source text not null default 'manual',
  status text not null default 'new' check (status in ('new','contacted','demo_scheduled','demo_completed','follow_up','converted','lost')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists demo_leads_status_idx on public.demo_leads(status, updated_at desc);
create index if not exists demo_leads_whatsapp_idx on public.demo_leads(parent_whatsapp);

create table if not exists public.demo_sessions (
  id uuid primary key default gen_random_uuid(),
  schedule_event_id uuid not null unique references public.schedule_events(id) on delete restrict,
  trainer_id uuid not null references public.trainers(id) on delete restrict,
  session_type text not null check (session_type in ('one_to_one','group')),
  focus text not null default 'Discovery Session',
  status text not null default 'scheduled' check (status in ('scheduled','completed','cancelled','no_show')),
  zoom_meeting_id uuid references public.zoom_meetings(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists demo_sessions_trainer_idx on public.demo_sessions(trainer_id, status);

create table if not exists public.demo_session_participants (
  id uuid primary key default gen_random_uuid(),
  demo_session_id uuid not null references public.demo_sessions(id) on delete cascade,
  lead_id uuid not null references public.demo_leads(id) on delete restrict,
  guest_token_hash text not null unique,
  guest_token_expires_at timestamptz not null,
  attendance text not null default 'scheduled' check (attendance in ('scheduled','attended','no_show','cancelled')),
  engagement text check (engagement in ('low','good','excellent')),
  understanding text check (understanding in ('developing','good','strong')),
  problem_solving text check (problem_solving in ('developing','good','strong')),
  confidence text check (confidence in ('low','comfortable','high')),
  explored text,
  strengths text[] not null default '{}',
  mentor_note text,
  recommended_course_id uuid references public.courses(id) on delete set null,
  recommended_format text check (recommended_format in ('one_to_one','small_group')),
  recommended_frequency text,
  fit text check (fit in ('strong','possible','not_now')),
  summary_published_at timestamptz,
  summary_viewed_at timestamptz,
  parent_rating text check (parent_rating in ('excellent','good','not_sure')),
  parent_feedback text,
  converted_student_id uuid references public.students(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(demo_session_id, lead_id)
);
create index if not exists demo_participants_session_idx on public.demo_session_participants(demo_session_id);
create index if not exists demo_participants_lead_idx on public.demo_session_participants(lead_id);


create table if not exists public.demo_guest_requests (
  id uuid primary key default gen_random_uuid(),
  demo_session_participant_id uuid not null references public.demo_session_participants(id) on delete cascade,
  request_type text not null check (request_type in ('reschedule','help')),
  message text not null default '',
  status text not null default 'open' check (status in ('open','resolved','closed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists demo_guest_requests_status_idx on public.demo_guest_requests(status, created_at desc);
alter table public.demo_guest_requests enable row level security;
grant all on table public.demo_guest_requests to service_role;

alter table public.demo_leads enable row level security;
alter table public.demo_sessions enable row level security;
alter table public.demo_session_participants enable row level security;

-- These tables intentionally have no browser policies. Admin/Trainer/Public demo APIs use
-- the service role and return role-specific projections. This prevents trainer clients
-- from ever receiving parent WhatsApp/email fields.
grant all on table public.demo_leads to service_role;
grant all on table public.demo_sessions to service_role;
grant all on table public.demo_session_participants to service_role;

create unique index if not exists zoom_meetings_demo_schedule_event_unique
  on public.zoom_meetings(schedule_event_id)
  where schedule_event_id is not null and purpose='demo';

notify pgrst, 'reload schema';
commit;

-- END INTEGRATED 04_DEMO_EXPERIENCE_V1.sql

-- BEGIN INTEGRATED 05_LIVE_DATA_HARDENING_V1.sql
-- Robotronix Learning Portal — Live Data Hardening V1
-- Adds selected operational tables to Supabase Realtime publication.
-- Safe to run repeatedly.

begin;

do $$
declare
  t text;
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach t in array array[
      'portal_notifications',
      'demo_guest_requests',
      'demo_sessions',
      'demo_session_participants',
      'schedule_events',
      'onboarding_submissions',
      'class_attendance',
      'session_records',
      'learning_observations',
      'student_invoices',
      'student_fee_payments',
      'trainer_earnings'
    ]
    loop
      if exists(
        select 1 from pg_class c
        join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='public' and c.relname=t and c.relkind='r'
      ) and not exists(
        select 1 from pg_publication_tables
        where pubname='supabase_realtime' and schemaname='public' and tablename=t
      ) then
        execute format('alter publication supabase_realtime add table public.%I',t);
      end if;
    end loop;
  end if;
end $$;

notify pgrst, 'reload schema';
commit;

-- END INTEGRATED 05_LIVE_DATA_HARDENING_V1.sql

-- BEGIN INTEGRATED 06_ZOOM_HOST_ALLOCATION_GUARD.sql
-- Robotronix Zoom Phase 1: transaction-safe host conflict protection.
-- Run after Zoom Classroom migrations. Existing conflicts must be resolved first.
begin;
create extension if not exists btree_gist;
do $$
begin
 if exists (
  select 1 from public.zoom_meetings a
  join public.zoom_meetings b on a.id < b.id
   and a.host_account_id=b.host_account_id
   and numrange(extract(epoch from a.scheduled_start),extract(epoch from a.scheduled_start)+a.duration_minutes*60,'[)')
    && numrange(extract(epoch from b.scheduled_start),extract(epoch from b.scheduled_start)+b.duration_minutes*60,'[)')
  where a.status in ('scheduled','started') and b.status in ('scheduled','started')
    and a.scheduled_start is not null and b.scheduled_start is not null
    and a.duration_minutes>0 and b.duration_minutes>0
 ) then
  raise exception 'Existing overlapping Zoom meetings detected. Correct them before installing the host allocation guard.';
 end if;
end $$;
do $$
begin
 if not exists(select 1 from pg_constraint where conname='zoom_host_active_meeting_no_overlap' and conrelid='public.zoom_meetings'::regclass) then
  alter table public.zoom_meetings
   add constraint zoom_host_active_meeting_no_overlap
   exclude using gist (
    host_account_id with =,
    numrange(extract(epoch from (scheduled_start AT TIME ZONE 'UTC')), extract(epoch from (scheduled_start AT TIME ZONE 'UTC')) + duration_minutes * 60, '[)') with &&
   )
   where (status in ('scheduled','started') and scheduled_start is not null and duration_minutes > 0);
 end if;
end $$;
commit;

-- END INTEGRATED 06_ZOOM_HOST_ALLOCATION_GUARD.sql


-- ======================================================================
-- P1 Action notifications (consolidated into fresh-install baseline)
-- ======================================================================
-- Robotronix P1 action-required notifications (idempotent).
-- Run against DEV first. For an EXISTING installation this is a controlled migration;
-- fresh installations also include this content at the end of 01_CREATE_SCHEMA.sql.
begin;

-- Trainer payout: notify Admin when submitted, trainer when reviewed.
-- Never place account, UPI, PAN, IFSC or trainer notes in notification text.
create or replace function public.notify_trainer_payout_action()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_name text;
begin
  select coalesce(nullif(trim(full_name),''),'Trainer')
    into v_name from public.trainers where id=new.trainer_id;
  if tg_op='INSERT' and new.status='pending' then
    insert into public.portal_notifications
      (recipient_role,trainer_id,type,priority,title,message,href,dedupe_key)
    values
      ('admin',new.trainer_id,'trainer_payout_review','action',
       'Trainer payout change needs review',
       coalesce(v_name,'Trainer')||' submitted new payout details for review.',
       '/admin/trainers/'||new.trainer_id::text,
       'trainer-payout:'||new.id::text||':submitted')
    on conflict (dedupe_key) where dedupe_key is not null do nothing;
  elsif tg_op='UPDATE' and new.status is distinct from old.status
    and new.status in ('approved','rejected','correction_requested') then
    insert into public.portal_notifications
      (recipient_role,trainer_id,type,priority,title,message,href,dedupe_key)
    values
      ('trainer',new.trainer_id,'trainer_payout_decision',
       case when new.status='correction_requested' then 'action' else 'important' end,
       case new.status
         when 'approved' then 'Payout details approved'
         when 'rejected' then 'Payout details not approved'
         else 'Payout details need correction' end,
       case new.status
         when 'approved' then 'Your submitted payout details have been approved. Check the effective payroll cycle with Admin.'
         when 'rejected' then 'Admin did not approve your payout changes. Contact Robotronix Admin for clarification.'
         else 'Admin requested a correction to your submitted payout details. Open your profile to review.' end,
       '/trainer/profile',
       'trainer-payout:'||new.id::text||':'||new.status)
    on conflict (dedupe_key) where dedupe_key is not null do nothing;
  end if;
  return new;
end $$;
drop trigger if exists trainer_payout_action_insert_trg on public.trainer_finance_change_requests;
create trigger trainer_payout_action_insert_trg
after insert on public.trainer_finance_change_requests
for each row execute function public.notify_trainer_payout_action();
drop trigger if exists trainer_payout_action_update_trg on public.trainer_finance_change_requests;
create trigger trainer_payout_action_update_trg
after update of status on public.trainer_finance_change_requests
for each row execute function public.notify_trainer_payout_action();

-- Open urgent progress alerts need Admin attention, and subsequent updates should not
-- re-notify unless an alert is explicitly re-opened.
create or replace function public.notify_open_progress_alert()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status='open'
     and (tg_op='INSERT' or new.status is distinct from old.status) then
    insert into public.portal_notifications
      (recipient_role,student_id,type,priority,title,message,href,dedupe_key)
    values
      ('admin',new.student_id,'progress_alert_open','action',
       'Learner progress alert requires review',
       'A learner progress alert needs an Admin review.',
       '/admin/alerts',
       'progress-alert:'||new.id::text||':open:'||extract(epoch from new.updated_at)::bigint::text)
    on conflict (dedupe_key) where dedupe_key is not null do nothing;
  end if;
  return new;
end $$;
drop trigger if exists progress_action_insert_trg on public.progress_alert_actions;
create trigger progress_action_insert_trg after insert on public.progress_alert_actions
for each row execute function public.notify_open_progress_alert();
drop trigger if exists progress_action_update_trg on public.progress_alert_actions;
create trigger progress_action_update_trg after update of status on public.progress_alert_actions
for each row execute function public.notify_open_progress_alert();

-- Existing message trigger incorrectly routes trainer-originated messages to Parent
-- even when there is no Parent on the thread. Correct routing, do not expose message
-- bodies in notifications, and keep unread counts aligned with actual recipients.
create or replace function public.handle_communication_message()
returns trigger language plpgsql security definer set search_path=public as $$
declare t public.communication_threads%rowtype;
begin
 select * into t from public.communication_threads where id=new.thread_id;
 if not found then return new; end if;
 update public.communication_threads set
  last_message_at=new.created_at,
  last_message_preview=left(new.body,240),
  status=case
    when new.sender_role='parent' then 'waiting_team'
    when new.sender_role='trainer' then 'waiting_team'
    when t.parent_id is not null then 'waiting_parent'
    else 'open' end,
  unread_admin=case when new.sender_role in ('parent','trainer') then unread_admin+1 else unread_admin end,
  unread_parent=case when new.sender_role<>'parent' and t.parent_id is not null then unread_parent+1 else unread_parent end,
  unread_trainer=case when new.sender_role<>'trainer' and t.trainer_id is not null then unread_trainer+1 else unread_trainer end,
  updated_at=now()
 where id=new.thread_id;

 if new.sender_role in ('parent','trainer') then
  insert into public.portal_notifications
   (recipient_role,student_id,trainer_id,type,priority,title,message,href,dedupe_key)
  values ('admin',t.student_id,t.trainer_id,'message_received','action',
   case when new.sender_role='parent' then 'Parent message awaiting response' else 'Trainer message awaiting response' end,
   'A new message in your Robotronix inbox needs attention.',
   '/admin/messages/'||new.thread_id::text,
   'message:'||new.id::text||':admin')
  on conflict (dedupe_key) where dedupe_key is not null do nothing;
 end if;
 if new.sender_role='parent' and t.trainer_id is not null then
  insert into public.portal_notifications
   (recipient_role,student_id,trainer_id,type,priority,title,message,href,dedupe_key)
  values ('trainer',t.student_id,t.trainer_id,'message_received','action',
   'Parent message awaiting reply','A parent sent a message about a learner.',
   '/trainer/messages/'||new.thread_id::text,'message:'||new.id::text||':trainer')
  on conflict (dedupe_key) where dedupe_key is not null do nothing;
 end if;
 if new.sender_role='admin' and t.trainer_id is not null then
  insert into public.portal_notifications
   (recipient_role,student_id,trainer_id,type,priority,title,message,href,dedupe_key)
  values ('trainer',t.student_id,t.trainer_id,'message_received','action',
   'Message from Robotronix Admin','You have a new Admin message.',
   '/trainer/messages/'||new.thread_id::text,'message:'||new.id::text||':trainer')
  on conflict (dedupe_key) where dedupe_key is not null do nothing;
 end if;
 if new.sender_role<>'parent' and t.parent_id is not null then
  insert into public.portal_notifications
   (recipient_role,student_id,trainer_id,type,priority,title,message,href,dedupe_key)
  values ('parent',t.student_id,t.trainer_id,'message_received','action',
   'New Robotronix message','You have a new message in the family inbox.',
   '/parent/messages/'||new.thread_id::text,'message:'||new.id::text||':parent')
  on conflict (dedupe_key) where dedupe_key is not null do nothing;
 end if;
 return new;
end $$;

-- Existing class scheduling trigger already notifies trainers and families.
-- Notify Admin for cancellations/reschedules made by other roles, not Admin's own edits.
create or replace function public.notify_admin_critical_schedule_change()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if public.is_admin() then return new; end if;
 if new.event_type='class' and
   ((new.status in ('cancelled','rescheduled') and new.status is distinct from old.status)
      or new.date is distinct from old.date
      or new.start_time is distinct from old.start_time
      or new.end_time is distinct from old.end_time) then
  insert into public.portal_notifications
    (recipient_role,student_id,trainer_id,type,priority,title,message,href,dedupe_key)
  values ('admin',new.student_id,new.trainer_id,'class_change_review','action',
    'Class schedule change requires review',
    'A class was cancelled or its schedule changed. Review the affected class.',
    '/admin/schedule',
    'critical-class-change:'||new.id::text||':'||new.updated_at::text)
  on conflict (dedupe_key) where dedupe_key is not null do nothing;
 end if;
 return new;
end $$;
drop trigger if exists schedule_admin_action_update_trg on public.schedule_events;
create trigger schedule_admin_action_update_trg
after update of status,date,start_time,end_time on public.schedule_events
for each row execute function public.notify_admin_critical_schedule_change();

commit;


-- P2/P3 Realtime publication baseline, shared with existing-install migration.
-- P2/P3 event delivery: idempotent Supabase Realtime publication membership.
-- Apply only AFTER baseline schema and P1 action notifications migration.
-- Never expose sensitive trainer_finance / trainer_finance_change_requests row payloads
-- to public channels. Realtime Postgres Changes still enforces table RLS.
begin;
do $$
declare t text;
begin
 if not exists(select 1 from pg_publication where pubname='supabase_realtime') then
  raise exception 'Supabase Realtime publication is missing; verify correct DEV project';
 end if;
 foreach t in array array[
  'portal_notifications','onboarding_submissions',
  'students','trainers','courses','enrollments','cohorts',
  'schedule_events','class_attendance','session_records',
  'learning_observations','learner_projects',
  'trainer_earnings','trainer_payouts','trainer_compensation_plans',
  'trainer_finance','trainer_finance_change_requests',
  'trainer_availability','trainer_availability_overrides',
  'student_invoices','student_fee_payments',
  'progress_alert_actions','communication_threads','communication_messages'
 ] loop
  if to_regclass('public.'||t) is null then
    raise exception 'Realtime required table public.% missing; check migration order',t;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
   execute format('alter publication supabase_realtime add table public.%I',t);
  end if;
 end loop;
end $$;
commit;

-- Read-only verification:
-- select tablename from pg_publication_tables
-- where pubname='supabase_realtime' and schemaname='public' order by tablename;


-- Consolidated server-only diagnostics (existing-install delta: 06_PORTAL_SYSTEM_LOGS.sql)
-- Production-safe operational diagnostics: server-only writes, admin-only reads.
-- Apply in DEV after current baseline. No secrets, raw request bodies or bank details.
begin;
create table if not exists public.portal_system_logs(
 id uuid primary key default gen_random_uuid(),
 occurred_at timestamptz not null default now(),
 level text not null check(level in ('error','warning','info')),
 source text not null,
 action text not null,
 reference_id text not null,
 error_code text,
 safe_message text not null
);
create index if not exists portal_system_logs_date_idx on public.portal_system_logs(occurred_at desc);
create index if not exists portal_system_logs_ref_idx on public.portal_system_logs(reference_id);
alter table public.portal_system_logs enable row level security;
revoke all on public.portal_system_logs from anon,authenticated;
grant select on public.portal_system_logs to authenticated;
drop policy if exists portal_system_logs_admin_read on public.portal_system_logs;
create policy portal_system_logs_admin_read on public.portal_system_logs
 for select to authenticated using(public.is_admin());
-- service_role retains database-side write privileges; no client insert/update/delete policy.
commit;


-- Consolidated payroll cutoff and payout instruction locking (delta: 07_TRAINER_PAYROLL_CUTOFF.sql)
-- Robotronix trainer payout cut-off and immutable salary instructions.
-- Controlled DEV-only migration; review existing payout workflows before Production.
begin;

insert into public.system_settings(key,value_text,description) values
 ('trainer_payout_change_cutoff_day','25','Last IST calendar day for a verified payout change to apply to the current payroll month')
on conflict(key) do nothing;

alter table public.trainer_finance_change_requests
 add column if not exists effective_payroll_month text;
alter table public.trainer_finance_change_requests
 drop constraint if exists finance_request_effective_month_format;
alter table public.trainer_finance_change_requests
 add constraint finance_request_effective_month_format check(
  effective_payroll_month is null or effective_payroll_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

create table if not exists public.trainer_payout_instruction_versions (
 id uuid primary key default gen_random_uuid(),
 trainer_id uuid not null references public.trainers(id) on delete restrict,
 source_request_id uuid unique references public.trainer_finance_change_requests(id) on delete set null,
 effective_payroll_month text not null check(effective_payroll_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
 account_holder_name text not null default '',
 bank_name text not null default '',
 account_number text not null default '',
 ifsc text not null default '',
 upi_id text not null default '',
 pan text not null default '',
 preferred_payout_method text not null default 'bank',
 approved_by uuid references public.profiles(id) on delete set null,
 approved_at timestamptz not null default now()
);
create index if not exists trainer_payout_versions_by_month on public.trainer_payout_instruction_versions(trainer_id,effective_payroll_month desc,approved_at desc);
alter table public.trainer_payout_instruction_versions enable row level security;
revoke all on public.trainer_payout_instruction_versions from anon,authenticated;
grant select on public.trainer_payout_instruction_versions to authenticated;
drop policy if exists trainer_payout_versions_admin_read on public.trainer_payout_instruction_versions;
create policy trainer_payout_versions_admin_read on public.trainer_payout_instruction_versions
 for select to authenticated using(public.is_admin());

-- Preserve the existing verified payout record as a baseline version (only once).
insert into public.trainer_payout_instruction_versions
 (trainer_id,effective_payroll_month,account_holder_name,bank_name,account_number,ifsc,upi_id,pan,preferred_payout_method,approved_at)
select f.trainer_id,'1900-01',f.account_holder_name,f.bank_name,f.account_number,f.ifsc,f.upi_id,f.pan,f.preferred_payout_method,now()
from public.trainer_finance f
where not exists(select 1 from public.trainer_payout_instruction_versions v where v.trainer_id=f.trainer_id);

alter table public.trainer_payouts
 add column if not exists payout_instruction_version_id uuid references public.trainer_payout_instruction_versions(id) on delete restrict;
alter table public.trainer_payouts
 add column if not exists payout_details_locked_at timestamptz;
alter table public.trainer_payouts
 add column if not exists payout_account_holder_name text;
alter table public.trainer_payouts
 add column if not exists payout_bank_name text;
alter table public.trainer_payouts
 add column if not exists payout_account_number text;
alter table public.trainer_payouts
 add column if not exists payout_ifsc text;
alter table public.trainer_payouts
 add column if not exists payout_upi_id text;
alter table public.trainer_payouts
 add column if not exists payout_method text;

create or replace function public.review_trainer_finance_request(p_request_id uuid,p_action text,p_admin_note text default '')
returns void language plpgsql security definer set search_path=public as $$
declare r public.trainer_finance_change_requests%rowtype;
 target_status text; v_cutoff integer; v_month text; v_ist timestamp; v_lock boolean;
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 select * into r from public.trainer_finance_change_requests where id=p_request_id for update;
 if not found then raise exception 'Request not found'; end if;
 if r.status<>'pending' then raise exception 'This finance request has already been reviewed'; end if;
 if p_action='approve' then target_status:='approved';
 elsif p_action='reject' then target_status:='rejected';
 elsif p_action='request_correction' then target_status:='correction_requested';
 else raise exception 'Invalid review action'; end if;
 if target_status in ('rejected','correction_requested') and length(trim(coalesce(p_admin_note,'')))<5 then
  raise exception 'A meaningful correction/rejection reason is required'; end if;
 if target_status='approved' then
  select least(28,greatest(1,coalesce(nullif(value_text,'')::int,25)))
    into v_cutoff from public.system_settings where key='trainer_payout_change_cutoff_day';
  v_cutoff:=coalesce(v_cutoff,25);
  v_ist:=timezone('Asia/Kolkata',now());
  v_month:=to_char(v_ist,'YYYY-MM');
  select exists(select 1 from public.trainer_payouts where trainer_id=r.trainer_id
   and period_month=v_month and status in ('approved','paid')) into v_lock;
  if extract(day from v_ist)::int>v_cutoff or v_lock then
   v_month:=to_char(date_trunc('month',v_ist)+interval '1 month','YYYY-MM');
  end if;
  insert into public.trainer_payout_instruction_versions(
   trainer_id,source_request_id,effective_payroll_month,
   account_holder_name,bank_name,account_number,ifsc,upi_id,pan,preferred_payout_method,approved_by)
  values(r.trainer_id,r.id,v_month,r.account_holder_name,r.bank_name,r.account_number,r.ifsc,r.upi_id,r.pan,r.preferred_payout_method,auth.uid());
  -- Trainer Profile shows the latest approved bank details. Actual salary instructions
  -- are separately snapshotted from the version applicable to each payroll month.
  insert into public.trainer_finance(
   trainer_id,account_holder_name,bank_name,account_number,ifsc,upi_id,preferred_payout_method,pan,compliance_status,updated_at)
  values(r.trainer_id,r.account_holder_name,r.bank_name,r.account_number,r.ifsc,r.upi_id,r.preferred_payout_method,r.pan,'pending',now())
  on conflict(trainer_id) do update set
   account_holder_name=excluded.account_holder_name,bank_name=excluded.bank_name,
   account_number=excluded.account_number,ifsc=excluded.ifsc,upi_id=excluded.upi_id,
   preferred_payout_method=excluded.preferred_payout_method,pan=excluded.pan,updated_at=now();
 end if;
 update public.trainer_finance_change_requests set status=target_status,
  admin_note=coalesce(p_admin_note,''),reviewed_at=now(),reviewed_by=auth.uid(),
  effective_payroll_month=case when target_status='approved' then v_month else null end
 where id=p_request_id;
end $$;
grant execute on function public.review_trainer_finance_request(uuid,text,text) to authenticated;

-- Finalized netbanking payouts use an immutable snapshot applicable to THAT month.
-- A future trainer edit never mutates an approved or paid snapshot.
create or replace function public.lock_trainer_payout_instructions()
returns trigger language plpgsql security definer set search_path=public as $$
declare v public.trainer_payout_instruction_versions%rowtype;
begin
 if tg_op='UPDATE' and old.status='paid' then
  if new is distinct from old then raise exception 'Paid trainer payroll is locked. Use an audited adjustment'; end if;
  return new;
 end if;
 if tg_op='UPDATE' and old.status='approved' then
  if new.status not in ('approved','paid') then raise exception 'Approved payroll cannot be returned to draft'; end if;
  if new.gross_amount is distinct from old.gross_amount or new.adjustment_amount is distinct from old.adjustment_amount
     or new.payable_amount is distinct from old.payable_amount or new.period_month is distinct from old.period_month
     or new.trainer_id is distinct from old.trainer_id then
   raise exception 'Approved payroll amounts are locked'; end if;
 end if;
 if new.status in ('approved','paid') then
  if new.status='paid' and (nullif(trim(coalesce(new.payment_reference,'')),'') is null
    or new.paid_at is null) then raise exception 'Paid payroll requires netbanking transaction reference and payment date'; end if;
  if new.payout_instruction_version_id is null then
   select * into v from public.trainer_payout_instruction_versions
   where trainer_id=new.trainer_id and effective_payroll_month<=new.period_month
   order by effective_payroll_month desc,approved_at desc limit 1;
   if not found then raise exception 'No verified payout instructions for payroll month %',new.period_month; end if;
   new.payout_instruction_version_id:=v.id;
   new.payout_account_holder_name:=v.account_holder_name;
   new.payout_bank_name:=v.bank_name;
   new.payout_account_number:=v.account_number;
   new.payout_ifsc:=v.ifsc;
   new.payout_upi_id:=v.upi_id;
   new.payout_method:=v.preferred_payout_method;
   new.payout_details_locked_at:=now();
  elsif tg_op='UPDATE' and old.payout_instruction_version_id is not null then
   if new.payout_instruction_version_id is distinct from old.payout_instruction_version_id
    or new.payout_account_number is distinct from old.payout_account_number
    or new.payout_upi_id is distinct from old.payout_upi_id
    or new.payout_method is distinct from old.payout_method then
    raise exception 'Payout instructions are locked for this payroll month'; end if;
  end if;
 end if;
 return new;
end $$;
drop trigger if exists trainer_payout_instruction_lock_trg on public.trainer_payouts;
create trigger trainer_payout_instruction_lock_trg
before insert or update on public.trainer_payouts
for each row execute function public.lock_trainer_payout_instructions();
commit;
