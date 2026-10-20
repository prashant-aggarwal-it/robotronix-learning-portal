-- Optional scheduled retention job entrypoint for server-side operations.
-- Use Supabase's Cron UI / pg_cron scheduler to invoke this function daily.
-- Existing database upgrade: run only after 06_PORTAL_SYSTEM_LOGS.sql.
begin;
create or replace function public.purge_old_portal_system_logs(p_retention_days integer default 90)
returns bigint
language plpgsql security invoker
set search_path=public
as $$
declare v_deleted bigint;
begin
 if p_retention_days<30 or p_retention_days>365 then
  raise exception 'Retention must be between 30 and 365 days';
 end if;
 delete from public.portal_system_logs
 where occurred_at < now()-make_interval(days=>p_retention_days);
 get diagnostics v_deleted=row_count;
 return v_deleted;
end $$;
revoke execute on function public.purge_old_portal_system_logs(integer) from public,anon,authenticated;
grant execute on function public.purge_old_portal_system_logs(integer) to service_role;
commit;
-- In Supabase Cron schedule a daily task with service-role authorization.
-- Do not schedule in Production until logging retention policy has been approved.
