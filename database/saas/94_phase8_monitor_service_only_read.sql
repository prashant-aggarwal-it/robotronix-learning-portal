-- Phase 8: service-only metadata RPC for monitoring. No exposed saas tables required.
create or replace function public.saas_platform_monitor_read_v1(p_kind text, p_organization_id uuid default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 if p_kind='administrators' then
  select jsonb_build_object('administrators',
   coalesce((select jsonb_agg(to_jsonb(a)) from (select user_id,role_key,active,created_at from saas.platform_administrators order by created_at desc limit 100) a),'[]'::jsonb),
   'audit',coalesce((select jsonb_agg(to_jsonb(b)) from (select id,actor_user_id,subject_user_id,action,occurred_at from saas.platform_admin_audit order by occurred_at desc limit 50) b),'[]'::jsonb),
   'truncated',(select count(*)>100 from saas.platform_administrators)) into result;
 elsif p_kind='email_health' then
  select jsonb_build_object('windowDays',7,'organizationId',p_organization_id,
   'jobs',jsonb_build_object(
     'queued',count(*) filter (where status='queued'),
     'sending',count(*) filter (where status='sending'),
     'sent',count(*) filter (where status='sent'),
     'failed',count(*) filter (where status='failed')))
  into result from saas.academy_email_notification_jobs
  where created_at>=now()-interval '7 days' and (p_organization_id is null or organization_id=p_organization_id);
  result:=result||(
    select jsonb_build_object('connections',jsonb_build_object(
      'connected',count(*) filter (where status in ('active','connected')),
      'attention',count(*) filter (where status not in ('active','connected'))),
      'connectionRecordsScanned',count(*),
      'connectionsTruncated',(select count(*)>500 from saas.academy_email_connections where p_organization_id is null or organization_id=p_organization_id),
      'connectionDetails',case when p_organization_id is not null then
       coalesce(jsonb_agg(jsonb_build_object('provider',provider,'status',status,'lastErrorCode',last_error_code,'lastCheckedAt',last_checked_at)),'[]'::jsonb)
       else '[]'::jsonb end)
    from (select provider,status,last_error_code,last_checked_at from saas.academy_email_connections
      where p_organization_id is null or organization_id=p_organization_id order by created_at desc limit 500) c);
 elsif p_kind='operations' then
  select jsonb_build_object('subscriptions',coalesce(jsonb_agg(to_jsonb(s)),'[]'::jsonb),
    'truncated',(select count(*)>1000 from saas.platform_subscriptions)) into result
  from (select organization_id,plan_code,status,started_at,ends_at from saas.platform_subscriptions order by ends_at asc nulls last limit 1000) s;
  result:=result||jsonb_build_object('invitations',coalesce(
   (select jsonb_agg(to_jsonb(i)) from (select id,status,expires_at,organization_name from saas.pending_customer_invitations where status='pending' order by expires_at asc limit 500) i),'[]'::jsonb),
   'invitationTruncated',(select count(*)>500 from saas.pending_customer_invitations where status='pending'));
 else
  raise exception 'Unsupported monitoring operation' using errcode='22023';
 end if;
 return result;
end $$;
revoke all on function public.saas_platform_monitor_read_v1(text,uuid) from public,anon,authenticated;
grant execute on function public.saas_platform_monitor_read_v1(text,uuid) to service_role;
