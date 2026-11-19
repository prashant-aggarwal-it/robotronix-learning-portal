begin;
create table if not exists saas.academy_email_connections (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references saas.organizations(id) on delete cascade,
 provider text not null check (provider in ('google','microsoft','smtp')),
 status text not null default 'disconnected' check (status in ('disconnected','pending','connected','error','revoked')),
 sender_email text,
 sender_verified_at timestamptz,
 credential_reference text,
 last_checked_at timestamptz,
 last_error_code text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique (organization_id,provider),
 constraint connected_requires_verified_sender check (status <> 'connected' or (sender_verified_at is not null and sender_email is not null and credential_reference is not null)),
 constraint valid_sender check (sender_email is null or (length(sender_email)<=254 and sender_email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'))
);
create table if not exists saas.academy_email_delivery_events (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references saas.organizations(id) on delete cascade,
 connection_id uuid references saas.academy_email_connections(id) on delete set null,
 idempotency_key text not null,
 status text not null check(status in ('queued','sending','provider_accepted','failed','cancelled')),
 provider_message_id text,
 error_code text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(organization_id,idempotency_key)
);
create index if not exists academy_email_delivery_org_created_idx on saas.academy_email_delivery_events(organization_id,created_at desc);
alter table saas.academy_email_connections enable row level security;
alter table saas.academy_email_delivery_events enable row level security;
revoke all on saas.academy_email_connections from public,anon,authenticated;
revoke all on saas.academy_email_delivery_events from public,anon,authenticated;
grant select,insert,update,delete on saas.academy_email_connections to service_role;
grant select,insert,update,delete on saas.academy_email_delivery_events to service_role;
commit;
