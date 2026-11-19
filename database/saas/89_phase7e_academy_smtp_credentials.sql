begin;
create table if not exists saas.academy_email_smtp_credentials (
 connection_id uuid primary key references saas.academy_email_connections(id) on delete cascade,
 host text not null,
 port integer not null check(port between 1 and 65535),
 secure boolean not null default true,
 username text not null,
 encrypted_password text not null,
 updated_at timestamptz not null default now(),
 constraint academy_smtp_host_valid check(length(host) between 3 and 253 and host ~ '^[A-Za-z0-9.-]+$'),
 constraint academy_smtp_user_valid check(length(username) between 3 and 254)
);
alter table saas.academy_email_smtp_credentials enable row level security;
revoke all on saas.academy_email_smtp_credentials from public,anon,authenticated;
grant select,insert,update,delete on saas.academy_email_smtp_credentials to service_role;
commit;