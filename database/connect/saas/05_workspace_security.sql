-- Connect Phase 2A — Workspace and membership security.
-- Backend-only RPC contract; do not expose connect schema in Supabase Data API.
-- Default function EXECUTE grants are revoked; only server-side service_role can invoke.
begin;
create table connect.invitations (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references connect.tenants(id) on delete restrict,
 email text not null check(email = lower(btrim(email)) and position('@' in email)>1),
 role text not null check(role in ('admin','manager','counsellor','viewer')),
 token_sha256 text not null unique check(length(token_sha256)=64),
 invited_by uuid not null references auth.users(id) on delete restrict,
 expires_at timestamptz not null,
 accepted_at timestamptz,
 revoked_at timestamptz,
 created_at timestamptz not null default now(),
 unique(tenant_id,id),
 check(expires_at>created_at)
);
create unique index connect_pending_invite_idx
on connect.invitations(tenant_id,email)
where accepted_at is null and revoked_at is null;
alter table connect.invitations enable row level security;
revoke all on connect.invitations from public,anon,authenticated;
grant select,insert,update,delete on connect.invitations to service_role;

create or replace function public.connect_create_workspace(
 p_actor_id uuid, p_slug text, p_name text
) returns uuid language plpgsql security invoker set search_path = ''
as $fn$
declare v_tenant uuid;
begin
 if p_actor_id is null or not exists(select 1 from auth.users where id=p_actor_id) then
  raise exception 'Authenticated user required' using errcode='28000';
 end if;
 if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or
    p_name is null or length(btrim(p_name)) not between 2 and 120 then
  raise exception 'Invalid workspace details' using errcode='22023';
 end if;
 insert into connect.tenants(slug,name) values(p_slug,btrim(p_name)) returning id into v_tenant;
 insert into connect.memberships(tenant_id,user_id,role,status)
 values(v_tenant,p_actor_id,'owner','active');
 return v_tenant;
end $fn$;

create or replace function public.connect_my_workspaces(p_actor_id uuid)
returns table(tenant_id uuid, slug text, workspace_name text, tenant_status text, membership_role text)
language sql stable security invoker set search_path = ''
as $fn$
 select t.id,t.slug,t.name,t.status,m.role
 from connect.memberships m
 join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.status='active' and t.status in ('active','trial')
 order by t.name
$fn$;

create or replace function public.connect_workspace_members(
 p_actor_id uuid, p_tenant_id uuid
) returns table(member_id uuid,member_user_id uuid,member_role text,member_status text,member_created_at timestamptz)
language plpgsql stable security invoker set search_path = ''
as $fn$
begin
 if not exists (
   select 1 from connect.memberships m join connect.tenants t on t.id=m.tenant_id
   where m.tenant_id=p_tenant_id and m.user_id=p_actor_id and m.status='active'
     and m.role in ('owner','admin','manager') and t.status in ('active','trial')
 ) then raise exception 'Workspace access denied' using errcode='42501'; end if;
 return query
 select m.id,m.user_id,m.role,m.status,m.created_at
 from connect.memberships m where m.tenant_id=p_tenant_id order by m.created_at;
end $fn$;

create or replace function public.connect_create_invitation(
 p_actor_id uuid,p_tenant_id uuid,p_email text,p_role text,p_token_sha256 text
) returns uuid language plpgsql security invoker set search_path = ''
as $fn$
declare v_id uuid;
begin
 if not exists (
  select 1 from connect.memberships m join connect.tenants t on t.id=m.tenant_id
  where m.tenant_id=p_tenant_id and m.user_id=p_actor_id and m.status='active'
  and m.role in ('owner','admin') and t.status in ('active','trial')
 ) then raise exception 'Workspace administration required' using errcode='42501'; end if;
 if p_role not in ('admin','manager','counsellor','viewer')
   or p_email is null or length(p_email)>254 or position('@' in p_email)<2
   or p_token_sha256 is null or p_token_sha256 !~ '^[a-f0-9]{64}$'
 then raise exception 'Invalid invitation' using errcode='22023'; end if;
 -- Existing stale invitations can be explicitly revoked, never silently overwritten.
 insert into connect.invitations(tenant_id,email,role,token_sha256,invited_by,expires_at)
 values(p_tenant_id,lower(btrim(p_email)),p_role,p_token_sha256,p_actor_id,now()+interval '7 days')
 returning id into v_id;
 return v_id;
end $fn$;

create or replace function public.connect_accept_invitation(
 p_actor_id uuid,p_token_sha256 text
) returns uuid language plpgsql security invoker set search_path = ''
as $fn$
declare v_inv connect.invitations%rowtype;v_email text;v_member uuid;
begin
 select lower(email) into v_email from auth.users where id=p_actor_id;
 if v_email is null then raise exception 'Sign in to accept invitation' using errcode='28000';end if;
 select * into v_inv from connect.invitations where token_sha256=p_token_sha256 for update;
 if not found or v_inv.accepted_at is not null or v_inv.revoked_at is not null or v_inv.expires_at<=now()
   or v_inv.email<>v_email then raise exception 'Invitation invalid or expired' using errcode='42501';end if;
 if not exists(select 1 from connect.tenants where id=v_inv.tenant_id and status in ('active','trial'))
 then raise exception 'Workspace unavailable' using errcode='42501';end if;
 insert into connect.memberships(tenant_id,user_id,role,status)
 values(v_inv.tenant_id,p_actor_id,v_inv.role,'active')
 on conflict(tenant_id,user_id) do update
 set role=excluded.role,status='active'
 where connect.memberships.role<>'owner'
 returning id into v_member;
 if v_member is null then raise exception 'Owner membership cannot be replaced' using errcode='42501';end if;
 update connect.invitations set accepted_at=now() where id=v_inv.id;
 return v_inv.tenant_id;
end $fn$;

create or replace function public.connect_revoke_invitation(
 p_actor_id uuid,p_tenant_id uuid,p_invitation_id uuid
) returns boolean language plpgsql security invoker set search_path = ''
as $fn$
begin
 if not exists(
  select 1 from connect.memberships m where m.tenant_id=p_tenant_id
   and m.user_id=p_actor_id and m.status='active' and m.role in ('owner','admin')
 ) then raise exception 'Workspace administration required' using errcode='42501';end if;
 update connect.invitations set revoked_at=now()
 where tenant_id=p_tenant_id and id=p_invitation_id
 and accepted_at is null and revoked_at is null;
 return found;
end $fn$;

-- No role spoofing through direct RPC calls. Route handlers validate token with Auth;
-- only service_role can call these functions. Public functions are never anonymously executable.
revoke all on function public.connect_create_workspace(uuid,text,text) from public,anon,authenticated;
revoke all on function public.connect_my_workspaces(uuid) from public,anon,authenticated;
revoke all on function public.connect_workspace_members(uuid,uuid) from public,anon,authenticated;
revoke all on function public.connect_create_invitation(uuid,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.connect_accept_invitation(uuid,text) from public,anon,authenticated;
revoke all on function public.connect_revoke_invitation(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.connect_create_workspace(uuid,text,text) to service_role;
grant execute on function public.connect_my_workspaces(uuid) to service_role;
grant execute on function public.connect_workspace_members(uuid,uuid) to service_role;
grant execute on function public.connect_create_invitation(uuid,uuid,text,text,text) to service_role;
grant execute on function public.connect_accept_invitation(uuid,text) to service_role;
grant execute on function public.connect_revoke_invitation(uuid,uuid,uuid) to service_role;
commit;
