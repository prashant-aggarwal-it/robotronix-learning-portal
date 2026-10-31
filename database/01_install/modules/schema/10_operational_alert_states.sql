-- Operational follow-up state; source records and incident history remain immutable.
begin;
create table if not exists public.portal_operational_alert_states (
 alert_key text primary key check(length(alert_key) between 1 and 240),
 status text not null default 'open' check(status in ('open','acknowledged','resolved')),
 snoozed_until timestamptz,
 assigned_to uuid references public.profiles(id) on delete set null,
 note text not null default '' check(length(note)<=500),
 updated_by uuid references public.profiles(id) on delete set null,
 updated_at timestamptz not null default now()
);
create index if not exists portal_operational_alert_states_updated_idx on public.portal_operational_alert_states(updated_at desc);
alter table public.portal_operational_alert_states enable row level security;
revoke all on public.portal_operational_alert_states from public,anon,authenticated;
grant select,insert,update on public.portal_operational_alert_states to service_role;
commit;
notify pgrst, 'reload schema';
