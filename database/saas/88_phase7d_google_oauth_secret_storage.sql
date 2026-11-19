begin;
create table if not exists saas.academy_email_oauth_credentials (
 connection_id uuid primary key references saas.academy_email_connections(id) on delete cascade,
 encrypted_refresh_token text not null,
 encrypted_access_token text,
 access_expires_at timestamptz,
 updated_at timestamptz not null default now()
);
alter table saas.academy_email_oauth_credentials enable row level security;
revoke all on saas.academy_email_oauth_credentials from public,anon,authenticated;
grant select,insert,update,delete on saas.academy_email_oauth_credentials to service_role;
create table if not exists saas.academy_email_oauth_states (
 state_hash text primary key,
 organization_id uuid not null references saas.organizations(id) on delete cascade,
 actor_id uuid not null,
 code_verifier_ciphertext text not null,
 expires_at timestamptz not null,
 created_at timestamptz not null default now()
);
alter table saas.academy_email_oauth_states enable row level security;
revoke all on saas.academy_email_oauth_states from public,anon,authenticated;
grant select,insert,delete on saas.academy_email_oauth_states to service_role;
commit;