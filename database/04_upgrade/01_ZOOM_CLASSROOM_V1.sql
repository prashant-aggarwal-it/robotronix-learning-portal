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

alter table public.zoom_meetings add column if not exists actual_started_at timestamptz;
alter table public.zoom_meetings add column if not exists actual_ended_at timestamptz;
alter table public.zoom_meetings add column if not exists recording_enabled boolean not null default false;
alter table public.zoom_meetings add column if not exists recording_status text not null default 'not_expected';
alter table public.zoom_meetings add column if not exists learner_recording_visible boolean not null default false;
alter table public.zoom_meetings add column if not exists recording_retention_days integer not null default 60;
alter table public.zoom_meetings add column if not exists last_error text;

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
  processing_error text
);

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
