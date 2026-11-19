begin;
create table if not exists saas.academy_email_notification_jobs(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references saas.organizations(id) on delete cascade,
 event_type text not null check(event_type in ('enrollment','class_reminder','fee_reminder','trainer_update','progress_update','invitation')),
 idempotency_key text not null,
 recipient_email text not null check(length(recipient_email)<=254 and recipient_email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
 subject text not null check(length(subject) between 1 and 240),
 body_text text not null check(length(body_text) between 1 and 100000),
 provider text check(provider in ('google','smtp')),
 status text not null default 'queued' check(status in ('queued','sending','sent','retry','failed','cancelled')),
 attempts integer not null default 0 check(attempts between 0 and 20),
 next_attempt_at timestamptz not null default now(),
 locked_at timestamptz,
 last_error_code text,
 provider_message_id text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(organization_id,idempotency_key)
);
create index if not exists academy_email_jobs_due_idx on saas.academy_email_notification_jobs(next_attempt_at,created_at) where status in ('queued','retry');
alter table saas.academy_email_notification_jobs enable row level security;
revoke all on saas.academy_email_notification_jobs from public,anon,authenticated;
grant select,insert,update,delete on saas.academy_email_notification_jobs to service_role;
create table if not exists saas.academy_email_notification_preferences(
 organization_id uuid primary key references saas.organizations(id) on delete cascade,
 enabled boolean not null default false,
 provider text check(provider in ('google','smtp')),
 enabled_events text[] not null default array[]::text[],
 updated_at timestamptz not null default now()
);
alter table saas.academy_email_notification_preferences enable row level security;
revoke all on saas.academy_email_notification_preferences from public,anon,authenticated;
grant select,insert,update,delete on saas.academy_email_notification_preferences to service_role;
commit;