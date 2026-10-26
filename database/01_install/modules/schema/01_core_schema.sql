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
  referring_parent_name text not null default '' check (char_length(referring_parent_name) <= 120),
  data_consent boolean not null default false,
  portfolio_consent boolean not null default false,
  marketing_media_consent boolean not null default false,
  status text not null default 'new' check (status in ('draft','new','setup_pending','active')),
  assigned_course_id uuid references public.courses(id) on delete set null,
  assigned_trainer_id uuid references public.trainers(id) on delete set null,
  activated_student_id uuid references public.students(id) on delete set null,
  activated_enrollment_id uuid references public.enrollments(id) on delete set null,
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

