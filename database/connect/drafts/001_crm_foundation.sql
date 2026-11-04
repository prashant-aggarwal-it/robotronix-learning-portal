-- Robotronix Connect: Stage 1 relational foundation (DESIGN DRAFT, NOT APPLIED)
-- Source: feature/robotronix-connect-crm
-- REVIEW GATE: reconcile actual DEV schema and security before promoting into migration installer.
-- All CRM tables live in a private schema; no anon/authenticated privileges granted.
begin;
create schema if not exists crm;
revoke all on schema crm from public, anon, authenticated;

create table if not exists crm.people (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (length(trim(display_name)) > 0),
  lifecycle text not null default 'active' check (lifecycle in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists crm.contact_methods (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references crm.people(id) on delete restrict,
  kind text not null check (kind in ('mobile','phone','email','whatsapp','instagram','facebook','other')),
  normalized_value text not null check (length(trim(normalized_value)) > 0),
  display_value text not null,
  is_primary boolean not null default false,
  verified_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (person_id,kind,normalized_value)
);
create index if not exists crm_contact_lookup_idx on crm.contact_methods(kind,normalized_value) where active;
create unique index if not exists crm_primary_contact_method_idx on crm.contact_methods(person_id,kind) where active and is_primary;

create table if not exists crm.families (
  id uuid primary key default gen_random_uuid(),
  label text,
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now()
);
create table if not exists crm.family_people (
  family_id uuid not null references crm.families(id) on delete restrict,
  person_id uuid not null references crm.people(id) on delete restrict,
  family_role text not null check(family_role in ('guardian','learner','member')),
  is_primary_contact boolean not null default false,
  joined_at timestamptz not null default now(),
  ended_at timestamptz,
  primary key (family_id,person_id,family_role),
  check (ended_at is null or ended_at >= joined_at)
);
create unique index if not exists crm_family_primary_contact_idx on crm.family_people(family_id) where is_primary_contact and ended_at is null;
create table if not exists crm.learner_profiles (
  person_id uuid primary key references crm.people(id) on delete restrict,
  grade text,
  education_notes text,
  created_at timestamptz not null default now()
);
create table if not exists crm.guardian_learner (
  guardian_id uuid not null references crm.people(id) on delete restrict,
  learner_id uuid not null references crm.learner_profiles(person_id) on delete restrict,
  relation text not null check(relation in ('mother','father','guardian','grandparent','relative','other')),
  can_contact boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (guardian_id,learner_id),
  check (guardian_id <> learner_id)
);

create table if not exists crm.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check(length(trim(name)) > 0),
  kind text not null default 'other' check(kind in ('school','playschool','business','ngo','other')),
  parent_organization_id uuid references crm.organizations(id) on delete restrict,
  created_at timestamptz not null default now()
);
create table if not exists crm.organization_people (
  organization_id uuid not null references crm.organizations(id) on delete restrict,
  person_id uuid not null references crm.people(id) on delete restrict,
  job_title text,
  decision_role text,
  created_at timestamptz not null default now(),
  primary key (organization_id,person_id)
);

create table if not exists crm.pipelines (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  active boolean not null default true
);
create table if not exists crm.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references crm.pipelines(id) on delete restrict,
  code text not null,
  label text not null,
  sort_order integer not null,
  category text not null default 'open' check(category in ('open','won','lost')),
  unique(pipeline_id,code),
  unique(pipeline_id,sort_order),
  unique(id,pipeline_id)
);
create table if not exists crm.opportunities (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references crm.pipelines(id) on delete restrict,
  stage_id uuid not null,
  opportunity_type text not null check(opportunity_type in ('course','workshop','school_program','kit','other')),
  title text not null check(length(trim(title)) > 0),
  primary_contact_id uuid references crm.people(id) on delete restrict,
  organization_id uuid references crm.organizations(id) on delete restrict,
  assigned_profile_id uuid references public.profiles(id) on delete set null,
  expected_amount numeric(14,2) check(expected_amount >= 0),
  currency_code text not null default 'INR' check(currency_code ~ '^[A-Z]{3}$'),
  expected_close_date date,
  lost_reason text,
  version integer not null default 1 check(version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  foreign key (stage_id,pipeline_id) references crm.pipeline_stages(id,pipeline_id),
  check (primary_contact_id is not null or organization_id is not null)
);
create index if not exists crm_opportunity_work_idx on crm.opportunities(assigned_profile_id,stage_id,updated_at desc);
create table if not exists crm.opportunity_learners (
  opportunity_id uuid not null references crm.opportunities(id) on delete restrict,
  learner_id uuid not null references crm.learner_profiles(person_id) on delete restrict,
  primary key(opportunity_id,learner_id)
);
create table if not exists crm.inquiries (
  id uuid primary key default gen_random_uuid(),
  person_id uuid references crm.people(id) on delete restrict,
  opportunity_id uuid references crm.opportunities(id) on delete restrict,
  source_channel text not null,
  source_account text,
  provider_ref text,
  summary text,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index if not exists crm_inquiry_provider_unique on crm.inquiries(source_channel,source_account,provider_ref)
  where provider_ref is not null and source_account is not null;
create index if not exists crm_inquiries_person_idx on crm.inquiries(person_id,received_at desc);
create table if not exists crm.stage_history (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references crm.opportunities(id) on delete restrict,
  old_stage_id uuid references crm.pipeline_stages(id) on delete restrict,
  new_stage_id uuid not null references crm.pipeline_stages(id) on delete restrict,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  reason text,
  changed_at timestamptz not null default now()
);
create index if not exists crm_stage_history_opportunity_idx on crm.stage_history(opportunity_id,changed_at desc);
create table if not exists crm.tasks (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references crm.opportunities(id) on delete restrict,
  person_id uuid references crm.people(id) on delete restrict,
  assigned_profile_id uuid references public.profiles(id) on delete restrict,
  title text not null,
  due_at timestamptz,
  status text not null default 'open' check(status in ('open','in_progress','done','cancelled')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  check (opportunity_id is not null or person_id is not null),
  check (status <> 'done' or completed_at is not null)
);
create index if not exists crm_task_queue_idx on crm.tasks(assigned_profile_id,due_at) where status in ('open','in_progress');

-- Explicit, durable links to the existing learning-operations schema.
create table if not exists crm.person_portal_links (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references crm.people(id) on delete restrict,
  auth_profile_id uuid unique references public.profiles(id) on delete restrict,
  student_id uuid unique references public.students(id) on delete restrict,
  parent_id uuid unique references public.parents(id) on delete restrict,
  created_at timestamptz not null default now(),
  check(num_nonnulls(auth_profile_id,student_id,parent_id) = 1),
  unique(person_id,auth_profile_id),
  unique(person_id,student_id),
  unique(person_id,parent_id)
);
create table if not exists crm.opportunity_portal_links (
  opportunity_id uuid primary key references crm.opportunities(id) on delete restrict,
  demo_lead_id uuid unique references public.demo_leads(id) on delete restrict,
  demo_participant_id uuid unique references public.demo_session_participants(id) on delete restrict,
  enrollment_id uuid unique references public.enrollments(id) on delete restrict,
  created_at timestamptz not null default now(),
  check(num_nonnulls(demo_lead_id,demo_participant_id,enrollment_id) >= 1)
);

-- All tables intentionally private, accessed by reviewed service endpoints only.
-- Service-role privilege is granted explicitly; privileged API endpoints MUST authenticate/authorize actors.
do $$
declare t record;
begin
 for t in select tablename from pg_tables where schemaname='crm' loop
   execute format('alter table crm.%I enable row level security',t.tablename);
 end loop;
end $$;
grant usage on schema crm to service_role;
grant select,insert,update,delete on all tables in schema crm to service_role;
commit;
