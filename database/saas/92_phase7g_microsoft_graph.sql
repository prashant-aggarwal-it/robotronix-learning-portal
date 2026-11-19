begin;
alter table saas.academy_email_notification_jobs drop constraint academy_email_notification_jobs_provider_check;
alter table saas.academy_email_notification_jobs add constraint academy_email_notification_jobs_provider_check check(provider in ('google','microsoft','smtp'));
alter table saas.academy_email_notification_preferences drop constraint academy_email_notification_preferences_provider_check;
alter table saas.academy_email_notification_preferences add constraint academy_email_notification_preferences_provider_check check(provider in ('google','microsoft','smtp'));
create table if not exists saas.academy_email_microsoft_credentials(
 connection_id uuid primary key references saas.academy_email_connections(id) on delete cascade,
 encrypted_refresh_token text not null,
 encrypted_access_token text,
 access_expires_at timestamptz,
 updated_at timestamptz not null default now()
);
alter table saas.academy_email_microsoft_credentials enable row level security;
revoke all on saas.academy_email_microsoft_credentials from public,anon,authenticated;
grant select,insert,update,delete on saas.academy_email_microsoft_credentials to service_role;
commit;