-- Phase 4C: subscription access enforcement and audited lifecycle operations.
begin;
create table if not exists saas.platform_subscription_events(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references saas.organizations(id),
 actor_user_id uuid references auth.users(id),
 event_type text not null,
 previous_status text,
 new_status text,
 plan_code text,
 occurred_at timestamptz not null default now()
);
alter table saas.platform_subscription_events enable row level security;
revoke all on saas.platform_subscription_events from public,anon,authenticated;
grant select,insert on saas.platform_subscription_events to service_role;
create index if not exists platform_subscription_events_org_time on saas.platform_subscription_events(organization_id,occurred_at desc);
create index if not exists platform_subscriptions_org_latest on saas.platform_subscriptions(organization_id,started_at desc,id desc);
create or replace function public.saas_subscription_access_v1(p_organization_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog
as $fn$
 select exists(select 1 from saas.organizations o where o.id=p_organization_id and o.status='active')
 and exists(select 1 from saas.platform_subscriptions s
 where s.organization_id=p_organization_id
 and s.id=(select x.id from saas.platform_subscriptions x where x.organization_id=p_organization_id order by x.started_at desc,x.id desc limit 1)
 and s.status in ('trial','active')
 and s.started_at<=now() and (s.ends_at is null or s.ends_at>now()));
$fn$;
revoke all on function public.saas_subscription_access_v1(uuid) from public,anon,authenticated;
grant execute on function public.saas_subscription_access_v1(uuid) to service_role;
-- All shared module-gate consumers must fail closed when the latest subscription has expired.
create or replace function public.saas_authorized_module_entitlements(p_actor_id uuid,p_organization_id uuid)
returns table(module_key text,enabled boolean)
language sql stable security definer set search_path=pg_catalog
as $fn$
 select e.module_key,
 (e.enabled and public.saas_subscription_access_v1(e.organization_id)) as enabled
 from saas.module_entitlements e
 join saas.organizations o on o.id=e.organization_id
 where e.organization_id=p_organization_id and o.status='active'
 and exists(select 1 from saas.memberships m where m.organization_id=e.organization_id and m.user_id=p_actor_id and m.status='active');
$fn$;
-- Subscription management is service-role-only and requires a verified platform admin.
create or replace function public.saas_platform_subscription_manage_v1(
 p_actor_id uuid,p_organization_id uuid,p_action text,
 p_plan_code text default null,p_end_at timestamptz default null,p_module_key text default null,p_enabled boolean default null
) returns jsonb language plpgsql security definer set search_path=pg_catalog
as $fn$
declare v_previous saas.platform_subscriptions%rowtype;v_status text;v_plan text;v_id uuid;
begin
 if auth.role()<>'service_role' or not exists(select 1 from saas.platform_administrators where user_id=p_actor_id and active)
 then raise exception 'Platform administrator required' using errcode='42501';end if;
 if not exists(select 1 from saas.organizations where id=p_organization_id)
 then raise exception 'Organization not found' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtext(p_organization_id::text),hashtext('subscription'));
 select * into v_previous from saas.platform_subscriptions where organization_id=p_organization_id order by started_at desc,id desc limit 1 for update;
 if p_action='set_module' then
  if p_module_key not in ('academy','crm','tasks') or p_enabled is null then raise exception 'Invalid module' using errcode='22023';end if;
  insert into saas.module_entitlements(organization_id,module_key,enabled)
  values(p_organization_id,p_module_key,p_enabled)
  on conflict(organization_id,module_key) do update set enabled=excluded.enabled;
  insert into saas.platform_subscription_events(organization_id,actor_user_id,event_type,previous_status,new_status,plan_code)
  values(p_organization_id,p_actor_id,'module_'||p_module_key||'_'||p_enabled::text,v_previous.status,v_previous.status,v_previous.plan_code);
  return jsonb_build_object('ok',true,'action',p_action);
 end if;
 if p_action not in ('extend_trial','activate','mark_past_due','suspend','cancel','resume') then
  raise exception 'Unsupported subscription action' using errcode='22023';end if;
 if v_previous.id is null then raise exception 'Subscription missing' using errcode='22023';end if;
 if p_action='extend_trial' then
  if v_previous.status<>'trial' or p_end_at is null or p_end_at<=greatest(now(),coalesce(v_previous.ends_at,now())) or p_end_at>now()+interval '90 days'
  then raise exception 'Invalid trial extension' using errcode='22023';end if;
  v_status:='trial';v_plan:='trial';
 elsif p_action='activate' then
  if p_plan_code is null or p_plan_code !~ '^[a-z][a-z0-9_]{1,39}$' or p_plan_code='trial' or p_end_at is null or p_end_at<=now()
  then raise exception 'Invalid paid plan or end date' using errcode='22023';end if;
  v_status:='active';v_plan:=p_plan_code;
 elsif p_action='mark_past_due' then
  if v_previous.status<>'active' then raise exception 'Active subscription required' using errcode='22023';end if;
  v_status:='past_due';v_plan:=v_previous.plan_code;
 elsif p_action='suspend' then
  if v_previous.status not in ('active','trial','past_due') then raise exception 'Subscription not suspendable' using errcode='22023';end if;
  v_status:='suspended';v_plan:=v_previous.plan_code;
 elsif p_action='cancel' then
  if v_previous.status='cancelled' then raise exception 'Already cancelled' using errcode='22023';end if;
  v_status:='cancelled';v_plan:=v_previous.plan_code;
 else
  if v_previous.status not in ('suspended','past_due') or v_previous.ends_at is null or v_previous.ends_at<=now()
  then raise exception 'Renewal required before resume' using errcode='22023';end if;
  v_status:=case when v_previous.plan_code='trial' then 'trial' else 'active' end;v_plan:=v_previous.plan_code;
 end if;
 -- A new immutable subscription row records each transition, so the latest row is authoritative.
 insert into saas.platform_subscriptions(organization_id,plan_code,status,started_at,ends_at)
 values(p_organization_id,v_plan,v_status,now(),
 case when p_action in ('extend_trial','activate') then p_end_at else
  case when v_previous.ends_at is not null and v_previous.ends_at<=now() then now()+interval '1 second' else v_previous.ends_at end end)
 returning id into v_id;
 insert into saas.platform_subscription_events(organization_id,actor_user_id,event_type,previous_status,new_status,plan_code)
 values(p_organization_id,p_actor_id,p_action,v_previous.status,v_status,v_plan);
 return jsonb_build_object('ok',true,'subscriptionId',v_id,'status',v_status,'plan',v_plan);
end $fn$;
revoke all on function public.saas_platform_subscription_manage_v1(uuid,uuid,text,text,timestamptz,text,boolean) from public,anon,authenticated;
grant execute on function public.saas_platform_subscription_manage_v1(uuid,uuid,text,text,timestamptz,text,boolean) to service_role;
create or replace function public.saas_platform_subscription_overview_v1(p_actor_id uuid,p_organization_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog
as $fn$
declare v_result jsonb;
begin
 if auth.role()<>'service_role' or not exists(select 1 from saas.platform_administrators where user_id=p_actor_id and active)
 then raise exception 'Platform administrator required' using errcode='42501';end if;
 select jsonb_build_object(
 'subscription',(select to_jsonb(s) from saas.platform_subscriptions s where s.organization_id=p_organization_id order by started_at desc,id desc limit 1),
 'modules',coalesce((select jsonb_agg(jsonb_build_object('module',module_key,'enabled',enabled) order by module_key) from saas.module_entitlements where organization_id=p_organization_id),'[]'::jsonb),
 'events',coalesce((select jsonb_agg(to_jsonb(x)) from (select event_type,previous_status,new_status,plan_code,occurred_at from saas.platform_subscription_events where organization_id=p_organization_id order by occurred_at desc limit 30) x),'[]'::jsonb)
 ) into v_result;
 return v_result;
end $fn$;
revoke all on function public.saas_platform_subscription_overview_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.saas_platform_subscription_overview_v1(uuid,uuid) to service_role;
commit;