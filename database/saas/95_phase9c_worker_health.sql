-- Phase 9C: bounded service-role-only worker telemetry.
create table if not exists saas.platform_worker_heartbeats (
 worker_key text primary key,
 last_started_at timestamptz,
 last_completed_at timestamptz,
 last_failed_at timestamptz,
 last_status text not null default 'unknown',
 last_discovered integer,
 last_processed integer,
 last_error_code text,
 updated_at timestamptz not null default now(),
 constraint platform_worker_key_chk check (worker_key='academy_notifications'),
 constraint platform_worker_status_chk check (last_status in ('running','success','failed','unknown'))
);
alter table saas.platform_worker_heartbeats enable row level security;
revoke all on saas.platform_worker_heartbeats from public,anon,authenticated;
grant select,insert,update on saas.platform_worker_heartbeats to service_role;

create or replace function public.saas_platform_worker_heartbeat_v1(
 p_event text,p_discovered integer default null,p_processed integer default null,p_error text default null)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if p_event not in ('started','success','failed') then raise exception 'Invalid event'; end if;
 insert into saas.platform_worker_heartbeats(worker_key,last_started_at,last_completed_at,last_failed_at,last_status,last_discovered,last_processed,last_error_code,updated_at)
 values ('academy_notifications',
  case when p_event='started' then now() end,
  case when p_event='success' then now() end,
  case when p_event='failed' then now() end,
  case when p_event='started' then 'running' else p_event end,
  case when p_event='success' then greatest(0,p_discovered) end,
  case when p_event='success' then greatest(0,p_processed) end,
  case when p_event='failed' then left(coalesce(p_error,'worker_failed'),80) end,now())
 on conflict(worker_key) do update set
 last_started_at=coalesce(excluded.last_started_at,saas.platform_worker_heartbeats.last_started_at),
 last_completed_at=coalesce(excluded.last_completed_at,saas.platform_worker_heartbeats.last_completed_at),
 last_failed_at=coalesce(excluded.last_failed_at,saas.platform_worker_heartbeats.last_failed_at),
 last_status=excluded.last_status,
 last_discovered=coalesce(excluded.last_discovered,saas.platform_worker_heartbeats.last_discovered),
 last_processed=coalesce(excluded.last_processed,saas.platform_worker_heartbeats.last_processed),
 last_error_code=case when p_event='success' then null when p_event='failed' then excluded.last_error_code else saas.platform_worker_heartbeats.last_error_code end,
 updated_at=now();
 return true;
end $$;
revoke all on function public.saas_platform_worker_heartbeat_v1(text,integer,integer,text) from public,anon,authenticated;
grant execute on function public.saas_platform_worker_heartbeat_v1(text,integer,integer,text) to service_role;

create or replace function public.saas_platform_worker_health_v1()
returns jsonb language sql security invoker set search_path='' as $$
with stats as (
 select count(*) filter(where status='queued') as queued,
 count(*) filter(where status='retry') as retry,
 count(*) filter(where status='failed') as failed,
 count(*) filter(where status='sending') as sending,
 count(*) filter(where attempts>1 and status in ('retry','sending','failed')) as retried,
 extract(epoch from (now()-min(created_at) filter(where status in ('queued','retry'))))/60 as oldest_wait_minutes,
 count(*) filter(where status='sending' and locked_at<now()-interval '15 minutes') as stale_sending,
 count(*) filter(where status in ('queued','retry') and next_attempt_at<=now()) as due
 from saas.academy_email_notification_jobs
), heartbeat as (
 select last_started_at,last_completed_at,last_failed_at,last_status,last_discovered,last_processed,last_error_code
 from saas.platform_worker_heartbeats where worker_key='academy_notifications'
)
select jsonb_build_object('worker','academy_notifications','heartbeat',coalesce((select to_jsonb(h) from heartbeat h),'null'::jsonb),
 'queue',(select jsonb_build_object('queued',queued,'retry',retry,'failed',failed,'sending',sending,
 'retried',retried,'due',due,'staleSending',stale_sending,
 'oldestWaitMinutes',case when oldest_wait_minutes is not null then greatest(0,round(oldest_wait_minutes::numeric,1)) end) from stats),
 'observedAt',now()) $$;
revoke all on function public.saas_platform_worker_health_v1() from public,anon,authenticated;
grant execute on function public.saas_platform_worker_health_v1() to service_role;
