-- One atomic provisioning transaction for authenticated self-service and authorized assisted setup.
begin;
create table if not exists saas.onboarding_requests (
 request_key uuid primary key,
 organization_id uuid not null references saas.organizations(id),
 owner_user_id uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
alter table saas.onboarding_requests enable row level security;
revoke all on saas.onboarding_requests from public,anon,authenticated;
grant select,insert on saas.onboarding_requests to service_role;
create or replace function public.saas_onboard_organization_v1(
 p_actor_id uuid,p_owner_id uuid,p_name text,p_slug text,p_kind text,
 p_modules text[],p_request_key uuid,p_assisted boolean default false
) returns jsonb language plpgsql security definer set search_path=pg_catalog
as $fn$
declare v_org uuid;v_slug text:=lower(btrim(coalesce(p_slug,'')));
 v_name text:=btrim(coalesce(p_name,''));v_modules text[];
 v_days integer:=14;v_existing saas.onboarding_requests%rowtype;
begin
 if p_actor_id is null or p_owner_id is null or p_request_key is null then
  raise exception 'Actor, owner and idempotency key required' using errcode='22023';
 end if;
 if p_assisted then
  if auth.role()<>'service_role' or not exists(
   select 1 from saas.platform_administrators where user_id=p_actor_id and active
  ) then raise exception 'Platform administrator required' using errcode='42501';end if;
 else
  if auth.uid() is distinct from p_actor_id or p_actor_id<>p_owner_id
   or auth.role()<>'authenticated' then
   raise exception 'Authenticated self-service owner required' using errcode='42501';
  end if;
 end if;
 if not exists(select 1 from auth.users where id=p_owner_id and email_confirmed_at is not null and is_anonymous is not true)
 then raise exception 'Existing verified owner required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtext(p_owner_id::text),hashtext('onboard'));
 select * into v_existing from saas.onboarding_requests where request_key=p_request_key;
 if found then
  if v_existing.owner_user_id<>p_owner_id then raise exception 'Request key belongs to another owner' using errcode='42501';end if;
  return jsonb_build_object('organizationId',v_existing.organization_id,'replayed',true);
 end if;
 if char_length(v_name)<2 or char_length(v_name)>160 or
  v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(v_slug) not between 3 and 63 or
  v_slug in ('admin','api','auth','app','apps','connect','login','signup','tasks','portal','student','parent','trainer','onboarding','workspace','www','support','settings','robotronix','platform-admin')
 then raise exception 'Invalid organization name or reserved URL' using errcode='22023';end if;
 if p_kind not in ('academy','institute','tutor') then
  raise exception 'Unsupported organization type' using errcode='22023';end if;
 select array_agg(distinct x order by x) into v_modules from unnest(p_modules) x;
 if v_modules is null or cardinality(v_modules)=0 or exists(
  select 1 from unnest(v_modules) x where x not in ('academy','crm','tasks')
 ) then raise exception 'Choose supported modules' using errcode='22023';end if;
 if not p_assisted and exists(select 1 from saas.memberships where user_id=p_owner_id and role_key='owner' and status='active')
 then raise exception 'You already own an organization' using errcode='23514';end if;
 insert into saas.organizations(slug,display_name,status)
 values(v_slug,v_name,'active') returning id into v_org;
 insert into saas.memberships(organization_id,user_id,role_key,status)
 values(v_org,p_owner_id,'owner','active');
 insert into saas.organization_settings(organization_id,setting_key,setting_value)
 values(v_org,'organization_type',to_jsonb(p_kind));
 insert into saas.platform_subscriptions(organization_id,plan_code,status,started_at,ends_at)
 values(v_org,'trial','trial',now(),now()+make_interval(days=>v_days));
 insert into saas.module_entitlements(organization_id,module_key,enabled)
 select v_org,x,true from unnest(v_modules) x;
 insert into saas.onboarding_requests(request_key,organization_id,owner_user_id)
 values(p_request_key,v_org,p_owner_id);
 if p_assisted then
  insert into saas.platform_admin_audit(actor_user_id,subject_user_id,action)
  values(p_actor_id,p_owner_id,'assisted_organization_created:'||v_org::text);
 end if;
 return jsonb_build_object('organizationId',v_org,'slug',v_slug,'trialDays',v_days,'modules',v_modules,'replayed',false);
exception when unique_violation then
 raise exception 'Organization URL or request key already exists' using errcode='23505';
end $fn$;
revoke all on function public.saas_onboard_organization_v1(uuid,uuid,text,text,text,text[],uuid,boolean) from public,anon;
grant execute on function public.saas_onboard_organization_v1(uuid,uuid,text,text,text,text[],uuid,boolean) to authenticated,service_role;
commit;