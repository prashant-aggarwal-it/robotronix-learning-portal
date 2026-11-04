-- Connect SaaS v2: independent multi-tenant foundation.
-- Valid on a separate Connect Supabase project; NO Learning Portal tables referenced.
-- No sample tenants or hard-coded Robotronix records. PostgreSQL 15+.
begin;
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
 kind text not null default 'contact' check(kind in ('contact','learner','guardian','staff','other')),
 status text not null default 'active' check(status in ('active','archived')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(tenant_id,id)
);
create index connect_people_name_idx on connect.people(tenant_id,lower(full_name));
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
 state text not null default 'open' check(state in ('open','won','lost')),
 closed_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 version integer not null default 1 check(version>0),
 foreign key(tenant_id,pipeline_id) references connect.pipelines(tenant_id,id) on delete restrict,
 foreign key(tenant_id,pipeline_id,stage_id) references connect.pipeline_stages(tenant_id,pipeline_id,id) on delete restrict,
 foreign key(tenant_id,contact_id) references connect.people(tenant_id,id) on delete restrict,
 foreign key(tenant_id,organization_id) references connect.organizations(tenant_id,id) on delete restrict,
 foreign key(tenant_id,owner_membership_id) references connect.memberships(tenant_id,id) on delete restrict,
 check(contact_id is not null or organization_id is not null),unique(tenant_id,id)
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
 opportunity_id uuid not null,from_stage_id uuid,to_stage_id uuid not null,
 changed_by_membership_id uuid,changed_at timestamptz not null default now(),note text,
 foreign key(tenant_id,opportunity_id) references connect.opportunities(tenant_id,id) on delete restrict,
 foreign key(tenant_id,from_stage_id) references connect.pipeline_stages(tenant_id,id) on delete restrict,
 foreign key(tenant_id,to_stage_id) references connect.pipeline_stages(tenant_id,id) on delete restrict,
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
commit;
