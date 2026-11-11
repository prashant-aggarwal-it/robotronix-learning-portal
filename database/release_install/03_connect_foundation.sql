-- Robotronix PRODUCTION INSTALL BUNDLE: 03 Connect private foundation, workspaces, enquiries, intake and automation.
-- Fresh Connect installation only, on same Supabase project as Portal Auth.
-- No legacy-prototype DROP and no pg_cron scheduling. Run after Tasks 01 and 02.
BEGIN;
DO $guard$ BEGIN IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='connect') THEN RAISE EXCEPTION 'Connect schema already exists; refusing repeat installation'; END IF; END $guard$;

-- ===== SOURCE: database/connect/saas/01_connect_independent_schema.sql =====
-- Connect SaaS v2: independent multi-tenant foundation.
-- Valid on a separate Connect Supabase project; NO Learning Portal tables referenced.
-- No sample tenants or hard-coded Robotronix records. PostgreSQL 15+.

create schema if not exists connect;
revoke all on schema connect from public, anon, authenticated;
grant usage on schema connect to service_role;

create table connect.tenants (
 id uuid primary key default gen_random_uuid(),
 slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 name text not null check(length(trim(name)) > 0),
 status text not null default 'active' check(status in ('trial','active','suspended','closed')),
 timezone text not null default 'Asia/Kolkata',
 default_currency text not null default 'INR' check(default_currency ~ '^[A-Z]{3}$'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table connect.memberships (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references connect.tenants(id) on delete restrict,
 user_id uuid not null references auth.users(id) on delete restrict,
 role text not null check(role in ('owner','admin','manager','counsellor','viewer')),
 status text not null default 'invited' check(status in ('invited','active','disabled')),
 created_at timestamptz not null default now(),
 unique(tenant_id,user_id), unique(tenant_id,id)
);
create index connect_memberships_user_idx on connect.memberships(user_id,tenant_id) where status='active';

create table connect.people (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references connect.tenants(id) on delete restrict,
 full_name text not null check(length(trim(full_name))>0),
 status text not null default 'active' check(status in ('active','archived')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(tenant_id,id)
);
create index connect_people_name_idx on connect.people(tenant_id,lower(full_name));
create table connect.person_roles (
 tenant_id uuid not null references connect.tenants(id) on delete restrict,
 person_id uuid not null,role text not null check(role in ('learner','guardian','staff','customer','contact','other')),
 primary key(tenant_id,person_id,role),
 foreign key(tenant_id,person_id) references connect.people(tenant_id,id) on delete restrict
);
create table connect.contact_methods (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references connect.tenants(id) on delete restrict,
 person_id uuid not null, kind text not null check(kind in ('mobile','phone','whatsapp','email','social','other')),
 normalized_value text not null check(length(trim(normalized_value))>0),
 display_value text not null,is_primary boolean not null default false,
 verified_at timestamptz,created_at timestamptz not null default now(),
 foreign key(tenant_id,person_id) references connect.people(tenant_id,id) on delete restrict,
 unique(tenant_id,id),unique(tenant_id,person_id,kind,normalized_value)
);
create index connect_contact_lookup_idx on connect.contact_methods(tenant_id,kind,normalized_value);
create unique index connect_primary_contact_idx on connect.contact_methods(tenant_id,person_id,kind) where is_primary;

create table connect.households (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references connect.tenants(id) on delete restrict,
 display_name text, created_at timestamptz not null default now(),unique(tenant_id,id)
);
create table connect.household_members (
 tenant_id uuid not null references connect.tenants(id) on delete restrict,
 household_id uuid not null,person_id uuid not null,relation text not null,
 is_primary_contact boolean not null default false,
 foreign key(tenant_id,household_id) references connect.households(tenant_id,id) on delete restrict,
 foreign key(tenant_id,person_id) references connect.people(tenant_id,id) on delete restrict,
 primary key(tenant_id,household_id,person_id)
);
create unique index connect_household_primary_idx on connect.household_members(tenant_id,household_id) where is_primary_contact;
create table connect.person_relations (
 tenant_id uuid not null references connect.tenants(id) on delete restrict,
 from_person_id uuid not null,to_person_id uuid not null,
 relationship text not null check(length(trim(relationship))>0),
 created_at timestamptz not null default now(),
 primary key(tenant_id,from_person_id,to_person_id,relationship),
 check(from_person_id<>to_person_id),
 foreign key(tenant_id,from_person_id) references connect.people(tenant_id,id) on delete restrict,
 foreign key(tenant_id,to_person_id) references connect.people(tenant_id,id) on delete restrict
);
create table connect.organizations (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references connect.tenants(id) on delete restrict,
 name text not null check(length(trim(name))>0),category text not null default 'other',
 created_at timestamptz not null default now(),unique(tenant_id,id)
);
create table connect.organization_contacts (
 tenant_id uuid not null references connect.tenants(id) on delete restrict,
 organization_id uuid not null,person_id uuid not null,position_title text,
 primary key(tenant_id,organization_id,person_id),
 foreign key(tenant_id,organization_id) references connect.organizations(tenant_id,id) on delete restrict,
 foreign key(tenant_id,person_id) references connect.people(tenant_id,id) on delete restrict
);
create table connect.programs (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references connect.tenants(id) on delete restrict,
 name text not null,code text,active boolean not null default true,
 unique(tenant_id,id),unique(tenant_id,code)
);
create table connect.pipelines (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references connect.tenants(id) on delete restrict,
 name text not null,kind text not null default 'admissions',active boolean not null default true,
 unique(tenant_id,id)
);
create table connect.pipeline_stages (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,pipeline_id uuid not null,
 name text not null,sort_order int not null, outcome text not null default 'open' check(outcome in ('open','won','lost')),
 foreign key(tenant_id,pipeline_id) references connect.pipelines(tenant_id,id) on delete restrict,
 unique(tenant_id,id),unique(tenant_id,pipeline_id,id),unique(tenant_id,pipeline_id,sort_order)
);
create table connect.opportunities (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references connect.tenants(id) on delete restrict,
 pipeline_id uuid not null,stage_id uuid not null,
 title text not null check(length(trim(title))>0),
 contact_id uuid,organization_id uuid,owner_membership_id uuid,
 expected_value numeric(14,2) check(expected_value>=0),
 currency text not null default 'INR' check(currency ~ '^[A-Z]{3}$'),
 closed_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 version integer not null default 1 check(version>0),
 foreign key(tenant_id,pipeline_id) references connect.pipelines(tenant_id,id) on delete restrict,
 foreign key(tenant_id,pipeline_id,stage_id) references connect.pipeline_stages(tenant_id,pipeline_id,id) on delete restrict,
 foreign key(tenant_id,contact_id) references connect.people(tenant_id,id) on delete restrict,
 foreign key(tenant_id,organization_id) references connect.organizations(tenant_id,id) on delete restrict,
 foreign key(tenant_id,owner_membership_id) references connect.memberships(tenant_id,id) on delete restrict,
 check(contact_id is not null or organization_id is not null),unique(tenant_id,id),unique(tenant_id,pipeline_id,id)
);
create index connect_opportunities_board_idx on connect.opportunities(tenant_id,pipeline_id,stage_id,updated_at desc);
create table connect.opportunity_people (
 tenant_id uuid not null references connect.tenants(id) on delete restrict,
 opportunity_id uuid not null,person_id uuid not null,role text not null default 'learner',
 primary key(tenant_id,opportunity_id,person_id,role),
 foreign key(tenant_id,opportunity_id) references connect.opportunities(tenant_id,id) on delete restrict,
 foreign key(tenant_id,person_id) references connect.people(tenant_id,id) on delete restrict
);
create table connect.opportunity_programs (
 tenant_id uuid not null references connect.tenants(id) on delete restrict,opportunity_id uuid not null,program_id uuid not null,
 primary key(tenant_id,opportunity_id,program_id),
 foreign key(tenant_id,opportunity_id) references connect.opportunities(tenant_id,id) on delete restrict,
 foreign key(tenant_id,program_id) references connect.programs(tenant_id,id) on delete restrict
);
create table connect.stage_events (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,
 opportunity_id uuid not null,pipeline_id uuid not null,from_stage_id uuid,to_stage_id uuid not null,
 changed_by_membership_id uuid,changed_at timestamptz not null default now(),note text,
 foreign key(tenant_id,pipeline_id,opportunity_id) references connect.opportunities(tenant_id,pipeline_id,id) on delete restrict,
 foreign key(tenant_id,pipeline_id,from_stage_id) references connect.pipeline_stages(tenant_id,pipeline_id,id) on delete restrict,
 foreign key(tenant_id,pipeline_id,to_stage_id) references connect.pipeline_stages(tenant_id,pipeline_id,id) on delete restrict,
 foreign key(tenant_id,changed_by_membership_id) references connect.memberships(tenant_id,id) on delete restrict,
 unique(tenant_id,id)
);
create index connect_stage_events_idx on connect.stage_events(tenant_id,opportunity_id,changed_at desc);
create table connect.tasks (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references connect.tenants(id) on delete restrict,
 opportunity_id uuid,person_id uuid,assignee_membership_id uuid,
 title text not null,status text not null default 'open' check(status in ('open','done','cancelled')),
 due_at timestamptz,completed_at timestamptz,created_at timestamptz not null default now(),
 foreign key(tenant_id,opportunity_id) references connect.opportunities(tenant_id,id) on delete restrict,
 foreign key(tenant_id,person_id) references connect.people(tenant_id,id) on delete restrict,
 foreign key(tenant_id,assignee_membership_id) references connect.memberships(tenant_id,id) on delete restrict,
 check(opportunity_id is not null or person_id is not null),
 unique(tenant_id,id)
);
create index connect_task_queue_idx on connect.tasks(tenant_id,assignee_membership_id,due_at) where status='open';
create table connect.activities (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references connect.tenants(id) on delete restrict,
 opportunity_id uuid,person_id uuid,actor_membership_id uuid,
 kind text not null check(kind in ('call','note','email','message','meeting','trial','other')),
 summary text,occurred_at timestamptz not null default now(),
 foreign key(tenant_id,opportunity_id) references connect.opportunities(tenant_id,id) on delete restrict,
 foreign key(tenant_id,person_id) references connect.people(tenant_id,id) on delete restrict,
 foreign key(tenant_id,actor_membership_id) references connect.memberships(tenant_id,id) on delete restrict,
 check(opportunity_id is not null or person_id is not null),
 unique(tenant_id,id)
);
create index connect_activity_timeline_idx on connect.activities(tenant_id,person_id,occurred_at desc);
create table connect.appointments (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references connect.tenants(id) on delete restrict,
 opportunity_id uuid,person_id uuid,owner_membership_id uuid,
 kind text not null default 'counselling' check(kind in ('counselling','demo','trial','meeting','other')),
 title text not null,starts_at timestamptz not null,ends_at timestamptz not null,
 status text not null default 'scheduled' check(status in ('scheduled','completed','cancelled','no_show')),
 external_calendar_ref text,created_at timestamptz not null default now(),
 check(ends_at>starts_at),
 foreign key(tenant_id,opportunity_id) references connect.opportunities(tenant_id,id) on delete restrict,
 foreign key(tenant_id,person_id) references connect.people(tenant_id,id) on delete restrict,
 foreign key(tenant_id,owner_membership_id) references connect.memberships(tenant_id,id) on delete restrict,
 unique(tenant_id,id)
);
create index connect_appointments_upcoming_idx on connect.appointments(tenant_id,starts_at);

create table connect.channel_accounts (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references connect.tenants(id) on delete restrict,
 provider text not null,external_account_id text,display_name text not null,
 status text not null default 'inactive' check(status in ('inactive','active','disabled')),
 unique(tenant_id,id),unique(tenant_id,provider,external_account_id)
);
create table connect.conversations (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references connect.tenants(id) on delete restrict,
 channel_account_id uuid not null,person_id uuid,external_thread_id text,
 status text not null default 'open' check(status in ('open','pending','closed')),
 created_at timestamptz not null default now(),unique(tenant_id,id),
 foreign key(tenant_id,channel_account_id) references connect.channel_accounts(tenant_id,id) on delete restrict,
 foreign key(tenant_id,person_id) references connect.people(tenant_id,id) on delete restrict
);
create unique index connect_conversation_external_idx on connect.conversations(tenant_id,channel_account_id,external_thread_id) where external_thread_id is not null;
create table connect.messages (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references connect.tenants(id) on delete restrict,
 conversation_id uuid not null,external_message_id text,
 direction text not null check(direction in ('inbound','outbound')),body text,
 delivery_status text not null default 'received',
 occurred_at timestamptz not null default now(),
 foreign key(tenant_id,conversation_id) references connect.conversations(tenant_id,id) on delete restrict,
 unique(tenant_id,id)
);
create unique index connect_message_idempotency_idx on connect.messages(tenant_id,conversation_id,external_message_id) where external_message_id is not null;
create index connect_message_history_idx on connect.messages(tenant_id,conversation_id,occurred_at desc);
create table connect.webhook_receipts (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references connect.tenants(id) on delete restrict,
 channel_account_id uuid not null,external_event_id text not null,
 event_type text not null,payload jsonb not null,
 status text not null default 'pending' check(status in ('pending','processed','retry','failed')),
 attempts int not null default 0 check(attempts>=0),
 received_at timestamptz not null default now(),processed_at timestamptz,
 foreign key(tenant_id,channel_account_id) references connect.channel_accounts(tenant_id,id) on delete restrict,
 unique(tenant_id,channel_account_id,external_event_id)
);
create table connect.outbox (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references connect.tenants(id) on delete restrict,
 conversation_id uuid not null,idempotency_key text not null,
 body text not null,status text not null default 'queued' check(status in ('queued','sending','sent','failed','cancelled')),
 attempts int not null default 0 check(attempts>=0),next_attempt_at timestamptz,
 foreign key(tenant_id,conversation_id) references connect.conversations(tenant_id,id) on delete restrict,
 unique(tenant_id,idempotency_key)
);
create index connect_outbox_pending_idx on connect.outbox(tenant_id,status,next_attempt_at) where status in ('queued','failed');
create table connect.inquiries (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references connect.tenants(id) on delete restrict,
 person_id uuid,opportunity_id uuid,channel_account_id uuid,external_event_id text,
 source text not null,summary text,received_at timestamptz not null default now(),
 foreign key(tenant_id,person_id) references connect.people(tenant_id,id) on delete restrict,
 foreign key(tenant_id,opportunity_id) references connect.opportunities(tenant_id,id) on delete restrict,
 foreign key(tenant_id,channel_account_id) references connect.channel_accounts(tenant_id,id) on delete restrict,
 unique(tenant_id,id)
);
create unique index connect_inquiry_external_idx on connect.inquiries(tenant_id,channel_account_id,external_event_id) where external_event_id is not null;
create table connect.consent_events (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references connect.tenants(id) on delete restrict,
 person_id uuid not null,channel text not null,purpose text not null,decision text not null check(decision in ('granted','withdrawn')),
 source text not null,recorded_at timestamptz not null default now(),
 foreign key(tenant_id,person_id) references connect.people(tenant_id,id) on delete restrict
);
create index connect_consent_latest_idx on connect.consent_events(tenant_id,person_id,channel,purpose,recorded_at desc);

create table connect.campaigns (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references connect.tenants(id) on delete restrict,
 name text not null,source text,external_campaign_id text,unique(tenant_id,id)
);
create table connect.attribution (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references connect.tenants(id) on delete restrict,
 person_id uuid,opportunity_id uuid,campaign_id uuid,
 source text not null,medium text,occurred_at timestamptz not null default now(),
 foreign key(tenant_id,person_id) references connect.people(tenant_id,id) on delete restrict,
 foreign key(tenant_id,opportunity_id) references connect.opportunities(tenant_id,id) on delete restrict,
 foreign key(tenant_id,campaign_id) references connect.campaigns(tenant_id,id) on delete restrict,
 check(person_id is not null or opportunity_id is not null)
);
create table connect.integration_connections (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references connect.tenants(id) on delete restrict,
 provider text not null,external_tenant_id text,display_name text not null,
 status text not null default 'inactive' check(status in ('inactive','active','disabled')),
 created_at timestamptz not null default now(),
 unique(tenant_id,id),unique(tenant_id,provider,external_tenant_id)
);
create table connect.external_links (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references connect.tenants(id) on delete restrict,
 integration_id uuid not null,
 entity_kind text not null check(entity_kind in ('person','opportunity','appointment','program','organization')),
 local_entity_id uuid not null,external_entity_id text not null,
 foreign key(tenant_id,integration_id) references connect.integration_connections(tenant_id,id) on delete restrict,
 unique(tenant_id,integration_id,entity_kind,local_entity_id),
 unique(tenant_id,integration_id,entity_kind,external_entity_id)
);
create table connect.audit_events (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references connect.tenants(id) on delete restrict,
 actor_membership_id uuid,event_type text not null,entity_type text not null,entity_id uuid,
 metadata jsonb not null default '{}'::jsonb,occurred_at timestamptz not null default now(),
 foreign key(tenant_id,actor_membership_id) references connect.memberships(tenant_id,id) on delete restrict
);
create index connect_audit_timeline_idx on connect.audit_events(tenant_id,occurred_at desc);
create table connect.plans (
 id uuid primary key default gen_random_uuid(),code text not null unique,name text not null,active boolean not null default true
);
create table connect.entitlements (
 plan_id uuid not null references connect.plans(id) on delete restrict,
 feature_key text not null,enabled boolean not null default false,limit_value int,
 primary key(plan_id,feature_key),check(limit_value is null or limit_value>=0)
);
create table connect.subscriptions (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references connect.tenants(id) on delete restrict,
 plan_id uuid not null references connect.plans(id) on delete restrict,
 status text not null check(status in ('trial','active','past_due','cancelled','expired')),
 starts_at timestamptz not null default now(),ends_at timestamptz,
 external_billing_ref text,created_at timestamptz not null default now(),
 check(ends_at is null or ends_at>starts_at)
);
create unique index connect_one_current_subscription_idx on connect.subscriptions(tenant_id) where status in ('trial','active','past_due');

-- Explicit RLS defense in depth: server APIs only until reviewed tenant RLS policies are added.
-- This is secure against direct client table access, not yet a complete end-user authorization layer.
do $connect_security$
declare t record;
begin
 for t in select tablename from pg_tables where schemaname='connect' loop
  execute format('alter table connect.%I enable row level security',t.tablename);
  execute format('revoke all on table connect.%I from public, anon, authenticated',t.tablename);
  execute format('grant select,insert,update,delete on table connect.%I to service_role',t.tablename);
 end loop;
end
$connect_security$;


-- ===== SOURCE: database/connect/saas/03_harden_canonical_model_dev.sql =====
-- Refine the empty standalone DEV schema to match the canonical fresh install.

do $preflight$
begin
 if exists(select 1 from connect.people limit 1) or exists(select 1 from connect.opportunities limit 1)
 or exists(select 1 from connect.stage_events limit 1) then
  raise exception 'Refusing empty-schema refinement because business rows exist';
 end if;
end $preflight$;
alter table connect.people drop column kind;
create table connect.person_roles (
 tenant_id uuid not null references connect.tenants(id) on delete restrict,
 person_id uuid not null,
 role text not null check(role in ('learner','guardian','staff','customer','contact','other')),
 primary key(tenant_id,person_id,role),
 foreign key(tenant_id,person_id) references connect.people(tenant_id,id) on delete restrict
);
alter table connect.person_roles enable row level security;
revoke all on connect.person_roles from public,anon,authenticated;
grant select,insert,update,delete on connect.person_roles to service_role;
alter table connect.opportunities drop column state;
alter table connect.opportunities add constraint connect_opportunities_pipeline_unique unique(tenant_id,pipeline_id,id);
alter table connect.stage_events add column pipeline_id uuid not null;
alter table connect.stage_events drop constraint stage_events_tenant_id_opportunity_id_fkey;
alter table connect.stage_events drop constraint stage_events_tenant_id_from_stage_id_fkey;
alter table connect.stage_events drop constraint stage_events_tenant_id_to_stage_id_fkey;
alter table connect.stage_events add constraint connect_stage_event_opportunity_fkey foreign key(tenant_id,pipeline_id,opportunity_id) references connect.opportunities(tenant_id,pipeline_id,id) on delete restrict;
alter table connect.stage_events add constraint connect_stage_event_from_stage_fkey foreign key(tenant_id,pipeline_id,from_stage_id) references connect.pipeline_stages(tenant_id,pipeline_id,id) on delete restrict;
alter table connect.stage_events add constraint connect_stage_event_to_stage_fkey foreign key(tenant_id,pipeline_id,to_stage_id) references connect.pipeline_stages(tenant_id,pipeline_id,id) on delete restrict;


-- ===== SOURCE: database/connect/saas/05_workspace_security.sql =====
-- Connect Phase 2A — Workspace and membership security.
-- Backend-only RPC contract; do not expose connect schema in Supabase Data API.
-- Default function EXECUTE grants are revoked; only server-side service_role can invoke.

create table connect.invitations (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references connect.tenants(id) on delete restrict,
 email text not null check(email = lower(btrim(email)) and position('@' in email)>1),
 role text not null check(role in ('admin','manager','counsellor','viewer')),
 token_sha256 text not null unique check(length(token_sha256)=64),
 invited_by uuid not null references auth.users(id) on delete restrict,
 expires_at timestamptz not null,
 accepted_at timestamptz,
 revoked_at timestamptz,
 created_at timestamptz not null default now(),
 unique(tenant_id,id),
 check(expires_at>created_at)
);
create unique index connect_pending_invite_idx
on connect.invitations(tenant_id,email)
where accepted_at is null and revoked_at is null;
alter table connect.invitations enable row level security;
revoke all on connect.invitations from public,anon,authenticated;
grant select,insert,update,delete on connect.invitations to service_role;

create or replace function public.connect_create_workspace(
 p_actor_id uuid, p_slug text, p_name text
) returns uuid language plpgsql security invoker set search_path = ''
as $fn$
declare v_tenant uuid;
begin
 -- The server validates p_actor_id with auth.getUser(token).
 -- A membership FK to auth.users enforces that the user exists.
 if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or
    p_name is null or length(btrim(p_name)) not between 2 and 120 then
  raise exception 'Invalid workspace details' using errcode='22023';
 end if;
 insert into connect.tenants(slug,name) values(p_slug,btrim(p_name)) returning id into v_tenant;
 insert into connect.memberships(tenant_id,user_id,role,status)
 values(v_tenant,p_actor_id,'owner','active');
 return v_tenant;
end $fn$;

create or replace function public.connect_my_workspaces(p_actor_id uuid)
returns table(tenant_id uuid, slug text, workspace_name text, tenant_status text, membership_role text)
language sql stable security invoker set search_path = ''
as $fn$
 select t.id,t.slug,t.name,t.status,m.role
 from connect.memberships m
 join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.status='active' and t.status in ('active','trial')
 order by t.name
$fn$;

create or replace function public.connect_workspace_members(
 p_actor_id uuid, p_tenant_id uuid
) returns table(member_id uuid,member_user_id uuid,member_role text,member_status text,member_created_at timestamptz)
language plpgsql stable security invoker set search_path = ''
as $fn$
begin
 if not exists (
   select 1 from connect.memberships m join connect.tenants t on t.id=m.tenant_id
   where m.tenant_id=p_tenant_id and m.user_id=p_actor_id and m.status='active'
     and m.role in ('owner','admin','manager') and t.status in ('active','trial')
 ) then raise exception 'Workspace access denied' using errcode='42501'; end if;
 return query
 select m.id,m.user_id,m.role,m.status,m.created_at
 from connect.memberships m where m.tenant_id=p_tenant_id order by m.created_at;
end $fn$;

create or replace function public.connect_create_invitation(
 p_actor_id uuid,p_tenant_id uuid,p_email text,p_role text,p_token_sha256 text
) returns uuid language plpgsql security invoker set search_path = ''
as $fn$
declare v_id uuid;
begin
 if not exists (
  select 1 from connect.memberships m join connect.tenants t on t.id=m.tenant_id
  where m.tenant_id=p_tenant_id and m.user_id=p_actor_id and m.status='active'
  and m.role in ('owner','admin') and t.status in ('active','trial')
 ) then raise exception 'Workspace administration required' using errcode='42501'; end if;
 if p_role not in ('admin','manager','counsellor','viewer')
   or p_email is null or length(p_email)>254 or position('@' in p_email)<2
   or p_token_sha256 is null or p_token_sha256 !~ '^[a-f0-9]{64}$'
 then raise exception 'Invalid invitation' using errcode='22023'; end if;
 -- Existing stale invitations can be explicitly revoked, never silently overwritten.
 insert into connect.invitations(tenant_id,email,role,token_sha256,invited_by,expires_at)
 values(p_tenant_id,lower(btrim(p_email)),p_role,p_token_sha256,p_actor_id,now()+interval '7 days')
 returning id into v_id;
 return v_id;
end $fn$;

create or replace function public.connect_accept_invitation(
 p_actor_id uuid,p_actor_email text,p_token_sha256 text
) returns uuid language plpgsql security invoker set search_path = ''
as $fn$
declare v_inv connect.invitations%rowtype;v_email text;v_member uuid;
begin
 -- The server MUST pass the email returned from a validated auth.getUser(token).
 v_email:=lower(btrim(p_actor_email));
 if p_actor_id is null or v_email is null or v_email='' then
  raise exception 'Sign in to accept invitation' using errcode='28000';
 end if;
 select * into v_inv from connect.invitations where token_sha256=p_token_sha256 for update;
 if not found or v_inv.accepted_at is not null or v_inv.revoked_at is not null or v_inv.expires_at<=now()
   or v_inv.email<>v_email then raise exception 'Invitation invalid or expired' using errcode='42501';end if;
 if not exists(select 1 from connect.tenants where id=v_inv.tenant_id and status in ('active','trial'))
 then raise exception 'Workspace unavailable' using errcode='42501';end if;
 insert into connect.memberships(tenant_id,user_id,role,status)
 values(v_inv.tenant_id,p_actor_id,v_inv.role,'active')
 on conflict(tenant_id,user_id) do update
 set role=excluded.role,status='active'
 where connect.memberships.role<>'owner'
 returning id into v_member;
 if v_member is null then raise exception 'Owner membership cannot be replaced' using errcode='42501';end if;
 update connect.invitations set accepted_at=now() where id=v_inv.id;
 return v_inv.tenant_id;
end $fn$;

create or replace function public.connect_revoke_invitation(
 p_actor_id uuid,p_tenant_id uuid,p_invitation_id uuid
) returns boolean language plpgsql security invoker set search_path = ''
as $fn$
begin
 if not exists(
  select 1 from connect.memberships m where m.tenant_id=p_tenant_id
   and m.user_id=p_actor_id and m.status='active' and m.role in ('owner','admin')
 ) then raise exception 'Workspace administration required' using errcode='42501';end if;
 update connect.invitations set revoked_at=now()
 where tenant_id=p_tenant_id and id=p_invitation_id
 and accepted_at is null and revoked_at is null;
 return found;
end $fn$;

-- No role spoofing through direct RPC calls. Route handlers validate token with Auth;
-- only service_role can call these functions. Public functions are never anonymously executable.
revoke all on function public.connect_create_workspace(uuid,text,text) from public,anon,authenticated;
revoke all on function public.connect_my_workspaces(uuid) from public,anon,authenticated;
revoke all on function public.connect_workspace_members(uuid,uuid) from public,anon,authenticated;
revoke all on function public.connect_create_invitation(uuid,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.connect_accept_invitation(uuid,text,text) from public,anon,authenticated;
revoke all on function public.connect_revoke_invitation(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.connect_create_workspace(uuid,text,text) to service_role;
grant execute on function public.connect_my_workspaces(uuid) to service_role;
grant execute on function public.connect_workspace_members(uuid,uuid) to service_role;
grant execute on function public.connect_create_invitation(uuid,uuid,text,text,text) to service_role;
grant execute on function public.connect_accept_invitation(uuid,text,text) to service_role;
grant execute on function public.connect_revoke_invitation(uuid,uuid,uuid) to service_role;


-- ===== SOURCE: database/connect/saas/06_auth_user_permission_fix_dev.sql =====
-- Compatibility fix: service_role must not SELECT auth.users for workspace RPC.
-- Route handlers verify Auth identity (user id and email) with auth.getUser(token).

create or replace function public.connect_create_workspace(
 p_actor_id uuid,p_slug text,p_name text
) returns uuid language plpgsql security invoker set search_path = ''
as $fn$
declare v_tenant uuid;
begin
 if p_actor_id is null then raise exception 'Authenticated user required' using errcode='28000';end if;
 if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or p_name is null or length(btrim(p_name)) not between 2 and 120 then
  raise exception 'Invalid workspace details' using errcode='22023';
 end if;
 insert into connect.tenants(slug,name) values(p_slug,btrim(p_name)) returning id into v_tenant;
 insert into connect.memberships(tenant_id,user_id,role,status)
 values(v_tenant,p_actor_id,'owner','active');
 return v_tenant;
end $fn$;

create function public.connect_accept_invitation(
 p_actor_id uuid,p_actor_email text,p_token_sha256 text
) returns uuid language plpgsql security invoker set search_path = ''
as $fn$
declare v_inv connect.invitations%rowtype;v_email text;v_member uuid;
begin
 v_email:=lower(btrim(p_actor_email));
 if p_actor_id is null or v_email is null or v_email='' then
  raise exception 'Sign in to accept invitation' using errcode='28000';
 end if;
 select * into v_inv from connect.invitations where token_sha256=p_token_sha256 for update;
 if not found or v_inv.accepted_at is not null or v_inv.revoked_at is not null or v_inv.expires_at<=now()
   or v_inv.email<>v_email then raise exception 'Invitation invalid or expired' using errcode='42501';end if;
 if not exists(select 1 from connect.tenants where id=v_inv.tenant_id and status in ('active','trial'))
 then raise exception 'Workspace unavailable' using errcode='42501';end if;
 insert into connect.memberships(tenant_id,user_id,role,status)
 values(v_inv.tenant_id,p_actor_id,v_inv.role,'active')
 on conflict(tenant_id,user_id) do update
 set role=excluded.role,status='active'
 where connect.memberships.role<>'owner'
 returning id into v_member;
 if v_member is null then raise exception 'Owner membership cannot be replaced' using errcode='42501';end if;
 update connect.invitations set accepted_at=now() where id=v_inv.id;
 return v_inv.tenant_id;
end $fn$;

revoke all on function public.connect_accept_invitation(uuid,text,text) from public,anon,authenticated;
grant execute on function public.connect_accept_invitation(uuid,text,text) to service_role;
drop function public.connect_accept_invitation(uuid,text) restrict;


-- ===== SOURCE: database/connect/saas/07_member_management.sql =====
-- Connect 2A staff administration. Owner-only role transfer and safe staff disabling.

create or replace function public.connect_update_member(
 p_actor_id uuid,p_tenant_id uuid,p_member_id uuid,p_role text,p_status text
) returns boolean language plpgsql security invoker set search_path=''
as $fn$
declare actor_role text; target_role text; target_user uuid;
begin
 -- Serialize membership changes within this tenant to protect the final owner.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_tenant_id::text,0));
 select m.role into actor_role from connect.memberships m
 join connect.tenants t on t.id=m.tenant_id
 where m.tenant_id=p_tenant_id and m.user_id=p_actor_id
 and m.status='active' and t.status in ('active','trial');
 if actor_role is null or actor_role not in ('owner','admin') then
  raise exception 'Workspace administrator required' using errcode='42501';
 end if;
 select m.role,m.user_id into target_role,target_user from connect.memberships m
 where m.id=p_member_id and m.tenant_id=p_tenant_id for update;
 if not found then raise exception 'Member not found' using errcode='42501';end if;
 if p_role not in ('owner','admin','manager','counsellor','viewer')
    or p_status not in ('active','disabled') then
  raise exception 'Invalid membership change' using errcode='22023';end if;
 if actor_role='admin' and (
  target_role in ('owner','admin') or p_role in ('owner','admin')
 ) then
  raise exception 'Only owner can manage privileged roles' using errcode='42501';
 end if;
 -- Never remove or downgrade the final active owner.
 if target_role='owner' and (p_role<>'owner' or p_status<>'active')
    and (select count(*) from connect.memberships
         where tenant_id=p_tenant_id and role='owner' and status='active')<=1 then
  raise exception 'A workspace must retain an active owner' using errcode='42501';
 end if;
 update connect.memberships set role=p_role,status=p_status
 where id=p_member_id and tenant_id=p_tenant_id;
 return true;
end $fn$;
revoke all on function public.connect_update_member(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.connect_update_member(uuid,uuid,uuid,text,text) to service_role;


-- ===== SOURCE: database/connect/saas/09_crm_commands.sql =====
-- Connect Phase 2B: restricted transactional CRM commands for institute workspaces.
-- All CRM tables remain private in connect schema. Only service_role can call RPC.

create or replace function public.connect_crm_write(
 p_actor_id uuid,p_tenant_id uuid,p_action text,p_data jsonb
) returns jsonb language plpgsql volatile security invoker set search_path=''
as $fn$
declare v_member uuid;v_role text;v_id uuid;v_extra uuid;v_old uuid;v_pipeline uuid;v_stage uuid;v_version int;
 v_result jsonb;v_name text;v_kind text;v_source text;v_token text;
begin
 select m.id,m.role into v_member,v_role
 from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active' and t.status in ('trial','active');
 if v_member is null or v_role='viewer' then
  raise exception 'Workspace write access denied' using errcode='42501';end if;
 if p_data is null or jsonb_typeof(p_data)<>'object'
 then raise exception 'An object payload is required' using errcode='22023';end if;
 if p_action in ('create_program','create_pipeline','bootstrap_pipeline','add_stage') and v_role not in ('owner','admin','manager') then
  raise exception 'Management role required' using errcode='42501';end if;

 case p_action
 when 'capture_lead' then
  -- Single transaction: either contact, contact details, inquiry and optional opportunity all exist, or none do.
  v_name:=nullif(btrim(p_data->>'name'),'');
  v_source:=nullif(btrim(p_data->>'source'),'');
  if v_name is null or length(v_name)>150 or v_source is null or length(v_source)>80 then
   raise exception 'Name and enquiry source are required' using errcode='22023';end if;
  v_id:=nullif(p_data->>'personId','')::uuid;
  if v_id is null then
   insert into connect.people(tenant_id,full_name) values(p_tenant_id,v_name) returning id into v_id;
   insert into connect.person_roles(tenant_id,person_id,role) values(p_tenant_id,v_id,'contact');
   if nullif(btrim(p_data->>'email'),'') is not null then
    v_token:=lower(btrim(p_data->>'email'));
    if length(v_token)>254 or position('@' in v_token)<2 then
     raise exception 'Invalid email address' using errcode='22023';end if;
    insert into connect.contact_methods(tenant_id,person_id,kind,normalized_value,display_value,is_primary)
    values(p_tenant_id,v_id,'email',v_token,v_token,true);
   end if;
   if nullif(btrim(p_data->>'phone'),'') is not null then
    v_token:=btrim(p_data->>'phone');
    if length(v_token)>35 then raise exception 'Invalid phone' using errcode='22023';end if;
    insert into connect.contact_methods(tenant_id,person_id,kind,normalized_value,display_value,is_primary)
    values(p_tenant_id,v_id,'mobile',v_token,v_token,true);
   end if;
  elsif not exists(select 1 from connect.people where tenant_id=p_tenant_id and id=v_id and status='active') then
   raise exception 'Contact not found' using errcode='42501';
  end if;
  v_extra:=null;
  if nullif(p_data->>'pipelineId','') is not null then
   v_pipeline:=(p_data->>'pipelineId')::uuid;v_stage:=(p_data->>'stageId')::uuid;
   if not exists(select 1 from connect.pipeline_stages where tenant_id=p_tenant_id
       and pipeline_id=v_pipeline and id=v_stage and outcome='open')
   then raise exception 'Choose an open admissions stage' using errcode='22023';end if;
   insert into connect.opportunities(tenant_id,pipeline_id,stage_id,title,contact_id)
   values(p_tenant_id,v_pipeline,v_stage,
    coalesce(nullif(btrim(p_data->>'title'),''),v_name||' — enquiry'),v_id)
   returning id into v_extra;
   insert into connect.stage_events(tenant_id,opportunity_id,pipeline_id,to_stage_id,changed_by_membership_id,note)
   values(p_tenant_id,v_extra,v_pipeline,v_stage,v_member,'Created from enquiry');
  end if;
  if nullif(p_data->>'categoryId','') is not null and not exists(
    select 1 from connect.enquiry_categories where tenant_id=p_tenant_id
    and id=(p_data->>'categoryId')::uuid and active
  ) then raise exception 'Invalid enquiry category' using errcode='22023';end if;
  insert into connect.inquiries(tenant_id,person_id,opportunity_id,source,summary,category_id)
  values(p_tenant_id,v_id,v_extra,v_source,left(p_data->>'summary',2000),nullif(p_data->>'categoryId','')::uuid)
  returning id into v_old;
  insert into connect.audit_events(tenant_id,actor_membership_id,event_type,entity_type,entity_id,metadata)
  values(p_tenant_id,v_member,'capture_lead','inquiry',v_old,jsonb_build_object('personId',v_id,'opportunityId',v_extra));
  return jsonb_build_object('ok',true,'id',v_old,'personId',v_id,'opportunityId',v_extra);
 when 'create_contact' then
  v_name:=nullif(btrim(p_data->>'name'),'');
  if v_name is null or length(v_name)>150 then raise exception 'Invalid contact name' using errcode='22023';end if;
  insert into connect.people(tenant_id,full_name) values(p_tenant_id,v_name) returning id into v_id;
  insert into connect.person_roles(tenant_id,person_id,role)
   values(p_tenant_id,v_id,coalesce(nullif(p_data->>'role',''),'contact'));
  if nullif(btrim(p_data->>'email'),'') is not null then
   v_token:=lower(btrim(p_data->>'email'));
   if length(v_token)>254 or position('@' in v_token)<2 then raise exception 'Invalid contact email' using errcode='22023';end if;
   insert into connect.contact_methods(tenant_id,person_id,kind,normalized_value,display_value,is_primary)
   values(p_tenant_id,v_id,'email',v_token,v_token,true);
  end if;
  if nullif(btrim(p_data->>'phone'),'') is not null then
   v_token:=btrim(p_data->>'phone');
   if length(v_token)>35 then raise exception 'Invalid contact phone' using errcode='22023';end if;
   insert into connect.contact_methods(tenant_id,person_id,kind,normalized_value,display_value,is_primary)
   values(p_tenant_id,v_id,'mobile',v_token,v_token,true);
  end if;
 when 'create_person' then
  v_name:=nullif(btrim(p_data->>'name'),'');
  if v_name is null or length(v_name)>150 then raise exception 'Invalid contact name' using errcode='22023';end if;
  insert into connect.people(tenant_id,full_name) values(p_tenant_id,v_name) returning id into v_id;
  if p_data ? 'role' then
   insert into connect.person_roles(tenant_id,person_id,role)
   values(p_tenant_id,v_id,p_data->>'role');
  end if;
 when 'update_person' then
  v_id:=(p_data->>'personId')::uuid;
  v_name:=nullif(btrim(p_data->>'name'),'');
  if v_name is null or length(v_name)>150 then raise exception 'Invalid contact name' using errcode='22023';end if;
  update connect.people set full_name=v_name,updated_at=now()
  where tenant_id=p_tenant_id and id=v_id and status='active';
  if not found then raise exception 'Contact not found' using errcode='42501';end if;
 when 'add_person_role' then
  v_id:=(p_data->>'personId')::uuid;
  insert into connect.person_roles(tenant_id,person_id,role)
   values(p_tenant_id,v_id,p_data->>'role') on conflict do nothing;
 when 'add_contact_method' then
  v_extra:=(p_data->>'personId')::uuid;
  v_token:=nullif(btrim(p_data->>'value'),'');
  if v_token is null or length(v_token)>254 then raise exception 'Invalid contact value' using errcode='22023';end if;
  if (p_data->>'kind')='email' then v_token:=lower(v_token);end if;
  insert into connect.contact_methods(tenant_id,person_id,kind,normalized_value,display_value,is_primary)
  values(p_tenant_id,v_extra,p_data->>'kind',v_token,v_token,coalesce((p_data->>'primary')::boolean,false))
  returning id into v_id;
 when 'create_household' then
  v_name:=nullif(btrim(p_data->>'name'),'');
  if length(coalesce(v_name,''))>150 then raise exception 'Invalid household name' using errcode='22023';end if;
  insert into connect.households(tenant_id,display_name) values(p_tenant_id,v_name) returning id into v_id;
 when 'link_household_member' then
  v_id:=(p_data->>'householdId')::uuid;
  insert into connect.household_members(tenant_id,household_id,person_id,relation,is_primary_contact)
  values(p_tenant_id,v_id,(p_data->>'personId')::uuid,p_data->>'relation',
    coalesce((p_data->>'primary')::boolean,false));
 when 'link_people' then
  v_id:=(p_data->>'personId')::uuid;
  insert into connect.person_relations(tenant_id,from_person_id,to_person_id,relationship)
  values(p_tenant_id,v_id,(p_data->>'relatedPersonId')::uuid,p_data->>'relationship');
 when 'create_organization' then
  v_name:=nullif(btrim(p_data->>'name'),'');
  if v_name is null or length(v_name)>180 then raise exception 'Invalid organization name' using errcode='22023';end if;
  insert into connect.organizations(tenant_id,name,category)
  values(p_tenant_id,v_name,coalesce(nullif(p_data->>'category',''),'other')) returning id into v_id;
 when 'link_organization_contact' then
  v_id:=(p_data->>'organizationId')::uuid;
  insert into connect.organization_contacts(tenant_id,organization_id,person_id,position_title)
  values(p_tenant_id,v_id,(p_data->>'personId')::uuid,p_data->>'position');
 when 'create_program' then
  v_name:=nullif(btrim(p_data->>'name'),'');
  if v_name is null or length(v_name)>180 then raise exception 'Invalid programme name' using errcode='22023';end if;
  insert into connect.programs(tenant_id,name,code)
  values(p_tenant_id,v_name,nullif(btrim(p_data->>'code'),'')) returning id into v_id;
 when 'bootstrap_pipeline' then
  v_name:=nullif(btrim(p_data->>'name'),'');
  if v_name is null or length(v_name)>150 then raise exception 'Invalid pipeline name' using errcode='22023';end if;
  insert into connect.pipelines(tenant_id,name,kind) values(p_tenant_id,v_name,'admissions') returning id into v_id;
  insert into connect.pipeline_stages(tenant_id,pipeline_id,name,sort_order,outcome)
  values
   (p_tenant_id,v_id,'New',0,'open'),
   (p_tenant_id,v_id,'Contacted',1,'open'),
   (p_tenant_id,v_id,'Trial / Counselling',2,'open'),
   (p_tenant_id,v_id,'Won',3,'won'),
   (p_tenant_id,v_id,'Lost',4,'lost');
 when 'create_pipeline' then
  v_name:=nullif(btrim(p_data->>'name'),'');
  if v_name is null or length(v_name)>150 then raise exception 'Invalid pipeline name' using errcode='22023';end if;
  insert into connect.pipelines(tenant_id,name,kind)
  values(p_tenant_id,v_name,coalesce(nullif(p_data->>'kind',''),'admissions')) returning id into v_id;
 when 'add_stage' then
  v_pipeline:=(p_data->>'pipelineId')::uuid;
  v_name:=nullif(btrim(p_data->>'name'),'');
  if v_name is null or length(v_name)>120 or (p_data->>'order')::int<0 then
   raise exception 'Invalid pipeline stage' using errcode='22023';end if;
  insert into connect.pipeline_stages(tenant_id,pipeline_id,name,sort_order,outcome)
  values(p_tenant_id,v_pipeline,v_name,(p_data->>'order')::int,
    coalesce(nullif(p_data->>'outcome',''),'open')) returning id into v_id;
 when 'create_opportunity' then
  v_name:=nullif(btrim(p_data->>'title'),'');
  if v_name is null or length(v_name)>200 then raise exception 'Invalid opportunity title' using errcode='22023';end if;
  v_pipeline:=(p_data->>'pipelineId')::uuid;v_stage:=(p_data->>'stageId')::uuid;
  if p_data->>'ownerMemberId' is not null and not exists(
   select 1 from connect.memberships where tenant_id=p_tenant_id
   and id=(p_data->>'ownerMemberId')::uuid and status='active'
  ) then raise exception 'Assignee must be an active member' using errcode='42501';end if;
  if not exists (
   select 1 from connect.pipeline_stages
   where tenant_id=p_tenant_id and pipeline_id=v_pipeline and id=v_stage and outcome='open'
  ) then raise exception 'New opportunities must begin at an open stage' using errcode='22023';end if;
  insert into connect.opportunities(tenant_id,pipeline_id,stage_id,title,contact_id,organization_id,owner_membership_id,expected_value)
  values(p_tenant_id,v_pipeline,v_stage,v_name,
    nullif(p_data->>'contactId','')::uuid,nullif(p_data->>'organizationId','')::uuid,
    nullif(p_data->>'ownerMemberId','')::uuid,nullif(p_data->>'value','')::numeric)
  returning id into v_id;
  insert into connect.stage_events(tenant_id,opportunity_id,pipeline_id,to_stage_id,changed_by_membership_id,note)
  values(p_tenant_id,v_id,v_pipeline,v_stage,v_member,'Created');
 when 'link_opportunity_person' then
  v_id:=(p_data->>'opportunityId')::uuid;
  insert into connect.opportunity_people(tenant_id,opportunity_id,person_id,role)
  values(p_tenant_id,v_id,(p_data->>'personId')::uuid,coalesce(nullif(p_data->>'role',''),'learner'));
 when 'link_opportunity_program' then
  v_id:=(p_data->>'opportunityId')::uuid;
  insert into connect.opportunity_programs(tenant_id,opportunity_id,program_id)
  values(p_tenant_id,v_id,(p_data->>'programId')::uuid);
 when 'move_opportunity' then
  v_id:=(p_data->>'opportunityId')::uuid;v_stage:=(p_data->>'stageId')::uuid;
  select pipeline_id,stage_id,version into v_pipeline,v_old,v_version
  from connect.opportunities where tenant_id=p_tenant_id and id=v_id for update;
  if not found then raise exception 'Opportunity not found' using errcode='42501';end if;
  if v_version<>coalesce((p_data->>'version')::int,-1) then
    raise exception 'Opportunity was changed: reload before updating' using errcode='40001';end if;
  if v_stage=v_old then raise exception 'Opportunity already in this stage' using errcode='22023';end if;
  update connect.opportunities o set stage_id=v_stage,version=o.version+1,updated_at=now(),
   closed_at=case when (select outcome from connect.pipeline_stages where tenant_id=p_tenant_id
     and pipeline_id=v_pipeline and id=v_stage) in ('won','lost') then now() else null end
  where o.tenant_id=p_tenant_id and o.id=v_id;
  insert into connect.stage_events(tenant_id,opportunity_id,pipeline_id,from_stage_id,to_stage_id,changed_by_membership_id,note)
  values(p_tenant_id,v_id,v_pipeline,v_old,v_stage,v_member,left(p_data->>'note',1000));
 when 'assign_opportunity' then
  v_id:=(p_data->>'opportunityId')::uuid;
  v_extra:=(p_data->>'ownerMemberId')::uuid;
  if not exists(select 1 from connect.memberships where tenant_id=p_tenant_id
    and id=v_extra and status='active') then
    raise exception 'Assignee must be an active member' using errcode='42501';end if;
  if v_role not in ('owner','admin','manager') and v_extra<>v_member then
    raise exception 'Only managers may assign leads to other staff' using errcode='42501';end if;
  update connect.opportunities o set owner_membership_id=v_extra,
    version=o.version+1,updated_at=now()
  where o.tenant_id=p_tenant_id and o.id=v_id
    and o.version=(p_data->>'version')::int;
  if not found then raise exception 'Opportunity missing or outdated' using errcode='40001';end if;
 when 'create_inquiry' then
  v_source:=nullif(btrim(p_data->>'source'),'');
  if v_source is null or length(v_source)>80 then raise exception 'Invalid enquiry source' using errcode='22023';end if;
  if (p_data->>'personId') is null and (p_data->>'opportunityId') is null
  then raise exception 'Enquiry needs a contact or opportunity' using errcode='22023';end if;
  insert into connect.inquiries(tenant_id,person_id,opportunity_id,source,summary)
  values(p_tenant_id,nullif(p_data->>'personId','')::uuid,
    nullif(p_data->>'opportunityId','')::uuid,v_source,left(p_data->>'summary',2000))
  returning id into v_id;
 when 'create_task' then
  v_name:=nullif(btrim(p_data->>'title'),'');
  if v_name is null or length(v_name)>250 then raise exception 'Invalid task title' using errcode='22023';end if;
  if p_data->>'assigneeMemberId' is not null and not exists(
   select 1 from connect.memberships where tenant_id=p_tenant_id
    and id=(p_data->>'assigneeMemberId')::uuid and status='active'
  ) then raise exception 'Task assignee must be an active member' using errcode='42501';end if;
  insert into connect.tasks(tenant_id,opportunity_id,person_id,assignee_membership_id,title,due_at)
  values(p_tenant_id,nullif(p_data->>'opportunityId','')::uuid,nullif(p_data->>'personId','')::uuid,
     coalesce(nullif(p_data->>'assigneeMemberId','')::uuid,v_member),v_name,
     nullif(p_data->>'dueAt','')::timestamptz) returning id into v_id;
 when 'update_task' then
  v_id:=(p_data->>'taskId')::uuid;
  v_extra:=nullif(p_data->>'assigneeMemberId','')::uuid;
  if v_extra is not null and not exists(select 1 from connect.memberships where tenant_id=p_tenant_id
    and id=v_extra and status='active') then
    raise exception 'Task assignee must be an active member' using errcode='42501';end if;
  if v_extra is not null and v_extra<>v_member and v_role not in ('owner','admin','manager') then
    raise exception 'Only managers may reassign tasks' using errcode='42501';end if;
  if p_data ? 'status' and p_data->>'status' not in ('open','cancelled') then
    raise exception 'Use complete_task to finish a task' using errcode='22023';end if;
  update connect.tasks t set
    title=case when p_data ? 'title' then nullif(btrim(p_data->>'title'),'') else t.title end,
    due_at=case when p_data ? 'dueAt' then nullif(p_data->>'dueAt','')::timestamptz else t.due_at end,
    assignee_membership_id=coalesce(v_extra,t.assignee_membership_id),
    status=coalesce(p_data->>'status',t.status),
    completed_at=null
  where t.tenant_id=p_tenant_id and t.id=v_id and t.status='open'
    and (t.assignee_membership_id=v_member or v_role in ('owner','admin','manager'));
  if not found then raise exception 'Task unavailable' using errcode='42501';end if;
 when 'complete_task' then
  v_id:=(p_data->>'taskId')::uuid;
  update connect.tasks set status='done',completed_at=now()
  where tenant_id=p_tenant_id and id=v_id and status='open'
    and (assignee_membership_id=v_member or v_role in ('owner','admin','manager'));
  if not found then raise exception 'Task unavailable' using errcode='42501';end if;
 when 'log_activity' then
  v_kind:=p_data->>'kind';
  insert into connect.activities(tenant_id,opportunity_id,person_id,actor_membership_id,kind,summary)
  values(p_tenant_id,nullif(p_data->>'opportunityId','')::uuid,nullif(p_data->>'personId','')::uuid,
  v_member,v_kind,left(p_data->>'summary',3000)) returning id into v_id;
 when 'create_appointment' then
  v_name:=nullif(btrim(p_data->>'title'),'');
  if v_name is null or length(v_name)>250 then raise exception 'Invalid appointment title' using errcode='22023';end if;
  if p_data->>'opportunityId' is null and p_data->>'personId' is null
  then raise exception 'Appointment requires a contact or opportunity' using errcode='22023';end if;
  insert into connect.appointments(tenant_id,opportunity_id,person_id,owner_membership_id,kind,title,starts_at,ends_at)
  values(p_tenant_id,nullif(p_data->>'opportunityId','')::uuid,nullif(p_data->>'personId','')::uuid,
    v_member,coalesce(nullif(p_data->>'kind',''),'counselling'),v_name,
    (p_data->>'startsAt')::timestamptz,(p_data->>'endsAt')::timestamptz)
  returning id into v_id;
 when 'reschedule_appointment' then
  v_id:=(p_data->>'appointmentId')::uuid;
  update connect.appointments a set starts_at=(p_data->>'startsAt')::timestamptz,
    ends_at=(p_data->>'endsAt')::timestamptz
  where a.tenant_id=p_tenant_id and a.id=v_id and a.status='scheduled'
    and (a.owner_membership_id=v_member or v_role in ('owner','admin','manager'));
  if not found then raise exception 'Appointment unavailable' using errcode='42501';end if;
 when 'finish_appointment' then
  v_id:=(p_data->>'appointmentId')::uuid;
  v_kind:=p_data->>'status';
  if v_kind not in ('completed','cancelled','no_show') then
   raise exception 'Invalid appointment outcome' using errcode='22023';end if;
  update connect.appointments set status=v_kind
  where tenant_id=p_tenant_id and id=v_id and status='scheduled'
    and (owner_membership_id=v_member or v_role in ('owner','admin','manager'));
  if not found then raise exception 'Appointment unavailable' using errcode='42501';end if;
 else raise exception 'Unknown CRM action' using errcode='22023';
 end case;
 insert into connect.audit_events(tenant_id,actor_membership_id,event_type,entity_type,entity_id,metadata)
 values(p_tenant_id,v_member,p_action,'crm',v_id,
  jsonb_build_object('action',p_action));
 return jsonb_build_object('ok',true,'id',v_id);
end $fn$;
revoke all on function public.connect_crm_write(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.connect_crm_write(uuid,uuid,text,jsonb) to service_role;


-- ===== SOURCE: database/connect/saas/10_crm_queries.sql =====
-- Connect Phase 2B paginated, tenant-scoped CRM reads.

create or replace function public.connect_crm_read(
 p_actor_id uuid,p_tenant_id uuid,p_resource text,p_options jsonb default '{}'::jsonb
) returns jsonb language plpgsql stable security invoker set search_path=''
as $fn$
declare v_member uuid;v_limit int;v_offset int;v_search text;v_id uuid;v_result jsonb;
begin
 select m.id into v_member from connect.memberships m
 join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id
   and m.status='active' and t.status in ('active','trial');
 if v_member is null then raise exception 'Workspace read access denied' using errcode='42501';end if;
 v_limit:=least(100,greatest(1,coalesce((p_options->>'limit')::integer,30)));
 v_offset:=least(10000,greatest(0,coalesce((p_options->>'offset')::integer,0)));
 v_search:=left(coalesce(p_options->>'search',''),100);
 v_id:=nullif(p_options->>'id','')::uuid;
 case p_resource
 when 'overview' then
  select jsonb_build_array(jsonb_build_object(
   'newEnquiries',(select count(*) from connect.inquiries where tenant_id=p_tenant_id and received_at>=date_trunc('day',now(),(select t.timezone from connect.tenants t where t.id=p_tenant_id))),
   'totalEnquiries',(select count(*) from connect.inquiries where tenant_id=p_tenant_id),
   'openOpportunities',(select count(*) from connect.opportunities o join connect.pipeline_stages st on st.tenant_id=o.tenant_id and st.id=o.stage_id where o.tenant_id=p_tenant_id and st.outcome='open'),
   'wonOpportunities',(select count(*) from connect.opportunities o join connect.pipeline_stages st on st.tenant_id=o.tenant_id and st.id=o.stage_id where o.tenant_id=p_tenant_id and st.outcome='won'),
   'overdueTasks',(select count(*) from connect.tasks where tenant_id=p_tenant_id and status='open' and due_at<now()),
   'openTasks',(select count(*) from connect.tasks where tenant_id=p_tenant_id and status='open'),
   'scheduledAppointments',(select count(*) from connect.appointments where tenant_id=p_tenant_id and status='scheduled' and starts_at>=now())
  )) into v_result;
 when 'people' then
  select coalesce(jsonb_agg(to_jsonb(q) order by q.full_name,q.id),'[]'::jsonb) into v_result
  from (select p.id,p.full_name,p.status,p.created_at,
   (select coalesce(jsonb_agg(jsonb_build_object('kind',cm.kind,'value',cm.display_value,'primary',cm.is_primary)),'[]'::jsonb)
    from connect.contact_methods cm where cm.tenant_id=p_tenant_id and cm.person_id=p.id) as contact_methods,
   (select coalesce(jsonb_agg(pr.role),'[]'::jsonb) from connect.person_roles pr
    where pr.tenant_id=p_tenant_id and pr.person_id=p.id) as roles
   from connect.people p where p.tenant_id=p_tenant_id and p.status='active'
     and (v_id is null or p.id=v_id) and (v_search='' or p.full_name ilike '%'||v_search||'%')
   order by p.full_name,p.id limit v_limit offset v_offset) q;
 when 'contact_matches' then
  -- Candidate lookup only. Shared family contact details need deliberate operator review, not auto-merge.
  select coalesce(jsonb_agg(to_jsonb(q) order by q.full_name),'[]'::jsonb) into v_result
  from (select distinct p.id,p.full_name,c.kind,c.display_value
   from connect.contact_methods c join connect.people p on p.tenant_id=c.tenant_id and p.id=c.person_id
   where c.tenant_id=p_tenant_id and c.normalized_value=v_search and p.status='active'
   order by p.full_name,p.id,c.kind,c.display_value limit v_limit offset v_offset) q;
 when 'households' then
  select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc),'[]'::jsonb) into v_result
  from (select h.id,h.display_name,h.created_at,
    (select coalesce(jsonb_agg(jsonb_build_object('personId',hm.person_id,'relation',hm.relation,'primary',hm.is_primary_contact)),'[]'::jsonb)
    from connect.household_members hm where hm.tenant_id=p_tenant_id and hm.household_id=h.id) as members
   from connect.households h where h.tenant_id=p_tenant_id and (v_id is null or h.id=v_id)
   order by h.created_at desc,h.id limit v_limit offset v_offset) q;
 when 'organizations' then
  select coalesce(jsonb_agg(to_jsonb(q) order by q.name),'[]'::jsonb) into v_result
  from (select id,name,category,created_at from connect.organizations
    where tenant_id=p_tenant_id and (v_id is null or id=v_id)
    order by name,id limit v_limit offset v_offset) q;
 when 'programs' then
  select coalesce(jsonb_agg(to_jsonb(q) order by q.name),'[]'::jsonb) into v_result
  from (select id,name,code,active from connect.programs where tenant_id=p_tenant_id
   order by name,id limit v_limit offset v_offset) q;
 when 'pipelines' then
  select coalesce(jsonb_agg(to_jsonb(q) order by q.name),'[]'::jsonb) into v_result
  from (select p.id,p.name,p.kind,p.active,
    (select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'order',s.sort_order,'outcome',s.outcome) order by s.sort_order),'[]'::jsonb)
    from connect.pipeline_stages s where s.tenant_id=p_tenant_id and s.pipeline_id=p.id) as stages
   from connect.pipelines p where p.tenant_id=p_tenant_id order by p.name,p.id limit v_limit offset v_offset) q;
 when 'opportunities' then
  select coalesce(jsonb_agg(to_jsonb(q) order by q.updated_at desc),'[]'::jsonb) into v_result
  from (select o.id,o.title,o.contact_id,o.organization_id,o.pipeline_id,o.stage_id,o.owner_membership_id,
   o.expected_value,o.currency,o.closed_at,o.version,o.updated_at,s.name as stage_name,s.outcome
   from connect.opportunities o
   join connect.pipeline_stages s on s.tenant_id=o.tenant_id and s.id=o.stage_id
   where o.tenant_id=p_tenant_id and (v_id is null or o.id=v_id)
     and (v_search='' or o.title ilike '%'||v_search||'%')
   order by o.updated_at desc,o.id limit v_limit offset v_offset) q;
 when 'inquiries' then
  select coalesce(jsonb_agg(to_jsonb(q) order by q.received_at desc),'[]'::jsonb) into v_result
  from (select i.id,i.person_id,i.opportunity_id,i.source,i.summary,i.received_at,i.category_id,ec.label as category_label,
    p.full_name as contact_name,
    (select cm.display_value from connect.contact_methods cm
     where cm.tenant_id=i.tenant_id and cm.person_id=i.person_id
     order by cm.is_primary desc,cm.created_at limit 1) as contact_detail,
    o.title as opportunity_title,o.stage_id,s.name as stage_name,s.outcome
    from connect.inquiries i
    left join connect.enquiry_categories ec on ec.tenant_id=i.tenant_id and ec.id=i.category_id
    left join connect.people p on p.tenant_id=i.tenant_id and p.id=i.person_id
    left join connect.opportunities o on o.tenant_id=i.tenant_id and o.id=i.opportunity_id
    left join connect.pipeline_stages s on s.tenant_id=i.tenant_id and s.id=o.stage_id
    where i.tenant_id=p_tenant_id and (v_id is null or i.id=v_id)
    and (v_search='' or p.full_name ilike '%'||v_search||'%' or i.summary ilike '%'||v_search||'%')
    order by i.received_at desc,i.id limit v_limit offset v_offset) q;
 when 'tasks' then
  select coalesce(jsonb_agg(to_jsonb(q) order by q.due_at nulls last),'[]'::jsonb) into v_result
  from (select id,title,status,person_id,opportunity_id,assignee_membership_id,due_at,completed_at,created_at
    from connect.tasks where tenant_id=p_tenant_id and (v_id is null or id=v_id)
    order by due_at nulls last,id limit v_limit offset v_offset) q;
 when 'activities' then
  select coalesce(jsonb_agg(to_jsonb(q) order by q.occurred_at desc),'[]'::jsonb) into v_result
  from (select id,opportunity_id,person_id,actor_membership_id,kind,summary,occurred_at
   from connect.activities where tenant_id=p_tenant_id and (v_id is null or id=v_id)
   order by occurred_at desc,id limit v_limit offset v_offset) q;
 when 'appointments' then
  select coalesce(jsonb_agg(to_jsonb(q) order by q.starts_at),'[]'::jsonb) into v_result
  from (select id,title,kind,status,person_id,opportunity_id,owner_membership_id,starts_at,ends_at
   from connect.appointments where tenant_id=p_tenant_id and (v_id is null or id=v_id)
   order by starts_at,id limit v_limit offset v_offset) q;
 when 'timeline' then
  if v_id is null then raise exception 'Timeline requires an opportunity or contact ID' using errcode='22023';end if;
  select coalesce(jsonb_agg(to_jsonb(q) order by q.event_time desc),'[]'::jsonb) into v_result
  from (
   select 'activity'::text as type,a.id,a.kind as title,a.summary,a.occurred_at as event_time
   from connect.activities a where a.tenant_id=p_tenant_id and (a.person_id=v_id or a.opportunity_id=v_id)
   union all
   select 'stage',e.id,'stage_change',e.note,e.changed_at
   from connect.stage_events e where e.tenant_id=p_tenant_id and e.opportunity_id=v_id
   order by event_time desc limit v_limit offset v_offset
  ) q;
 else raise exception 'Unknown CRM resource' using errcode='22023';
 end case;
 return jsonb_build_object('items',v_result,'limit',v_limit,'offset',v_offset);
end $fn$;
revoke all on function public.connect_crm_read(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.connect_crm_read(uuid,uuid,text,jsonb) to service_role;


-- ===== SOURCE: database/connect/saas/12_multichannel_ingestion.sql =====
-- Phase 3A: Multi-channel ingestion. No external credentials stored in database.
-- All functions are service-role-only; no direct client access to connect schema.

create table connect.form_keys (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references connect.tenants(id) on delete restrict,
 channel_account_id uuid not null,
 token_sha256 text not null unique check(token_sha256 ~ '^[0-9a-f]{64}$'),
 label text not null,
 active boolean not null default true,
 created_at timestamptz not null default now(),
 foreign key(tenant_id,channel_account_id) references connect.channel_accounts(tenant_id,id) on delete restrict,
 unique(tenant_id,id)
);
alter table connect.form_keys enable row level security;
revoke all on table connect.form_keys from public,anon,authenticated;
grant select,insert,update,delete on table connect.form_keys to service_role;

-- Channel account identifiers MUST be unique across tenants to prevent webhook misrouting.
create unique index connect_channel_global_identity
on connect.channel_accounts(provider,lower(external_account_id))
where external_account_id is not null;

create or replace function public.connect_register_channel(
 p_actor_id uuid,p_tenant_id uuid,p_provider text,p_external_id text,p_label text
) returns uuid language plpgsql security invoker set search_path=''
as $fn$
declare v_id uuid;v_role text;
begin
 select m.role into v_role from connect.memberships m
 join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active'
   and t.status in ('trial','active');
 if v_role is null or v_role not in ('owner','admin') then raise exception 'Channel administration required' using errcode='42501';end if;
 if p_provider not in ('whatsapp','meta_leads','email','website')
   or p_external_id is null or length(btrim(p_external_id)) not between 4 and 200
   or p_label is null or length(btrim(p_label)) not between 2 and 100 then
  raise exception 'Invalid channel registration' using errcode='22023';end if;
 insert into connect.channel_accounts(tenant_id,provider,external_account_id,display_name,status)
 values(p_tenant_id,p_provider,lower(btrim(p_external_id)),btrim(p_label),'inactive')
 returning id into v_id;
 return v_id;
end $fn$;

create or replace function public.connect_set_channel_status(
 p_actor_id uuid,p_tenant_id uuid,p_channel_id uuid,p_status text
) returns boolean language plpgsql security invoker set search_path=''
as $fn$
begin
 if not exists(select 1 from connect.memberships m join connect.tenants t on t.id=m.tenant_id
  where m.tenant_id=p_tenant_id and m.user_id=p_actor_id and m.status='active'
  and m.role in ('owner','admin') and t.status in ('active','trial'))
 then raise exception 'Channel administration required' using errcode='42501';end if;
 if p_status not in ('active','inactive','disabled') then
  raise exception 'Invalid channel status' using errcode='22023';end if;
 update connect.channel_accounts set status=p_status
 where id=p_channel_id and tenant_id=p_tenant_id;
 if not found then raise exception 'Channel not found' using errcode='42501';end if;
 return true;
end $fn$;

create or replace function public.connect_list_channels(p_actor_id uuid,p_tenant_id uuid)
returns jsonb language plpgsql stable security invoker set search_path=''
as $fn$
declare v_result jsonb;
begin
 if not exists(select 1 from connect.memberships m join connect.tenants t on t.id=m.tenant_id
  where m.tenant_id=p_tenant_id and m.user_id=p_actor_id and m.status='active'
  and m.role in ('owner','admin','manager') and t.status in ('active','trial'))
 then raise exception 'Channel administration required' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',c.id,'provider',c.provider,'externalId',c.external_account_id,
  'name',c.display_name,'status',c.status) order by c.provider,c.display_name),'[]'::jsonb)
 into v_result from connect.channel_accounts c where c.tenant_id=p_tenant_id;
 return v_result;
end $fn$;

create or replace function public.connect_create_form_key(
 p_actor_id uuid,p_tenant_id uuid,p_channel_id uuid,p_token_hash text,p_label text
) returns uuid language plpgsql security invoker set search_path=''
as $fn$
declare v_id uuid;
begin
 if not exists(select 1 from connect.memberships m join connect.tenants t on t.id=m.tenant_id
  where m.tenant_id=p_tenant_id and m.user_id=p_actor_id and m.status='active'
   and m.role in ('owner','admin') and t.status in ('active','trial'))
 then raise exception 'Channel administration required' using errcode='42501';end if;
 if p_token_hash !~ '^[a-f0-9]{64}$' or length(btrim(coalesce(p_label,''))) not between 2 and 100 then
  raise exception 'Invalid form key' using errcode='22023';end if;
 if not exists(select 1 from connect.channel_accounts where id=p_channel_id and tenant_id=p_tenant_id and provider='website')
 then raise exception 'Website channel required' using errcode='42501';end if;
 insert into connect.form_keys(tenant_id,channel_account_id,token_sha256,label)
 values(p_tenant_id,p_channel_id,p_token_hash,btrim(p_label)) returning id into v_id;
 return v_id;
end $fn$;

create or replace function public.connect_list_form_keys(
 p_actor_id uuid,p_tenant_id uuid
) returns jsonb language plpgsql stable security invoker set search_path=''
as $fn$
declare v_result jsonb;
begin
 if not exists(select 1 from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id
 and m.status='active' and m.role in ('owner','admin') and t.status in ('active','trial'))
 then raise exception 'Form administration required' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',k.id,'channelId',k.channel_account_id,'label',k.label,
  'active',k.active,'createdAt',k.created_at) order by k.created_at desc),'[]'::jsonb)
 into v_result from connect.form_keys k where k.tenant_id=p_tenant_id;
 return v_result;
end $fn$;

create or replace function public.connect_disable_form_key(
 p_actor_id uuid,p_tenant_id uuid,p_key_id uuid
) returns boolean language plpgsql security invoker set search_path=''
as $fn$
begin
 if not exists(select 1 from connect.memberships where tenant_id=p_tenant_id
  and user_id=p_actor_id and role in ('owner','admin') and status='active')
 then raise exception 'Channel administration required' using errcode='42501';end if;
 update connect.form_keys set active=false where id=p_key_id and tenant_id=p_tenant_id and active;
 return found;
end $fn$;

-- Internal function: called by verified server adapters, never from anonymous/authenticated clients.
create or replace function connect.ingest_event(
 p_account_id uuid,p_event_id text,p_name text,p_email text,p_phone text,p_source text,p_summary text
) returns jsonb language plpgsql volatile security invoker set search_path=''
as $fn$
declare v_account connect.channel_accounts%rowtype;v_person uuid;v_inquiry uuid;v_opp uuid;
 v_pipeline uuid;v_stage uuid;v_email text;v_phone text;v_name text;v_receipt uuid;v_conversation uuid;
begin
 select * into v_account from connect.channel_accounts c
  where c.id=p_account_id and c.status='active' for share;
 if not found then raise exception 'Inactive or unknown channel' using errcode='42501';end if;
 if not exists(select 1 from connect.tenants where id=v_account.tenant_id and status in ('trial','active'))
 then raise exception 'Workspace unavailable' using errcode='42501';end if;
 if p_event_id is null or length(p_event_id) not between 3 and 250
    or p_source is null or length(p_source) not between 2 and 80
 then raise exception 'Invalid event identity' using errcode='22023';end if;
 v_name:=nullif(btrim(coalesce(p_name,'')),'');
 v_email:=nullif(lower(btrim(coalesce(p_email,''))),'');
 v_phone:=nullif(regexp_replace(coalesce(p_phone,''),'[^0-9+]','','g'),'');
 if v_name is null then v_name:='Unknown contact';end if;
 if length(v_name)>150 or length(coalesce(v_email,''))>254
    or (v_email is not null and v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
    or length(coalesce(v_phone,''))>35 or length(coalesce(p_summary,''))>3000
    or (v_email is null and v_phone is null)
 then raise exception 'Invalid lead details' using errcode='22023';end if;

 -- A duplicate provider delivery must be a no-op, including concurrent retries.
 insert into connect.webhook_receipts(
  tenant_id,channel_account_id,external_event_id,event_type,payload,status,attempts)
 values(v_account.tenant_id,v_account.id,p_event_id,'lead_ingest',
    jsonb_build_object('source',p_source), 'pending',1)
 on conflict(tenant_id,channel_account_id,external_event_id) do nothing
 returning id into v_receipt;
 if v_receipt is null then return jsonb_build_object('ok',true,'duplicate',true);end if;

 -- Serialize matching lead contact identity within a tenant; no cross-institute sharing.
 perform pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(v_account.tenant_id::text||':'||coalesce(v_email,v_phone),0));
 if v_email is not null then
  select c.person_id into v_person from connect.contact_methods c
  join connect.people p on p.tenant_id=c.tenant_id and p.id=c.person_id and p.status='active'
  where c.tenant_id=v_account.tenant_id and c.kind='email' and c.normalized_value=v_email
  order by c.created_at,c.id limit 1;
 end if;
 if v_person is null and v_phone is not null then
  select c.person_id into v_person from connect.contact_methods c
  join connect.people p on p.tenant_id=c.tenant_id and p.id=c.person_id and p.status='active'
  where c.tenant_id=v_account.tenant_id and c.kind in ('mobile','phone','whatsapp')
   and c.normalized_value=v_phone
  order by c.created_at,c.id limit 1;
 end if;
 if v_person is null then
  insert into connect.people(tenant_id,full_name) values(v_account.tenant_id,v_name)
    returning id into v_person;
  insert into connect.person_roles(tenant_id,person_id,role)
    values(v_account.tenant_id,v_person,'contact');
 end if;
 if v_email is not null and not exists(
   select 1 from connect.contact_methods where tenant_id=v_account.tenant_id
   and person_id=v_person and kind='email' and normalized_value=v_email
 ) then
  insert into connect.contact_methods(tenant_id,person_id,kind,normalized_value,display_value,is_primary)
   values(v_account.tenant_id,v_person,'email',v_email,v_email,
    not exists(select 1 from connect.contact_methods where tenant_id=v_account.tenant_id
      and person_id=v_person and kind='email'));
 end if;
 if v_phone is not null and not exists(
   select 1 from connect.contact_methods where tenant_id=v_account.tenant_id
   and person_id=v_person and kind='mobile' and normalized_value=v_phone
 ) then
  insert into connect.contact_methods(tenant_id,person_id,kind,normalized_value,display_value,is_primary)
   values(v_account.tenant_id,v_person,'mobile',v_phone,v_phone,
    not exists(select 1 from connect.contact_methods where tenant_id=v_account.tenant_id
      and person_id=v_person and kind='mobile'));
 end if;

 -- Intake-first policy: a message from a trainer, supplier or collaborator is not an admission.
 -- Review/classify the enquiry before opening any pipeline opportunity.
 -- Deliberately do not create or reuse an admissions deal during channel ingestion.
 if v_account.provider in ('whatsapp','email') then
  insert into connect.conversations(tenant_id,channel_account_id,person_id,external_thread_id)
  values(v_account.tenant_id,v_account.id,v_person,v_person::text)
  on conflict(tenant_id,channel_account_id,external_thread_id) where external_thread_id is not null
    do update set person_id=excluded.person_id
  returning id into v_conversation;
  insert into connect.messages(tenant_id,conversation_id,external_message_id,direction,body)
  values(v_account.tenant_id,v_conversation,p_event_id,'inbound',left(p_summary,2000))
  on conflict(tenant_id,conversation_id,external_message_id) where external_message_id is not null do nothing;
 end if;
 insert into connect.inquiries(tenant_id,person_id,opportunity_id,
  channel_account_id,external_event_id,source,summary)
 values(v_account.tenant_id,v_person,v_opp,v_account.id,p_event_id,p_source,left(p_summary,2000))
 returning id into v_inquiry;
 update connect.webhook_receipts set status='processed',processed_at=now()
 where id=v_receipt;
 insert into connect.audit_events(tenant_id,event_type,entity_type,entity_id,metadata)
 values(v_account.tenant_id,'external_lead_ingested','inquiry',v_inquiry,
  jsonb_build_object('provider',v_account.provider,'channelAccountId',v_account.id));
 return jsonb_build_object('ok',true,'duplicate',false,'inquiryId',v_inquiry,'personId',v_person,'opportunityId',v_opp);
end $fn$;

-- Public-schema adapters callable ONLY with service credentials after signature verification.
create or replace function public.connect_ingest_channel(
 p_provider text,p_external_account_id text,p_event_id text,p_name text,
 p_email text,p_phone text,p_summary text
) returns jsonb language plpgsql security invoker set search_path=''
as $fn$
declare v_id uuid;
begin
 select c.id into v_id from connect.channel_accounts c
  where c.provider=p_provider and c.external_account_id=lower(btrim(p_external_account_id))
    and c.status='active';
 if v_id is null then raise exception 'Unregistered channel' using errcode='42501';end if;
 return connect.ingest_event(v_id,p_event_id,p_name,p_email,p_phone,p_provider,p_summary);
end $fn$;

create or replace function public.connect_ingest_website(
 p_token_hash text,p_event_id text,p_name text,p_email text,p_phone text,p_summary text
) returns jsonb language plpgsql security invoker set search_path=''
as $fn$
declare v_id uuid;
begin
 select k.channel_account_id into v_id from connect.form_keys k
 join connect.channel_accounts c on c.tenant_id=k.tenant_id and c.id=k.channel_account_id
 join connect.tenants t on t.id=k.tenant_id
 where k.token_sha256=p_token_hash and k.active and c.status='active'
 and c.provider='website' and t.status in ('trial','active');
 if v_id is null then raise exception 'Unknown or disabled form' using errcode='42501';end if;
 return connect.ingest_event(v_id,p_event_id,p_name,p_email,p_phone,'website',p_summary);
end $fn$;
do $security$
declare f text;
begin
 foreach f in array array[
 'connect_register_channel(uuid,uuid,text,text,text)',
 'connect_set_channel_status(uuid,uuid,uuid,text)',
 'connect_list_channels(uuid,uuid)',
 'connect_create_form_key(uuid,uuid,uuid,text,text)',
 'connect_list_form_keys(uuid,uuid)',
 'connect_disable_form_key(uuid,uuid,uuid)',
 'connect_ingest_channel(text,text,text,text,text,text,text)',
 'connect_ingest_website(text,text,text,text,text,text)'
 ] loop
  execute 'revoke all on function public.'||f||' from public,anon,authenticated';
  execute 'grant execute on function public.'||f||' to service_role';
 end loop;
end $security$;
revoke all on function connect.ingest_event(uuid,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function connect.ingest_event(uuid,text,text,text,text,text,text) to service_role;


-- ===== SOURCE: database/connect/saas/15_workflow_automation.sql =====
-- Phase 3B — simple tenant-scoped workflow automation and in-app reminders.
-- All functions are server-only (service_role), all tables are private with RLS.

create table connect.automation_settings (
 tenant_id uuid primary key references connect.tenants(id) on delete restrict,
 assignment_enabled boolean not null default true,
 initial_followup_enabled boolean not null default true,
 followup_delay_hours integer not null default 24 check(followup_delay_hours between 1 and 168),
 reminders_enabled boolean not null default true,
 reminder_advance_minutes integer not null default 30 check(reminder_advance_minutes between 5 and 1440),
 updated_at timestamptz not null default now()
);
create table connect.staff_notifications (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references connect.tenants(id) on delete restrict,
 member_id uuid not null,
 task_id uuid not null,
 kind text not null check(kind in ('upcoming','overdue')),
 title text not null,
 created_at timestamptz not null default now(),
 read_at timestamptz,
 foreign key(tenant_id,member_id) references connect.memberships(tenant_id,id) on delete restrict,
 foreign key(tenant_id,task_id) references connect.tasks(tenant_id,id) on delete restrict,
 unique(tenant_id,task_id,member_id,kind)
);
create index connect_staff_notifications_inbox_idx on connect.staff_notifications(tenant_id,member_id,created_at desc);
alter table connect.automation_settings enable row level security;
alter table connect.staff_notifications enable row level security;
revoke all on connect.automation_settings,connect.staff_notifications from public,anon,authenticated;
grant select,insert,update,delete on connect.automation_settings,connect.staff_notifications to service_role;

create or replace function connect.automate_new_opportunity()
returns trigger language plpgsql security invoker set search_path=''
as $fn$
declare v_policy connect.automation_settings%rowtype;v_assignee uuid;
begin
 select * into v_policy from connect.automation_settings where tenant_id=new.tenant_id;
 if not found then
  insert into connect.automation_settings(tenant_id) values(new.tenant_id)
  on conflict(tenant_id) do nothing;
  select * into v_policy from connect.automation_settings where tenant_id=new.tenant_id;
 end if;
 if v_policy.assignment_enabled and new.owner_membership_id is null then
  -- Prefer active counsellors; distribute according to current open workload.
  select m.id into v_assignee
  from connect.memberships m
  left join lateral (
   select count(*) as workload from connect.opportunities o
   join connect.pipeline_stages st on st.tenant_id=o.tenant_id and st.id=o.stage_id
   where o.tenant_id=new.tenant_id and o.owner_membership_id=m.id and st.outcome='open'
  ) wl on true
  where m.tenant_id=new.tenant_id and m.status='active'
   and m.role in ('counsellor','manager','admin','owner')
  order by case when m.role='counsellor' then 0 when m.role='manager' then 1
    when m.role='admin' then 2 else 3 end,wl.workload,m.id
  limit 1;
  if v_assignee is not null then
   update connect.opportunities set owner_membership_id=v_assignee
   where tenant_id=new.tenant_id and id=new.id;
  end if;
 end if;
 if v_policy.initial_followup_enabled then
  insert into connect.tasks(tenant_id,opportunity_id,person_id,assignee_membership_id,title,due_at)
  values(new.tenant_id,new.id,new.contact_id,
   coalesce(new.owner_membership_id,v_assignee),
   'Follow up on new admission',now()+pg_catalog.make_interval(hours=>v_policy.followup_delay_hours));
 end if;
 return new;
end $fn$;
create trigger connect_opportunity_automation
after insert on connect.opportunities for each row execute function connect.automate_new_opportunity();

create or replace function public.connect_automation_settings(
 p_actor_id uuid,p_tenant_id uuid,p_update jsonb default null
) returns jsonb language plpgsql security invoker set search_path=''
as $fn$
declare v_role text;v_settings connect.automation_settings%rowtype;
begin
 select m.role into v_role from connect.memberships m
 join connect.tenants t on t.id=m.tenant_id
 where m.tenant_id=p_tenant_id and m.user_id=p_actor_id and m.status='active'
  and t.status in ('trial','active');
 if v_role is null then raise exception 'Workspace access denied' using errcode='42501';end if;
 if p_update is not null then
  if v_role not in ('owner','admin') then raise exception 'Only owners and admins may configure automation' using errcode='42501';end if;
  if jsonb_typeof(p_update)<>'object' or p_update ?| array['tenant_id','tenantId'] then
   raise exception 'Invalid automation policy' using errcode='22023';end if;
  if exists(select 1 from pg_catalog.jsonb_object_keys(p_update) as k
     where k not in ('assignmentEnabled','initialFollowupEnabled','followupDelayHours',
       'remindersEnabled','reminderAdvanceMinutes')) then
   raise exception 'Unknown automation option' using errcode='22023';end if;
 end if;
 insert into connect.automation_settings(tenant_id) values(p_tenant_id)
 on conflict(tenant_id) do nothing;
 if p_update is not null then
  update connect.automation_settings set
   assignment_enabled=coalesce((p_update->>'assignmentEnabled')::boolean,assignment_enabled),
   initial_followup_enabled=coalesce((p_update->>'initialFollowupEnabled')::boolean,initial_followup_enabled),
   followup_delay_hours=coalesce((p_update->>'followupDelayHours')::int,followup_delay_hours),
   reminders_enabled=coalesce((p_update->>'remindersEnabled')::boolean,reminders_enabled),
   reminder_advance_minutes=coalesce((p_update->>'reminderAdvanceMinutes')::int,reminder_advance_minutes),
   updated_at=now()
  where tenant_id=p_tenant_id;
 end if;
 select * into v_settings from connect.automation_settings where tenant_id=p_tenant_id;
 return jsonb_build_object('assignmentEnabled',v_settings.assignment_enabled,
  'initialFollowupEnabled',v_settings.initial_followup_enabled,
  'followupDelayHours',v_settings.followup_delay_hours,
  'remindersEnabled',v_settings.reminders_enabled,
  'reminderAdvanceMinutes',v_settings.reminder_advance_minutes);
end $fn$;

create or replace function public.connect_staff_inbox(
 p_actor_id uuid,p_tenant_id uuid,p_action text default 'list',p_notification_id uuid default null
) returns jsonb language plpgsql security invoker set search_path=''
as $fn$
declare v_member uuid;v_data jsonb;
begin
 select m.id into v_member from connect.memberships m
 join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active'
  and t.status in ('trial','active');
 if v_member is null then raise exception 'Workspace access denied' using errcode='42501';end if;
 if p_action='read' then
  if p_notification_id is null then raise exception 'Notification id required' using errcode='22023';end if;
  update connect.staff_notifications set read_at=coalesce(read_at,now())
  where id=p_notification_id and tenant_id=p_tenant_id and member_id=v_member;
 elsif p_action<>'list' then raise exception 'Unsupported notification action' using errcode='22023';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'title',n.title,
  'taskId',n.task_id,'kind',n.kind,'createdAt',n.created_at,'readAt',n.read_at)
 order by n.created_at desc),'[]'::jsonb)
 into v_data
 from (select * from connect.staff_notifications where tenant_id=p_tenant_id
  and member_id=v_member order by created_at desc limit 100) n;
 return v_data;
end $fn$;

create or replace function public.connect_conversation_history(
 p_actor_id uuid,p_tenant_id uuid,p_person_id uuid default null,
 p_limit integer default 40
) returns jsonb language plpgsql stable security invoker set search_path=''
as $fn$
declare v_member uuid;v_result jsonb;
begin
 select m.id into v_member from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active'
  and t.status in ('trial','active');
 if v_member is null then raise exception 'Workspace access denied' using errcode='42501';end if;
 if p_person_id is not null and not exists(select 1 from connect.people
    where tenant_id=p_tenant_id and id=p_person_id) then
  raise exception 'Contact unavailable' using errcode='42501';end if;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.occurred_at,q.id),'[]'::jsonb) into v_result
 from (select m.id,m.conversation_id,c.person_id,p.full_name as person_name,
  a.provider,a.display_name as channel_name,m.direction,m.body,m.delivery_status,m.occurred_at
  from connect.messages m
  join connect.conversations c on c.tenant_id=m.tenant_id and c.id=m.conversation_id
  join connect.channel_accounts a on a.tenant_id=c.tenant_id and a.id=c.channel_account_id
  left join connect.people p on p.tenant_id=c.tenant_id and p.id=c.person_id
  where m.tenant_id=p_tenant_id and (p_person_id is null or c.person_id=p_person_id)
  order by m.occurred_at desc,m.id desc limit least(100,greatest(1,coalesce(p_limit,40)))
 ) q;
 return v_result;
end $fn$;

-- Called by a trusted scheduler, never directly by users.
-- Only in-app alerts; no outbound messaging without verified consent and provider config.
create or replace function public.connect_run_reminders(p_batch_size integer default 250)
returns jsonb language plpgsql volatile security invoker set search_path=''
as $fn$
declare v_created integer;
begin
 with candidate as (
  select t.tenant_id,t.id,t.assignee_membership_id,t.title,
   case when t.due_at<=now() then 'overdue' else 'upcoming' end as kind
  from connect.tasks t
  join connect.memberships m on m.tenant_id=t.tenant_id
    and m.id=t.assignee_membership_id and m.status='active'
  join connect.tenants tn on tn.id=t.tenant_id and tn.status in ('trial','active')
  join connect.automation_settings p on p.tenant_id=t.tenant_id and p.reminders_enabled
  where t.status='open' and t.due_at is not null
    and t.due_at<=now()+pg_catalog.make_interval(mins=>p.reminder_advance_minutes)
    and t.due_at>=now()-interval '30 days'
    and not exists (
      select 1 from connect.staff_notifications n
      where n.tenant_id=t.tenant_id and n.task_id=t.id
        and n.member_id=t.assignee_membership_id
        and n.kind=case when t.due_at<=now() then 'overdue' else 'upcoming' end
    )
  order by t.due_at,t.id
  limit least(1000,greatest(1,coalesce(p_batch_size,250)))
 )
 insert into connect.staff_notifications(tenant_id,task_id,member_id,title,kind)
 select tenant_id,id,assignee_membership_id,
  case when kind='overdue' then 'Overdue follow-up: ' else 'Follow-up due soon: ' end||left(title,190),kind
 from candidate
 on conflict(tenant_id,task_id,member_id,kind) do nothing;
 get diagnostics v_created=row_count;
 return jsonb_build_object('created',v_created,'delivery','in_app_only');
end $fn$;

revoke all on function public.connect_automation_settings(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.connect_staff_inbox(uuid,uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.connect_conversation_history(uuid,uuid,uuid,integer) from public,anon,authenticated;
revoke all on function public.connect_run_reminders(integer) from public,anon,authenticated;
grant execute on function public.connect_automation_settings(uuid,uuid,jsonb) to service_role;
grant execute on function public.connect_staff_inbox(uuid,uuid,text,uuid) to service_role;
grant execute on function public.connect_conversation_history(uuid,uuid,uuid,integer) to service_role;
grant execute on function public.connect_run_reminders(integer) to service_role;
revoke all on function connect.automate_new_opportunity() from public,anon,authenticated;
grant execute on function connect.automate_new_opportunity() to service_role;


-- ===== SOURCE: database/connect/saas/18_admissions_analytics.sql =====
-- Phase 3C reporting ledger and tenant-isolated analytics.
-- Financial ROI only uses recorded realized revenue and recorded campaign spend,
-- in the same institute base currency and reporting date range.

create table connect.campaign_spend (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references connect.tenants(id) on delete restrict,
 campaign_id uuid not null,
 spent_on date not null,
 amount numeric(14,2) not null check(amount>=0 and amount<=999999999999.99),
 currency text not null check(currency ~ '^[A-Z]{3}$'),
 note text,
 recorded_by uuid,
 recorded_at timestamptz not null default now(),
 foreign key(tenant_id,campaign_id) references connect.campaigns(tenant_id,id) on delete restrict,
 foreign key(tenant_id,recorded_by) references connect.memberships(tenant_id,id) on delete restrict,
 unique(tenant_id,id)
);
create index connect_campaign_spend_period on connect.campaign_spend(tenant_id,spent_on,campaign_id);
create table connect.realized_revenue (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references connect.tenants(id) on delete restrict,
 opportunity_id uuid not null,
 received_on date not null,
 amount numeric(14,2) not null check(amount>0 and amount<=999999999999.99),
 currency text not null check(currency ~ '^[A-Z]{3}$'),
 external_reference text,
 note text,
 recorded_by uuid,
 recorded_at timestamptz not null default now(),
 foreign key(tenant_id,opportunity_id) references connect.opportunities(tenant_id,id) on delete restrict,
 foreign key(tenant_id,recorded_by) references connect.memberships(tenant_id,id) on delete restrict,
 unique(tenant_id,id)
);
create unique index connect_revenue_external_unique on connect.realized_revenue(tenant_id,external_reference) where external_reference is not null;
create index connect_realized_revenue_period on connect.realized_revenue(tenant_id,received_on,opportunity_id);
-- Exactly one campaign attribution per opportunity for single-touch reporting.
-- Do not force campaign attribution where attribution is unknown.
create unique index connect_one_campaign_per_opportunity
 on connect.attribution(tenant_id,opportunity_id)
 where opportunity_id is not null and campaign_id is not null;
alter table connect.campaign_spend enable row level security;
alter table connect.realized_revenue enable row level security;
revoke all on connect.campaign_spend,connect.realized_revenue from public,anon,authenticated;
grant select,insert,update,delete on connect.campaign_spend,connect.realized_revenue to service_role;

create or replace function public.connect_report_write(
 p_actor_id uuid,p_tenant_id uuid,p_action text,p_data jsonb
) returns jsonb language plpgsql security invoker set search_path=''
as $fn$
declare v_role text;v_member uuid;v_currency text;v_id uuid;v_amount numeric;v_campaign uuid;
begin
 select m.role,m.id,t.default_currency into v_role,v_member,v_currency
 from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.tenant_id=p_tenant_id and m.user_id=p_actor_id
  and m.status='active' and t.status in ('trial','active');
 if v_role is null or v_role not in ('owner','admin','manager') then
  raise exception 'Analytics finance management role required' using errcode='42501';end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' then
  raise exception 'Invalid record payload' using errcode='22023';end if;
 v_amount:=nullif(p_data->>'amount','')::numeric;
 if p_action='create_campaign' then
  if length(btrim(coalesce(p_data->>'name',''))) not between 2 and 150
   or length(coalesce(p_data->>'source',''))>80 then
   raise exception 'Invalid campaign details' using errcode='22023';end if;
  insert into connect.campaigns(tenant_id,name,source)
  values(p_tenant_id,btrim(p_data->>'name'),
   lower(nullif(btrim(p_data->>'source'),''))) returning id into v_id;
 elsif p_action='attribute_campaign' then
  v_campaign:=(p_data->>'campaignId')::uuid;
  if not exists(select 1 from connect.campaigns where tenant_id=p_tenant_id and id=v_campaign)
   or not exists(select 1 from connect.opportunities where tenant_id=p_tenant_id
    and id=(p_data->>'opportunityId')::uuid) then
   raise exception 'Campaign or opportunity unavailable' using errcode='42501';end if;
  if exists(select 1 from connect.attribution
   where tenant_id=p_tenant_id and opportunity_id=(p_data->>'opportunityId')::uuid
    and campaign_id is not null) then
   raise exception 'Opportunity already has campaign attribution' using errcode='23505';end if;
  insert into connect.attribution(tenant_id,opportunity_id,campaign_id,source,medium)
  select p_tenant_id,o.id,v_campaign,coalesce(c.source,'unknown'),'campaign'
  from connect.opportunities o join connect.campaigns c on c.tenant_id=o.tenant_id and c.id=v_campaign
  where o.tenant_id=p_tenant_id and o.id=(p_data->>'opportunityId')::uuid returning id into v_id;
 elsif p_action in ('record_spend','record_revenue') then
  if v_amount is null or v_amount<=0 or v_amount>999999999999.99
   or (p_data->>'currency') is distinct from v_currency
   or length(coalesce(p_data->>'note',''))>500 then
   raise exception 'Positive amount in institute base currency is required' using errcode='22023';end if;
  if p_action='record_spend' then
   insert into connect.campaign_spend(tenant_id,campaign_id,spent_on,amount,currency,note,recorded_by)
   values(p_tenant_id,(p_data->>'campaignId')::uuid,(p_data->>'date')::date,v_amount,v_currency,
    nullif(p_data->>'note',''),v_member) returning id into v_id;
  else
   if length(btrim(coalesce(p_data->>'reference',''))) not between 3 and 180 then
    raise exception 'A unique payment reference is required to avoid duplicate receipts' using errcode='22023';end if;
   if not exists(select 1 from connect.opportunities
     where tenant_id=p_tenant_id and id=(p_data->>'opportunityId')::uuid
       and currency=v_currency) then
    raise exception 'Admission currency must match the reporting base currency' using errcode='22023';
   end if;
   insert into connect.realized_revenue(tenant_id,opportunity_id,received_on,amount,currency,
    external_reference,note,recorded_by)
   values(p_tenant_id,(p_data->>'opportunityId')::uuid,(p_data->>'date')::date,v_amount,v_currency,
    nullif(p_data->>'reference',''),nullif(p_data->>'note',''),v_member)
   returning id into v_id;
  end if;
 else raise exception 'Unknown analytics operation' using errcode='22023';end if;
 insert into connect.audit_events(tenant_id,actor_membership_id,event_type,entity_type,entity_id,metadata)
 values(p_tenant_id,v_member,p_action,'reporting',v_id,
  jsonb_build_object('kind',p_action));
 return jsonb_build_object('ok',true,'id',v_id);
end $fn$;

create or replace function public.connect_report_read(
 p_actor_id uuid,p_tenant_id uuid,p_from date,p_to date,
 p_pipeline_id uuid default null
) returns jsonb language plpgsql stable security invoker set search_path=''
as $fn$
declare v_member uuid;v_role text;v_tz text;v_currency text;v_start timestamptz;v_end timestamptz;
 v_summary jsonb;v_funnel jsonb;v_journey jsonb;v_staff jsonb;v_sources jsonb;v_campaigns jsonb;
 v_opps bigint;v_won bigint;v_spend numeric;v_revenue numeric;v_opportunity_revenue numeric;
begin
 select m.id,m.role,t.timezone,t.default_currency into v_member,v_role,v_tz,v_currency
 from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active'
  and t.status in ('trial','active');
 if v_member is null then raise exception 'Workspace unavailable' using errcode='42501';end if;
 -- Detailed reporting only for managers; counsellors should not see other staff finances.
 if v_role not in ('owner','admin','manager') then
  raise exception 'Reporting permission required' using errcode='42501';end if;
 if p_from is null or p_to is null or p_from>p_to or (p_to-p_from)>366
   or p_to>current_date+1 then raise exception 'Invalid reporting date range' using errcode='22023';end if;
 if p_pipeline_id is not null and not exists(
  select 1 from connect.pipelines where tenant_id=p_tenant_id and id=p_pipeline_id
 ) then raise exception 'Pipeline unavailable' using errcode='42501';end if;
 v_start:=p_from::timestamp at time zone v_tz;
 v_end:=(p_to+1)::timestamp at time zone v_tz;

 -- Conversion cohort = opportunities created in the period. Stage is current,
 -- not an as-of-period snapshot. Multiple enquiries are not double-counted.
 with eligible as (
  select o.* ,s.outcome from connect.opportunities o
  join connect.pipeline_stages s on s.tenant_id=o.tenant_id and s.id=o.stage_id
  where o.tenant_id=p_tenant_id and o.created_at>=v_start and o.created_at<v_end
   and (p_pipeline_id is null or o.pipeline_id=p_pipeline_id)
 )
 select count(*),count(*) filter(where outcome='won') into v_opps,v_won from eligible;
 select jsonb_build_object(
  'opportunities',v_opps,'won',v_won,
  'conversionRate',case when v_opps=0 then null else round(100.0*v_won/v_opps,2) end,
  'inquiries',(select count(*) from connect.inquiries i where i.tenant_id=p_tenant_id
    and i.received_at>=v_start and i.received_at<v_end
    and (p_pipeline_id is null or exists(
     select 1 from connect.opportunities o where o.id=i.opportunity_id and o.tenant_id=p_tenant_id
     and o.pipeline_id=p_pipeline_id))),
  'expectedValue',(select coalesce(sum(o.expected_value),0) from connect.opportunities o
   where o.tenant_id=p_tenant_id and o.created_at>=v_start and o.created_at<v_end
   and o.currency=v_currency
   and (p_pipeline_id is null or o.pipeline_id=p_pipeline_id)),
  'excludedCurrencyOpportunities',(select count(*) from connect.opportunities o
   where o.tenant_id=p_tenant_id and o.created_at>=v_start and o.created_at<v_end
    and o.currency<>v_currency and o.expected_value is not null
    and (p_pipeline_id is null or o.pipeline_id=p_pipeline_id)),
  'currency',v_currency,'fromDate',p_from,'toDate',p_to
 ) into v_summary;

 -- Funnel: current stage for the selected opportunity creation cohort;
 -- includes outcome and denominators. Does NOT claim historical stage-through rates.
 select coalesce(jsonb_agg(jsonb_build_object('pipelineId',q.pipeline_id,'pipeline',q.pipeline,
  'stageId',q.stage_id,'stage',q.stage,'sortOrder',q.sort_order,'outcome',q.outcome,
  'opportunities',q.opp_count) order by q.pipeline,q.sort_order),'[]'::jsonb)
 into v_funnel
 from (select p.id as pipeline_id,p.name as pipeline,s.id as stage_id,s.name as stage,
  s.sort_order,s.outcome,count(o.id) as opp_count
  from connect.pipelines p join connect.pipeline_stages s on s.tenant_id=p.tenant_id and s.pipeline_id=p.id
  left join connect.opportunities o on o.tenant_id=p.tenant_id
   and o.pipeline_id=p.id and o.stage_id=s.id and o.created_at>=v_start and o.created_at<v_end
  where p.tenant_id=p_tenant_id and (p_pipeline_id is null or p.id=p_pipeline_id)
  group by p.id,p.name,s.id,s.name,s.sort_order,s.outcome) q;

 -- Historical reach: each opportunity counted once per stage it has ever entered.
 -- Denominator remains the same created-during-period opportunity cohort, not stage-to-stage.
 select coalesce(jsonb_agg(jsonb_build_object(
  'pipelineId',q.pipeline_id,'pipeline',q.pipeline,'stageId',q.stage_id,'stage',q.stage,
  'sortOrder',q.sort_order,'outcome',q.outcome,
  'reached',q.reached,
  'cohort',q.cohort,
  'reachPercent',case when q.cohort=0 then null else round(100.0*q.reached/q.cohort,2) end)
  order by q.pipeline,q.sort_order),'[]'::jsonb) into v_journey
 from (
  select p.id as pipeline_id,p.name as pipeline,s.id as stage_id,s.name as stage,s.sort_order,s.outcome,
   (select count(distinct e.opportunity_id)
    from connect.stage_events e join connect.opportunities o on o.tenant_id=e.tenant_id and o.id=e.opportunity_id
    where e.tenant_id=p_tenant_id and e.pipeline_id=p.id and e.to_stage_id=s.id
      and o.created_at>=v_start and o.created_at<v_end) as reached,
   (select count(*) from connect.opportunities o where o.tenant_id=p_tenant_id
      and o.pipeline_id=p.id and o.created_at>=v_start and o.created_at<v_end) as cohort
  from connect.pipelines p join connect.pipeline_stages s on s.tenant_id=p.tenant_id and s.pipeline_id=p.id
  where p.tenant_id=p_tenant_id and (p_pipeline_id is null or p.id=p_pipeline_id)
 ) q;

 -- Current assignee attribution. Unknown/unassigned excluded from person rows but shown separately.
 select coalesce(jsonb_agg(to_jsonb(q) order by q.won desc,q.opportunities desc),'[]'::jsonb)
 into v_staff
 from (select m.id as "memberId",m.role,
   count(o.id) as opportunities,
   count(o.id) filter(where s.outcome='won') as won,
   count(o.id) filter(where s.outcome='open') as open,
   count(o.id) filter(where s.outcome='lost') as lost,
   case when count(o.id)=0 then null else round(100.0*count(o.id) filter(where s.outcome='won')/count(o.id),2) end as "conversionRate",
   (select count(*) from connect.tasks t where t.tenant_id=p_tenant_id and t.assignee_membership_id=m.id
      and t.created_at>=v_start and t.created_at<v_end and t.status='done') as "tasksCompleted"
  from connect.memberships m
  left join connect.opportunities o on o.tenant_id=m.tenant_id
    and o.owner_membership_id=m.id and o.created_at>=v_start and o.created_at<v_end
    and (p_pipeline_id is null or o.pipeline_id=p_pipeline_id)
  left join connect.pipeline_stages s on s.tenant_id=o.tenant_id and s.id=o.stage_id
  where m.tenant_id=p_tenant_id and m.role in ('owner','admin','manager','counsellor')
  group by m.id,m.role) q;

 -- Each opportunity credited once to its earliest associated enquiry source.
 -- Spend source is the source declared by campaign. Revenue is recorded paid amount,
 -- grouped by associated opportunity's first-touch source, in the period received.
 with first_source as (
  select distinct on (i.opportunity_id) i.opportunity_id,lower(trim(i.source)) as source
  from connect.inquiries i
  where i.tenant_id=p_tenant_id and i.opportunity_id is not null
  order by i.opportunity_id,i.received_at,i.id
 ), sources as (
  select lower(trim(i.source)) as source,count(*) as inquiries
  from connect.inquiries i where i.tenant_id=p_tenant_id
   and i.received_at>=v_start and i.received_at<v_end
  group by lower(trim(i.source))
 ), conversions as (
  select coalesce(f.source,'unattributed') as source,count(*) as opportunities,
   count(*) filter(where s.outcome='won') as won
  from connect.opportunities o
  join connect.pipeline_stages s on s.tenant_id=o.tenant_id and s.id=o.stage_id
  left join first_source f on f.opportunity_id=o.id
  where o.tenant_id=p_tenant_id and o.created_at>=v_start and o.created_at<v_end
   and (p_pipeline_id is null or o.pipeline_id=p_pipeline_id)
  group by coalesce(f.source,'unattributed')
 ), income as (
  select coalesce(f.source,'unattributed') as source,sum(r.amount) as revenue
  from connect.realized_revenue r join connect.opportunities o on o.tenant_id=r.tenant_id and o.id=r.opportunity_id
  left join first_source f on f.opportunity_id=o.id
  where r.tenant_id=p_tenant_id and r.received_on between p_from and p_to
   and (p_pipeline_id is null or o.pipeline_id=p_pipeline_id)
  group by coalesce(f.source,'unattributed')
 ), spend as (
  select lower(trim(coalesce(c.source,'unattributed'))) as source,sum(sp.amount) as spend
  from connect.campaign_spend sp join connect.campaigns c on c.tenant_id=sp.tenant_id and c.id=sp.campaign_id
  where sp.tenant_id=p_tenant_id and sp.spent_on between p_from and p_to
   and p_pipeline_id is null
  group by lower(trim(coalesce(c.source,'unattributed')))
 )
 select coalesce(jsonb_agg(jsonb_build_object('source',k.source,'inquiries',coalesce(sr.inquiries,0),
  'opportunities',coalesce(cv.opportunities,0),'won',coalesce(cv.won,0),
  'conversionRate',case when coalesce(cv.opportunities,0)=0 then null else round(100.0*cv.won/cv.opportunities,2) end,
  'spend',sp.spend,'revenue',inc.revenue,
  'roiPercent',case when coalesce(sp.spend,0)<=0 then null else round(100*(coalesce(inc.revenue,0)-sp.spend)/sp.spend,2) end)
  order by coalesce(sr.inquiries,0) desc,k.source),'[]'::jsonb) into v_sources
 from (select source from sources union select source from conversions
       union select source from income union select source from spend) k
 left join sources sr on sr.source=k.source
 left join conversions cv on cv.source=k.source
 left join income inc on inc.source=k.source
 left join spend sp on sp.source=k.source;

 -- Campaign ROI: paid revenue for specifically attributed opportunities in range.
 with spend as (
  select campaign_id,sum(amount) amount from connect.campaign_spend where tenant_id=p_tenant_id
  and spent_on between p_from and p_to group by campaign_id
 ), revenue as (
  select a.campaign_id,sum(r.amount) amount from connect.realized_revenue r
  join connect.attribution a on a.tenant_id=r.tenant_id and a.opportunity_id=r.opportunity_id
    and a.campaign_id is not null
  join connect.opportunities o on o.tenant_id=r.tenant_id and o.id=r.opportunity_id
  where r.tenant_id=p_tenant_id and r.received_on between p_from and p_to
   and (p_pipeline_id is null or o.pipeline_id=p_pipeline_id)
  group by a.campaign_id
 ), performance as (
  select a.campaign_id,count(distinct a.opportunity_id) as opportunities,
    count(distinct a.opportunity_id) filter(where s.outcome='won') as won
  from connect.attribution a join connect.opportunities o on o.tenant_id=a.tenant_id and o.id=a.opportunity_id
  join connect.pipeline_stages s on s.tenant_id=o.tenant_id and s.id=o.stage_id
  where a.tenant_id=p_tenant_id and a.campaign_id is not null
    and o.created_at>=v_start and o.created_at<v_end
    and (p_pipeline_id is null or o.pipeline_id=p_pipeline_id)
  group by a.campaign_id
 )
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',c.id,'name',c.name,'source',c.source,
  'spend',case when p_pipeline_id is null then sp.amount else null end,'revenue',rv.amount,'opportunities',coalesce(pf.opportunities,0),
  'won',coalesce(pf.won,0),
  'costPerAcquisition',case when coalesce(pf.won,0)=0 or sp.amount is null then null
   else case when p_pipeline_id is null then round(sp.amount/pf.won,2) else null end end,
  'roiPercent',case when p_pipeline_id is not null or coalesce(sp.amount,0)<=0 then null
   else round(100*(coalesce(rv.amount,0)-sp.amount)/sp.amount,2) end)
 order by c.name),'[]'::jsonb) into v_campaigns
 from connect.campaigns c
 left join spend sp on sp.campaign_id=c.id
 left join revenue rv on rv.campaign_id=c.id
 left join performance pf on pf.campaign_id=c.id
 where c.tenant_id=p_tenant_id;

 return jsonb_build_object('summary',v_summary,'funnel',v_funnel,'stageJourney',v_journey,'staff',v_staff,
  'sources',v_sources,'campaigns',v_campaigns,
  'definitions',jsonb_build_object(
    'conversion','Currently-won opportunities created during selected period / all opportunities created during that period',
    'staff','Current opportunity owner, not historical closer',
    'funnel','Current stage of opportunities created in selected period, not historical funnel stage-entry counts',
    'stageJourney','Count of distinct opportunities from the creation cohort that entered each stage, based on stage events; percentages use the full pipeline cohort',
    'sources','Earliest linked enquiry per opportunity; missing source is Unattributed',
    'roi','(Recorded paid revenue minus recorded campaign spend) / campaign spend, by ledger dates',
    'revenue','Only manually recorded receipts; expected pipeline value is not paid revenue',
    'currency',v_currency,'pipelineSpend','Spend is not allocated across pipelines; source and campaign ROI are suppressed for pipeline-specific reports'
  ));
end $fn$;
revoke all on function public.connect_report_write(uuid,uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.connect_report_read(uuid,uuid,date,date,uuid) from public,anon,authenticated;
grant execute on function public.connect_report_write(uuid,uuid,text,jsonb) to service_role;
grant execute on function public.connect_report_read(uuid,uuid,date,date,uuid) to service_role;


-- ===== SOURCE: database/connect/saas/20_simple_mode_enquiry_classification.sql =====
create table connect.workspace_preferences(
 tenant_id uuid primary key references connect.tenants(id) on delete cascade,
 interface_mode text not null default 'simple' check(interface_mode in ('simple','advanced')),
 updated_at timestamptz not null default now()
);
create table connect.enquiry_categories(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references connect.tenants(id) on delete cascade,
 label text not null check(length(btrim(label)) between 2 and 80),
 sort_order integer not null default 0,
 active boolean not null default true,
 created_at timestamptz not null default now(),
 unique(tenant_id,id)
);
create unique index connect_enquiry_category_label on connect.enquiry_categories(tenant_id,lower(btrim(label)));
alter table connect.inquiries add column category_id uuid;
alter table connect.inquiries add constraint connect_inquiry_category_fk
 foreign key(tenant_id,category_id) references connect.enquiry_categories(tenant_id,id) on delete restrict;
create index connect_inquiries_category on connect.inquiries(tenant_id,category_id,received_at desc);
alter table connect.workspace_preferences enable row level security;
alter table connect.enquiry_categories enable row level security;
revoke all on connect.workspace_preferences,connect.enquiry_categories from public,anon,authenticated;
grant select,insert,update,delete on connect.workspace_preferences,connect.enquiry_categories to service_role;

create or replace function connect.initialize_enquiry_categories() returns trigger
language plpgsql security definer set search_path='' as $fn$
declare labels text[]:=array['Online Courses','Offline Courses','Kits & Components','School Programs','Partnerships','Collaborations','Trainer / Job Applicant','Vendor / Supplier','General / Other'];v_label text;idx int:=0;
begin
 insert into connect.workspace_preferences(tenant_id) values(new.id);
 foreach v_label in array labels loop
  idx:=idx+1;
  insert into connect.enquiry_categories(tenant_id,label,sort_order) values(new.id,v_label,idx);
 end loop;
 return new;
end $fn$;
create trigger connect_tenant_default_categories after insert on connect.tenants
 for each row execute function connect.initialize_enquiry_categories();
insert into connect.workspace_preferences(tenant_id) select id from connect.tenants on conflict do nothing;
insert into connect.enquiry_categories(tenant_id,label,sort_order)
select t.id,defaults.label,defaults.ordinality from connect.tenants t
cross join unnest(array['Online Courses','Offline Courses','Kits & Components','School Programs','Partnerships','Collaborations','Trainer / Job Applicant','Vendor / Supplier','General / Other']) with ordinality defaults(label,ordinality)
on conflict do nothing;

create or replace function public.connect_enquiry_preferences(
 p_actor_id uuid,p_tenant_id uuid,p_action text default 'read',p_data jsonb default '{}'::jsonb
) returns jsonb language plpgsql security invoker set search_path='' as $fn$
declare v_role text;v_member uuid;v_id uuid;v_mode text;v_categories jsonb;v_label text;v_category uuid;
begin
 select m.id,m.role into v_member,v_role from connect.memberships m
 join connect.tenants t on t.id=m.tenant_id
 where m.tenant_id=p_tenant_id and m.user_id=p_actor_id and m.status='active' and t.status in ('trial','active');
 if v_member is null then raise exception 'Institute access denied' using errcode='42501';end if;
 if p_action not in ('read','classify_inquiry') and v_role not in ('owner','admin') then raise exception 'Institute owner/admin required' using errcode='42501';end if;
 if p_action='set_mode' then
  v_mode:=p_data->>'mode';
  if v_mode not in ('simple','advanced') or v_mode is null then raise exception 'Invalid interface mode' using errcode='22023';end if;
  update connect.workspace_preferences set interface_mode=v_mode,updated_at=now() where tenant_id=p_tenant_id;
 elsif p_action='add_category' then
  v_label:=btrim(p_data->>'label');
  if v_label is null or length(v_label) not between 2 and 80 then raise exception 'Invalid category label' using errcode='22023';end if;
  insert into connect.enquiry_categories(tenant_id,label,sort_order)
  values(p_tenant_id,v_label,(select coalesce(max(sort_order),0)+1 from connect.enquiry_categories where tenant_id=p_tenant_id))
  returning id into v_id;
 elsif p_action='rename_category' then
  v_category:=(p_data->>'id')::uuid;v_label:=btrim(p_data->>'label');
  if v_label is null or length(v_label) not between 2 and 80 then raise exception 'Invalid category label' using errcode='22023';end if;
  update connect.enquiry_categories set label=v_label where tenant_id=p_tenant_id and id=v_category returning id into v_id;
  if v_id is null then raise exception 'Category unavailable' using errcode='42501';end if;
 elsif p_action='set_category_active' then
  v_category:=(p_data->>'id')::uuid;
  if jsonb_typeof(p_data->'active')<>'boolean' then raise exception 'Invalid category status' using errcode='22023';end if;
  update connect.enquiry_categories set active=(p_data->>'active')::boolean where tenant_id=p_tenant_id and id=v_category returning id into v_id;
  if v_id is null then raise exception 'Category unavailable' using errcode='42501';end if;
 elsif p_action='classify_inquiry' then
  if v_role='viewer' then raise exception 'Classification requires staff access' using errcode='42501';end if;
  v_category:=(p_data->>'categoryId')::uuid;
  if not exists(select 1 from connect.enquiry_categories where tenant_id=p_tenant_id and id=v_category and active)
  then raise exception 'Category unavailable' using errcode='42501';end if;
  update connect.inquiries set category_id=v_category where tenant_id=p_tenant_id and id=(p_data->>'inquiryId')::uuid returning id into v_id;
  if v_id is null then raise exception 'Enquiry unavailable' using errcode='42501';end if;
 else
  if p_action<>'read' then raise exception 'Unknown preference action' using errcode='22023';end if;
 end if;
 if p_action<>'read' then
  insert into connect.audit_events(tenant_id,actor_membership_id,event_type,entity_type,entity_id,metadata)
  values(p_tenant_id,v_member,'enquiry_'||p_action,'enquiry_configuration',v_id,jsonb_build_object('action',p_action));
 end if;
 select interface_mode into v_mode from connect.workspace_preferences where tenant_id=p_tenant_id;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'label',label,'active',active,'sortOrder',sort_order) order by sort_order,label),'[]'::jsonb)
 into v_categories from connect.enquiry_categories where tenant_id=p_tenant_id;
 return jsonb_build_object('mode',coalesce(v_mode,'simple'),'categories',v_categories);
end $fn$;
revoke all on function public.connect_enquiry_preferences(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.connect_enquiry_preferences(uuid,uuid,text,jsonb) to service_role;


-- ===== SOURCE: database/connect/saas/21_intake_first_inbound.sql =====
-- Admission-safe inbound policy. All inbound messages are enquiries, not automatically admissions.
-- Apply after base ingestion migration (12) and preference migration (20).
create or replace function connect.ingest_event(
 p_account_id uuid,p_event_id text,p_name text,p_email text,p_phone text,p_source text,p_summary text
) returns jsonb language plpgsql volatile security invoker set search_path=''
as $fn$
declare v_account connect.channel_accounts%rowtype;v_person uuid;v_inquiry uuid;v_opp uuid;
 v_pipeline uuid;v_stage uuid;v_email text;v_phone text;v_name text;v_receipt uuid;v_conversation uuid;
begin
 select * into v_account from connect.channel_accounts c
  where c.id=p_account_id and c.status='active' for share;
 if not found then raise exception 'Inactive or unknown channel' using errcode='42501';end if;
 if not exists(select 1 from connect.tenants where id=v_account.tenant_id and status in ('trial','active'))
 then raise exception 'Workspace unavailable' using errcode='42501';end if;
 if p_event_id is null or length(p_event_id) not between 3 and 250
    or p_source is null or length(p_source) not between 2 and 80
 then raise exception 'Invalid event identity' using errcode='22023';end if;
 v_name:=nullif(btrim(coalesce(p_name,'')),'');
 v_email:=nullif(lower(btrim(coalesce(p_email,''))),'');
 v_phone:=nullif(regexp_replace(coalesce(p_phone,''),'[^0-9+]','','g'),'');
 if v_name is null then v_name:='Unknown contact';end if;
 if length(v_name)>150 or length(coalesce(v_email,''))>254
    or (v_email is not null and v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
    or length(coalesce(v_phone,''))>35 or length(coalesce(p_summary,''))>3000
    or (v_email is null and v_phone is null)
 then raise exception 'Invalid lead details' using errcode='22023';end if;

 -- A duplicate provider delivery must be a no-op, including concurrent retries.
 insert into connect.webhook_receipts(
  tenant_id,channel_account_id,external_event_id,event_type,payload,status,attempts)
 values(v_account.tenant_id,v_account.id,p_event_id,'lead_ingest',
    jsonb_build_object('source',p_source), 'pending',1)
 on conflict(tenant_id,channel_account_id,external_event_id) do nothing
 returning id into v_receipt;
 if v_receipt is null then return jsonb_build_object('ok',true,'duplicate',true);end if;

 -- Serialize matching lead contact identity within a tenant; no cross-institute sharing.
 perform pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(v_account.tenant_id::text||':'||coalesce(v_email,v_phone),0));
 if v_email is not null then
  select c.person_id into v_person from connect.contact_methods c
  join connect.people p on p.tenant_id=c.tenant_id and p.id=c.person_id and p.status='active'
  where c.tenant_id=v_account.tenant_id and c.kind='email' and c.normalized_value=v_email
  order by c.created_at,c.id limit 1;
 end if;
 if v_person is null and v_phone is not null then
  select c.person_id into v_person from connect.contact_methods c
  join connect.people p on p.tenant_id=c.tenant_id and p.id=c.person_id and p.status='active'
  where c.tenant_id=v_account.tenant_id and c.kind in ('mobile','phone','whatsapp')
   and c.normalized_value=v_phone
  order by c.created_at,c.id limit 1;
 end if;
 if v_person is null then
  insert into connect.people(tenant_id,full_name) values(v_account.tenant_id,v_name)
    returning id into v_person;
  insert into connect.person_roles(tenant_id,person_id,role)
    values(v_account.tenant_id,v_person,'contact');
 end if;
 if v_email is not null and not exists(
   select 1 from connect.contact_methods where tenant_id=v_account.tenant_id
   and person_id=v_person and kind='email' and normalized_value=v_email
 ) then
  insert into connect.contact_methods(tenant_id,person_id,kind,normalized_value,display_value,is_primary)
   values(v_account.tenant_id,v_person,'email',v_email,v_email,
    not exists(select 1 from connect.contact_methods where tenant_id=v_account.tenant_id
      and person_id=v_person and kind='email'));
 end if;
 if v_phone is not null and not exists(
   select 1 from connect.contact_methods where tenant_id=v_account.tenant_id
   and person_id=v_person and kind='mobile' and normalized_value=v_phone
 ) then
  insert into connect.contact_methods(tenant_id,person_id,kind,normalized_value,display_value,is_primary)
   values(v_account.tenant_id,v_person,'mobile',v_phone,v_phone,
    not exists(select 1 from connect.contact_methods where tenant_id=v_account.tenant_id
      and person_id=v_person and kind='mobile'));
 end if;

 -- Intake-first policy: a message from a trainer, supplier or collaborator is not an admission.
 -- Review/classify the enquiry before opening any pipeline opportunity.
 -- Deliberately do not create or reuse an admissions deal during channel ingestion.
 if v_account.provider in ('whatsapp','email') then
  insert into connect.conversations(tenant_id,channel_account_id,person_id,external_thread_id)
  values(v_account.tenant_id,v_account.id,v_person,v_person::text)
  on conflict(tenant_id,channel_account_id,external_thread_id) where external_thread_id is not null
    do update set person_id=excluded.person_id
  returning id into v_conversation;
  insert into connect.messages(tenant_id,conversation_id,external_message_id,direction,body)
  values(v_account.tenant_id,v_conversation,p_event_id,'inbound',left(p_summary,2000))
  on conflict(tenant_id,conversation_id,external_message_id) where external_message_id is not null do nothing;
 end if;
 insert into connect.inquiries(tenant_id,person_id,opportunity_id,
  channel_account_id,external_event_id,source,summary)
 values(v_account.tenant_id,v_person,v_opp,v_account.id,p_event_id,p_source,left(p_summary,2000))
 returning id into v_inquiry;
 update connect.webhook_receipts set status='processed',processed_at=now()
 where id=v_receipt;
 insert into connect.audit_events(tenant_id,event_type,entity_type,entity_id,metadata)
 values(v_account.tenant_id,'external_lead_ingested','inquiry',v_inquiry,
  jsonb_build_object('provider',v_account.provider,'channelAccountId',v_account.id));
 return jsonb_build_object('ok',true,'duplicate',false,'inquiryId',v_inquiry,'personId',v_person,'opportunityId',v_opp);
end $fn$;


-- ===== SOURCE: database/connect/saas/23_unqualified_enquiry_followups.sql =====
-- Initial next action for enquiries without admissions opportunities.
-- Prevent duplicate tasks on repeated WhatsApp messages from the same person.

create or replace function connect.automate_unqualified_inquiry()
returns trigger language plpgsql security invoker set search_path=''
as $fn$
declare v_policy connect.automation_settings%rowtype;v_assignee uuid;
begin
 if new.person_id is null or new.opportunity_id is not null then return new;end if;
 select * into v_policy from connect.automation_settings where tenant_id=new.tenant_id;
 if not found then
  insert into connect.automation_settings(tenant_id) values(new.tenant_id)
  on conflict(tenant_id) do nothing;
  select * into v_policy from connect.automation_settings where tenant_id=new.tenant_id;
 end if;
 if not v_policy.initial_followup_enabled then return new;end if;
 -- Serialize one-contact task creation across concurrent inbound channel deliveries.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  new.tenant_id::text||':initial-followup:'||new.person_id::text,0));
 if exists(select 1 from connect.tasks t where t.tenant_id=new.tenant_id and t.person_id=new.person_id
  and t.status='open') then return new;end if;
 select m.id into v_assignee from connect.memberships m
 where m.tenant_id=new.tenant_id and m.status='active'
  and m.role in ('counsellor','manager','admin','owner')
 order by case m.role when 'counsellor' then 0 when 'manager' then 1 when 'admin' then 2 else 3 end,
  (select count(*) from connect.tasks t where t.tenant_id=new.tenant_id and t.assignee_membership_id=m.id
   and t.status='open'),m.id limit 1;
 insert into connect.tasks(tenant_id,person_id,assignee_membership_id,title,due_at)
 values(new.tenant_id,new.person_id,v_assignee,'Review and follow up on enquiry',
 now()+pg_catalog.make_interval(hours=>v_policy.followup_delay_hours));
 return new;
end $fn$;
revoke all on function connect.automate_unqualified_inquiry() from public,anon,authenticated;
drop trigger if exists connect_inquiry_initial_followup on connect.inquiries;
create trigger connect_inquiry_initial_followup after insert on connect.inquiries
 for each row execute function connect.automate_unqualified_inquiry();

COMMIT;
