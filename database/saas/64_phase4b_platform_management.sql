-- Phase 4B: protected platform operations and verified owner handoff.
begin;
create table if not exists saas.platform_owner_invitations (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references saas.organizations(id),
 email text not null,
 token_sha256 text not null unique check(token_sha256 ~ '^[a-f0-9]{64}$'),
 invited_by uuid not null references auth.users(id),
 status text not null default 'pending' check(status in ('pending','accepted','revoked')),
 expires_at timestamptz not null default (now()+interval '7 days'),
 accepted_by uuid references auth.users(id),
 accepted_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists platform_owner_invitations_org_idx on saas.platform_owner_invitations(organization_id,created_at desc);
alter table saas.platform_owner_invitations enable row level security;
revoke all on saas.platform_owner_invitations from public,anon,authenticated;
grant select,insert,update on saas.platform_owner_invitations to service_role;
create or replace function public.saas_platform_manage_v1(
 p_actor_id uuid,p_action text,p_organization_id uuid default null,
 p_target_user_id uuid default null,p_value text default null
) returns jsonb language plpgsql security definer set search_path=pg_catalog
as $fn$
declare v_org saas.organizations%rowtype;v_active integer;
begin
 if auth.role()<>'service_role' or not exists(select 1 from saas.platform_administrators where user_id=p_actor_id and active) then
  raise exception 'Platform administrator required' using errcode='42501';
 end if;
 if p_action='set_organization_status' then
  if p_value not in ('active','suspended') then raise exception 'Invalid status' using errcode='22023';end if;
  update saas.organizations set status=p_value,updated_at=now() where id=p_organization_id returning * into v_org;
  if not found then raise exception 'Organization not found' using errcode='22023';end if;
 elsif p_action='rename_organization' then
  if length(btrim(coalesce(p_value,''))) not between 2 and 160 then raise exception 'Invalid name' using errcode='22023';end if;
  update saas.organizations set display_name=btrim(p_value),updated_at=now() where id=p_organization_id returning * into v_org;
  if not found then raise exception 'Organization not found' using errcode='22023';end if;
 elsif p_action in ('grant_platform_admin','revoke_platform_admin') then
  if p_target_user_id is null then raise exception 'Target required' using errcode='22023';end if;
  perform pg_advisory_xact_lock(834271,119);
  if p_action='grant_platform_admin' then
   if not exists(select 1 from auth.users where id=p_target_user_id and email_confirmed_at is not null and is_anonymous is not true) then
    raise exception 'Verified existing user required' using errcode='22023';
   end if;
   insert into saas.platform_administrators(user_id,role_key,active)
   values(p_target_user_id,'super_admin',true)
   on conflict(user_id) do update set active=true,updated_at=now();
  else
   select count(*) into v_active from saas.platform_administrators where active;
   if v_active<=1 and exists(select 1 from saas.platform_administrators where user_id=p_target_user_id and active) then
    raise exception 'Cannot revoke final active administrator' using errcode='23514';
   end if;
   update saas.platform_administrators set active=false,updated_at=now() where user_id=p_target_user_id;
   if not found then raise exception 'Administrator not found' using errcode='22023';end if;
  end if;
 else
  raise exception 'Unsupported platform action' using errcode='22023';
 end if;
 insert into saas.platform_admin_audit(actor_user_id,subject_user_id,action)
 values(p_actor_id,p_target_user_id,left(p_action||':'||coalesce(p_organization_id::text,'')||':'||coalesce(p_value,''),240));
 return jsonb_build_object('ok',true,'action',p_action,'organizationId',p_organization_id);
end $fn$;
revoke all on function public.saas_platform_manage_v1(uuid,text,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.saas_platform_manage_v1(uuid,text,uuid,uuid,text) to service_role;

create or replace function public.saas_platform_owner_invite_v1(
 p_actor_id uuid,p_organization_id uuid,p_email text,p_hash text,p_replace_id uuid default null
) returns jsonb language plpgsql security definer set search_path=pg_catalog
as $fn$
declare v_email text:=lower(btrim(coalesce(p_email,'')));v_id uuid;
begin
 if auth.role()<>'service_role' or not exists(select 1 from saas.platform_administrators where user_id=p_actor_id and active) then
  raise exception 'Platform administrator required' using errcode='42501';
 end if;
 if not exists(select 1 from saas.organizations where id=p_organization_id and status<>'archived')
 or length(v_email)>254 or v_email !~ '^[^ @]+@[^ @]+[.][^ @]+$'
 or p_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid invitation' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtext(p_organization_id::text),hashtext(v_email));
 if p_replace_id is not null then
  update saas.platform_owner_invitations set status='revoked'
  where id=p_replace_id and organization_id=p_organization_id and email=v_email and status='pending';
  if not found then raise exception 'Invitation unavailable for resend' using errcode='22023';end if;
 end if;
 update saas.platform_owner_invitations set status='revoked'
 where organization_id=p_organization_id and email=v_email and status='pending';
 insert into saas.platform_owner_invitations(organization_id,email,token_sha256,invited_by)
 values(p_organization_id,v_email,p_hash,p_actor_id) returning id into v_id;
 insert into saas.platform_admin_audit(actor_user_id,action)
 values(p_actor_id,'owner_invitation_created:'||v_id::text);
 return jsonb_build_object('id',v_id,'expiresAt',now()+interval '7 days');
end $fn$;
revoke all on function public.saas_platform_owner_invite_v1(uuid,uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.saas_platform_owner_invite_v1(uuid,uuid,text,text,uuid) to service_role;

create or replace function public.saas_platform_owner_invitation_action_v1(
 p_actor_id uuid,p_invitation_id uuid,p_action text
) returns boolean language plpgsql security definer set search_path=pg_catalog
as $fn$
begin
 if auth.role()<>'service_role' or not exists(select 1 from saas.platform_administrators where user_id=p_actor_id and active) then
  raise exception 'Platform administrator required' using errcode='42501';
 end if;
 if p_action<>'revoke' then raise exception 'Unsupported invitation action' using errcode='22023';end if;
 update saas.platform_owner_invitations set status='revoked'
 where id=p_invitation_id and status='pending';
 if not found then raise exception 'Invitation not pending' using errcode='22023';end if;
 insert into saas.platform_admin_audit(actor_user_id,action) values(p_actor_id,'owner_invitation_revoked:'||p_invitation_id::text);
 return true;
end $fn$;
revoke all on function public.saas_platform_owner_invitation_action_v1(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.saas_platform_owner_invitation_action_v1(uuid,uuid,text) to service_role;

create or replace function public.saas_accept_platform_owner_invite_v1(
 p_actor_id uuid,p_token_hash text
) returns jsonb language plpgsql security definer set search_path=pg_catalog
as $fn$
declare v_inv saas.platform_owner_invitations%rowtype;v_email text;v_org saas.organizations%rowtype;
begin
 if auth.role()<>'service_role' then raise exception 'Service authorization required' using errcode='42501';end if;
 select lower(email) into v_email from auth.users where id=p_actor_id and email_confirmed_at is not null and is_anonymous is not true;
 if v_email is null then raise exception 'Verified account required' using errcode='42501';end if;
 select * into v_inv from saas.platform_owner_invitations where token_sha256=p_token_hash for update;
 if not found or v_inv.status<>'pending' or v_inv.expires_at<=now() or v_inv.email<>v_email then
  raise exception 'Invitation invalid, expired or for another email' using errcode='42501';
 end if;
 select * into v_org from saas.organizations where id=v_inv.organization_id and status='active';
 if not found then raise exception 'Organization unavailable' using errcode='42501';end if;
 insert into saas.memberships(organization_id,user_id,role_key,status)
 values(v_inv.organization_id,p_actor_id,'owner','active')
 on conflict(organization_id,user_id) do update set role_key='owner',status='active';
 update saas.platform_owner_invitations set status='accepted',accepted_by=p_actor_id,accepted_at=now() where id=v_inv.id;
 insert into saas.platform_admin_audit(actor_user_id,subject_user_id,action)
 values(v_inv.invited_by,p_actor_id,'owner_invitation_accepted:'||v_inv.id::text);
 return jsonb_build_object('organizationId',v_org.id,'slug',v_org.slug);
end $fn$;
revoke all on function public.saas_accept_platform_owner_invite_v1(uuid,text) from public,anon,authenticated;
grant execute on function public.saas_accept_platform_owner_invite_v1(uuid,text) to service_role;

create or replace function public.saas_platform_owner_invites_v1(p_actor_id uuid,p_organization_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog
as $fn$
declare v_result jsonb;
begin
 if auth.role()<>'service_role' or not exists(select 1 from saas.platform_administrators where user_id=p_actor_id and active) then
  raise exception 'Platform administrator required' using errcode='42501';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'email',email,'status',status,'expiresAt',expires_at,'createdAt',created_at) order by created_at desc),'[]'::jsonb)
 into v_result from (select id,email,status,expires_at,created_at from saas.platform_owner_invitations where organization_id=p_organization_id order by created_at desc limit 100) x;
 return v_result;
end $fn$;
revoke all on function public.saas_platform_owner_invites_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.saas_platform_owner_invites_v1(uuid,uuid) to service_role;
commit;