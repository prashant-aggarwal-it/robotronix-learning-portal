-- Admin-only operational issue state. Events remain immutable.
begin;
create table if not exists public.portal_log_issues (
 fingerprint text primary key check(length(fingerprint) between 1 and 240),
 status text not null default 'open' check(status in ('open','investigating','resolved')),
 note text not null default '' check(length(note)<=500),
 updated_at timestamptz not null default now(),
 updated_by uuid references public.profiles(id) on delete set null
);
alter table public.portal_log_issues enable row level security;
revoke all on public.portal_log_issues from public,anon,authenticated;
grant select,insert,update on public.portal_log_issues to service_role;
commit;
notify pgrst, 'reload schema';
