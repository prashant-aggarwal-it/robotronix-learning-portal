-- DEV additive platform control-plane authorization. Never assign via public signup or JWT metadata.
begin;
create table if not exists saas.platform_administrators (
 user_id uuid primary key references auth.users(id) on delete restrict,
 role_key text not null default 'super_admin' check (role_key='super_admin'),
 active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table saas.platform_administrators enable row level security;
revoke all on saas.platform_administrators from public,anon,authenticated;
grant select,insert,update on saas.platform_administrators to service_role;
create table if not exists saas.platform_admin_audit (
 id uuid primary key default gen_random_uuid(),
 actor_user_id uuid references auth.users(id),
 subject_user_id uuid references auth.users(id),
 action text not null,
 occurred_at timestamptz not null default now()
);
alter table saas.platform_admin_audit enable row level security;
revoke all on saas.platform_admin_audit from public,anon,authenticated;
grant select,insert on saas.platform_admin_audit to service_role;
-- Service-only, with no tenant data access or metadata-derived privileges.
create or replace function public.saas_is_platform_admin_v1(p_actor_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog
as $fn$
 select p_actor_id is not null and exists(
  select 1 from saas.platform_administrators p
  where p.user_id=p_actor_id and p.active
 );
$fn$;
revoke all on function public.saas_is_platform_admin_v1(uuid) from public,anon,authenticated;
grant execute on function public.saas_is_platform_admin_v1(uuid) to service_role;
-- Only a privileged operator may bootstrap; refuse to add a second bootstrap identity.
create or replace function public.saas_bootstrap_platform_admin_v1(p_user_id uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog
as $fn$
declare v_existing uuid;
begin
 if p_user_id is null or not exists(select 1 from auth.users u where u.id=p_user_id and u.email_confirmed_at is not null and u.is_anonymous is not true)
 then raise exception 'Verified existing Auth user required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(834271,119);
 select user_id into v_existing from saas.platform_administrators where active order by created_at limit 1;
 if v_existing is not null and v_existing<>p_user_id then
  raise exception 'Platform administrator already provisioned; use a separate audited recovery procedure' using errcode='42501';
 end if;
 insert into saas.platform_administrators(user_id,role_key,active)
 values(p_user_id,'super_admin',true)
 on conflict(user_id) do update set active=true,updated_at=now();
 if not exists(select 1 from saas.platform_admin_audit where action='bootstrap' and subject_user_id=p_user_id) then
  insert into saas.platform_admin_audit(actor_user_id,subject_user_id,action)
  values(p_user_id,p_user_id,'bootstrap');
 end if;
 return true;
end $fn$;
revoke all on function public.saas_bootstrap_platform_admin_v1(uuid) from public,anon,authenticated;
grant execute on function public.saas_bootstrap_platform_admin_v1(uuid) to service_role;
commit;