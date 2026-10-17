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
