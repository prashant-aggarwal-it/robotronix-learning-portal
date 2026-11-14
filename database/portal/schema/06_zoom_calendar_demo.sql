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


