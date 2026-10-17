-- Robotronix Learning Portal — Calendar V1
-- Private trainer calendar subscriptions. Parent/student calendar views use existing RLS schedule data.

begin;

create table if not exists public.calendar_subscription_tokens (
  id uuid primary key default gen_random_uuid(),
  owner_role text not null check (owner_role in ('trainer')),
  owner_id uuid not null,
  token_hash text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists calendar_subscription_owner_idx
  on public.calendar_subscription_tokens(owner_role, owner_id, active);

alter table public.calendar_subscription_tokens enable row level security;
grant all on table public.calendar_subscription_tokens to service_role;

notify pgrst, 'reload schema';
commit;
