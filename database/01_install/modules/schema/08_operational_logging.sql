-- Robotronix operational observability — canonical additive module.
-- Fresh install: included automatically by scripts/build-fresh-db-install.mjs.
-- Existing DEV/PROD: run this file ONCE after reviewing/backing up the target environment.
-- Does not truncate or rewrite existing data.
begin;
create table if not exists public.portal_job_runs (
 id uuid primary key default gen_random_uuid(),
 job_name text not null check(length(job_name) between 1 and 80),
 started_at timestamptz not null default now(),
 finished_at timestamptz not null default now(),
 status text not null check(status in ('success','partial','failed')),
 processed integer not null default 0 check(processed>=0),
 succeeded integer not null default 0 check(succeeded>=0),
 failed integer not null default 0 check(failed>=0),
 reference_id text not null,
 error_code text,
 duration_ms integer check(duration_ms is null or duration_ms>=0)
);
create index if not exists portal_job_runs_job_date_idx on public.portal_job_runs(job_name,started_at desc);
create index if not exists portal_job_runs_date_idx on public.portal_job_runs(started_at desc);
alter table public.portal_job_runs enable row level security;
revoke all on public.portal_job_runs from anon,authenticated;
grant select on public.portal_job_runs to authenticated;
drop policy if exists portal_job_runs_admin_read on public.portal_job_runs;
create policy portal_job_runs_admin_read on public.portal_job_runs
 for select to authenticated using(public.is_admin());

-- Existing portal log retention primitive is kept; add job-history pruning with bounded window.
create or replace function public.purge_old_portal_job_runs(p_retention_days integer default 30)
returns bigint language plpgsql security invoker set search_path=public
as $$
declare v_deleted bigint;
begin
 if p_retention_days<7 or p_retention_days>365 then
  raise exception 'Retention must be between 7 and 365 days';
 end if;
 delete from public.portal_job_runs
 where started_at<now()-make_interval(days=>p_retention_days);
 get diagnostics v_deleted=row_count;
 return v_deleted;
end $$;
revoke all on function public.purge_old_portal_job_runs(integer) from public,anon,authenticated;
grant execute on function public.purge_old_portal_job_runs(integer) to service_role;
commit;
notify pgrst, 'reload schema';
