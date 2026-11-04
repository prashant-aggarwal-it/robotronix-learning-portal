-- Robotronix Connect: Stage 1 relational foundation (DEV migration; no destructive legacy changes)
-- Source: feature/robotronix-connect-crm; preserve legacy operations until integration QA
-- Schema reconciled with Development public core and demo tables; apply to DEV only.
-- All CRM tables live in a private schema; no anon/authenticated privileges granted.
begin;

create table if not exists public.crm_people (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (length(trim(display_name)) > 0),
  lifecycle text not null default 'active' check (lifecycle in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.crm_contact_methods (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.crm_people(id) on delete restrict,
  kind text not null check (kind in ('mobile','phone','email','whatsapp','instagram','facebook','other')),
  normalized_value text not null check (length(trim(normalized_value)) > 0),
  display_value text not null,
  is_primary boolean not null default false,
  verified_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (person_id,kind,normalized_value)
);
create index if not exists crm_contact_lookup_idx on public.crm_contact_methods(kind,normalized_value) where active;
create unique index if not exists crm_primary_contact_method_idx on public.crm_contact_methods(person_id,kind) where active and is_primary;

create table if not exists public.crm_families (
  id uuid primary key default gen_random_uuid(),
  label text,
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now()
);
create table if not exists public.crm_family_people (
  family_id uuid not null references public.crm_families(id) on delete restrict,
  person_id uuid not null references public.crm_people(id) on delete restrict,
  family_role text not null check(family_role in ('guardian','learner','member')),
  is_primary_contact boolean not null default false,
  joined_at timestamptz not null default now(),
  ended_at timestamptz,
  primary key (family_id,person_id,family_role),
  check (ended_at is null or ended_at >= joined_at)
);
create unique index if not exists crm_family_primary_contact_idx on public.crm_family_people(family_id) where is_primary_contact and ended_at is null;
create table if not exists public.crm_learner_profiles (
  person_id uuid primary key references public.crm_people(id) on delete restrict,
  grade text,
  education_notes text,
  created_at timestamptz not null default now()
);
create table if not exists public.crm_guardian_learner (
  guardian_id uuid not null references public.crm_people(id) on delete restrict,
  learner_id uuid not null references public.crm_learner_profiles(person_id) on delete restrict,
  relation text not null check(relation in ('mother','father','guardian','grandparent','relative','other')),
  can_contact boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (guardian_id,learner_id),
  check (guardian_id <> learner_id)
);

create table if not exists public.crm_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check(length(trim(name)) > 0),
  kind text not null default 'other' check(kind in ('school','playschool','business','ngo','other')),
  parent_organization_id uuid references public.crm_organizations(id) on delete restrict,
  created_at timestamptz not null default now()
);
create table if not exists public.crm_organization_people (
  organization_id uuid not null references public.crm_organizations(id) on delete restrict,
  person_id uuid not null references public.crm_people(id) on delete restrict,
  job_title text,
  decision_role text,
  created_at timestamptz not null default now(),
  primary key (organization_id,person_id)
);

create table if not exists public.crm_pipelines (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  active boolean not null default true
);
create table if not exists public.crm_pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references public.crm_pipelines(id) on delete restrict,
  code text not null,
  label text not null,
  sort_order integer not null,
  category text not null default 'open' check(category in ('open','won','lost')),
  unique(pipeline_id,code),
  unique(pipeline_id,sort_order),
  unique(id,pipeline_id)
);
create table if not exists public.crm_opportunities (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references public.crm_pipelines(id) on delete restrict,
  stage_id uuid not null,
  opportunity_type text not null check(opportunity_type in ('course','workshop','school_program','kit','other')),
  title text not null check(length(trim(title)) > 0),
  primary_contact_id uuid references public.crm_people(id) on delete restrict,
  organization_id uuid references public.crm_organizations(id) on delete restrict,
  assigned_profile_id uuid references public.profiles(id) on delete set null,
  expected_amount numeric(14,2) check(expected_amount >= 0),
  currency_code text not null default 'INR' check(currency_code ~ '^[A-Z]{3}$'),
  expected_close_date date,
  lost_reason text,
  version integer not null default 1 check(version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  foreign key (stage_id,pipeline_id) references public.crm_pipeline_stages(id,pipeline_id),
  check (primary_contact_id is not null or organization_id is not null)
);
create index if not exists crm_opportunity_work_idx on public.crm_opportunities(assigned_profile_id,stage_id,updated_at desc);
create table if not exists public.crm_opportunity_learners (
  opportunity_id uuid not null references public.crm_opportunities(id) on delete restrict,
  learner_id uuid not null references public.crm_learner_profiles(person_id) on delete restrict,
  primary key(opportunity_id,learner_id)
);
create table if not exists public.crm_inquiries (
  id uuid primary key default gen_random_uuid(),
  person_id uuid references public.crm_people(id) on delete restrict,
  opportunity_id uuid references public.crm_opportunities(id) on delete restrict,
  source_channel text not null,
  source_account text,
  provider_ref text,
  summary text,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index if not exists crm_inquiry_provider_unique on public.crm_inquiries(source_channel,source_account,provider_ref)
  where provider_ref is not null and source_account is not null;
create index if not exists crm_inquiries_person_idx on public.crm_inquiries(person_id,received_at desc);
create table if not exists public.crm_stage_history (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.crm_opportunities(id) on delete restrict,
  old_stage_id uuid references public.crm_pipeline_stages(id) on delete restrict,
  new_stage_id uuid not null references public.crm_pipeline_stages(id) on delete restrict,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  reason text,
  changed_at timestamptz not null default now()
);
create index if not exists crm_stage_history_opportunity_idx on public.crm_stage_history(opportunity_id,changed_at desc);
create table if not exists public.crm_tasks (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references public.crm_opportunities(id) on delete restrict,
  person_id uuid references public.crm_people(id) on delete restrict,
  assigned_profile_id uuid references public.profiles(id) on delete restrict,
  title text not null,
  due_at timestamptz,
  status text not null default 'open' check(status in ('open','in_progress','done','cancelled')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  check (opportunity_id is not null or person_id is not null),
  check (status <> 'done' or completed_at is not null)
);
create index if not exists crm_task_queue_idx on public.crm_tasks(assigned_profile_id,due_at) where status in ('open','in_progress');

-- Explicit, durable links to the existing learning-operations schema.
create table if not exists public.crm_person_portal_links (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.crm_people(id) on delete restrict,
  auth_profile_id uuid unique references public.profiles(id) on delete restrict,
  student_id uuid unique references public.students(id) on delete restrict,
  parent_id uuid unique references public.parents(id) on delete restrict,
  created_at timestamptz not null default now(),
  check(num_nonnulls(auth_profile_id,student_id,parent_id) = 1),
  unique(person_id,auth_profile_id),
  unique(person_id,student_id),
  unique(person_id,parent_id)
);
create table if not exists public.crm_opportunity_demo_links (
  opportunity_id uuid not null references public.crm_opportunities(id) on delete restrict,
  demo_lead_id uuid not null references public.demo_leads(id) on delete restrict,
  primary key (opportunity_id, demo_lead_id)
);
create table if not exists public.crm_opportunity_participant_links (
  opportunity_id uuid not null references public.crm_opportunities(id) on delete restrict,
  participant_id uuid not null unique references public.demo_session_participants(id) on delete restrict,
  primary key (opportunity_id, participant_id)
);
create table if not exists public.crm_opportunity_enrollment_links (
  opportunity_id uuid not null references public.crm_opportunities(id) on delete restrict,
  enrollment_id uuid not null unique references public.enrollments(id) on delete restrict,
  linked_at timestamptz not null default now(),
  primary key (opportunity_id, enrollment_id)
);

-- Additional CRM workflows and multi-channel event architecture.
create table if not exists public.crm_activities (
 id uuid primary key default gen_random_uuid(),
 person_id uuid references public.crm_people(id) on delete restrict,
 opportunity_id uuid references public.crm_opportunities(id) on delete restrict,
 actor_profile_id uuid references public.profiles(id) on delete set null,
 activity_type text not null check(activity_type in ('call','meeting','message','email','note','trial','other')),
 outcome text, summary text,
 happened_at timestamptz not null default now(), created_at timestamptz not null default now(),
 check(person_id is not null or opportunity_id is not null)
);
create index if not exists crm_activities_opportunity_idx on public.crm_activities(opportunity_id,happened_at desc);

create table if not exists public.crm_channel_accounts (
 id uuid primary key default gen_random_uuid(),
 provider text not null check(provider in ('whatsapp','instagram','facebook','website','email','telephony','manual','other')),
 account_external_id text, label text not null,
 status text not null default 'inactive' check(status in ('inactive','pending','active','disabled')),
 created_at timestamptz not null default now(),
 unique(provider,account_external_id)
);
create table if not exists public.crm_conversations (
 id uuid primary key default gen_random_uuid(),
 channel_account_id uuid not null references public.crm_channel_accounts(id) on delete restrict,
 person_id uuid references public.crm_people(id) on delete restrict,
 provider_thread_id text,
 status text not null default 'open' check(status in ('open','pending','closed')),
 assigned_profile_id uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists crm_conversation_external_idx on public.crm_conversations(channel_account_id,provider_thread_id)
 where provider_thread_id is not null;

create table if not exists public.crm_messages (
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references public.crm_conversations(id) on delete restrict,
 provider_message_id text,
 direction text not null check(direction in ('inbound','outbound')),
 message_type text not null default 'text',
 body text,
 delivery_status text not null default 'received' check(delivery_status in ('queued','received','sent','delivered','read','failed')),
 occurred_at timestamptz not null default now(),
 created_at timestamptz not null default now()
);
create unique index if not exists crm_message_external_idx on public.crm_messages(conversation_id,provider_message_id)
 where provider_message_id is not null;
create index if not exists crm_messages_timeline_idx on public.crm_messages(conversation_id,occurred_at desc);

create table if not exists public.crm_webhook_receipts (
 id uuid primary key default gen_random_uuid(),
 channel_account_id uuid not null references public.crm_channel_accounts(id) on delete restrict,
 provider_event_id text not null,
 event_type text not null,
 payload jsonb not null,
 received_at timestamptz not null default now(),
 processed_at timestamptz,
 attempts integer not null default 0 check(attempts >= 0),
 status text not null default 'pending' check(status in ('pending','processed','retry','failed')),
 error_summary text,
 unique(channel_account_id,provider_event_id)
);
create index if not exists crm_receipts_pending_idx on public.crm_webhook_receipts(status,received_at)
 where status in ('pending','retry');

create table if not exists public.crm_outbound_messages (
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references public.crm_conversations(id) on delete restrict,
 idempotency_key text not null unique,
 body text not null,
 status text not null default 'queued' check(status in ('queued','sending','sent','failed','cancelled')),
 attempt_count integer not null default 0 check(attempt_count >= 0),
 next_attempt_at timestamptz,
 sent_message_id uuid references public.crm_messages(id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists crm_outbox_queue_idx on public.crm_outbound_messages(status,next_attempt_at)
 where status in ('queued','failed');

create table if not exists public.crm_consent_events (
 id uuid primary key default gen_random_uuid(),
 person_id uuid not null references public.crm_people(id) on delete restrict,
 channel text not null check(channel in ('whatsapp','sms','email','phone','social','other')),
 purpose text not null check(purpose in ('marketing','service','trial_reminder')),
 decision text not null check(decision in ('granted','withdrawn')),
 recorded_at timestamptz not null default now(),
 source text not null,
 actor_profile_id uuid references public.profiles(id) on delete set null
);
create index if not exists crm_consent_latest_idx on public.crm_consent_events(person_id,channel,purpose,recorded_at desc);

create table if not exists public.crm_campaigns (
 id uuid primary key default gen_random_uuid(),
 name text not null, source text not null,
 external_campaign_id text, created_at timestamptz not null default now()
);
create table if not exists public.crm_attribution_touchpoints (
 id uuid primary key default gen_random_uuid(),
 person_id uuid references public.crm_people(id) on delete restrict,
 opportunity_id uuid references public.crm_opportunities(id) on delete restrict,
 inquiry_id uuid references public.crm_inquiries(id) on delete restrict,
 campaign_id uuid references public.crm_campaigns(id) on delete set null,
 source text not null, medium text, utm_campaign text,
 occurred_at timestamptz not null default now(),
 check(person_id is not null or opportunity_id is not null)
);
create index if not exists crm_attribution_opportunity_idx on public.crm_attribution_touchpoints(opportunity_id,occurred_at);

-- RLS and explicit grants. Browser roles cannot directly access CRM records.
do $$
declare t record;
begin
 for t in select tablename from pg_tables where schemaname='public' and tablename like 'crm_%' loop
   execute format('alter table public.%I enable row level security',t.tablename);
   execute format('revoke all on table public.%I from public, anon, authenticated',t.tablename);
   execute format('grant select,insert,update,delete on table public.%I to service_role',t.tablename);
 end loop;
end $$;
commit;
