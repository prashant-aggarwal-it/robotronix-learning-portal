-- Production-safe operational diagnostics: server-only writes, admin-only reads.
-- Apply in DEV after current baseline. No secrets, raw request bodies or bank details.
begin;
create table if not exists public.portal_system_logs(
 id uuid primary key default gen_random_uuid(),
 occurred_at timestamptz not null default now(),
 level text not null check(level in ('error','warning','info')),
 source text not null,
 action text not null,
 reference_id text not null,
 error_code text,
 safe_message text not null
);
create index if not exists portal_system_logs_date_idx on public.portal_system_logs(occurred_at desc);
create index if not exists portal_system_logs_ref_idx on public.portal_system_logs(reference_id);
alter table public.portal_system_logs enable row level security;
revoke all on public.portal_system_logs from anon,authenticated;
grant select on public.portal_system_logs to authenticated;
drop policy if exists portal_system_logs_admin_read on public.portal_system_logs;
create policy portal_system_logs_admin_read on public.portal_system_logs
 for select to authenticated using(public.is_admin());
-- service_role retains database-side write privileges; no client insert/update/delete policy.
commit;
