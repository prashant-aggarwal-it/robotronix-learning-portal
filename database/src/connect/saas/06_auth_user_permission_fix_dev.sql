-- Compatibility fix: service_role must not SELECT auth.users for workspace RPC.
-- Route handlers verify Auth identity (user id and email) with auth.getUser(token).
begin;
create or replace function public.connect_create_workspace(
 p_actor_id uuid,p_slug text,p_name text
) returns uuid language plpgsql security invoker set search_path = ''
as $fn$
declare v_tenant uuid;
begin
 if p_actor_id is null then raise exception 'Authenticated user required' using errcode='28000';end if;
 if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or p_name is null or length(btrim(p_name)) not between 2 and 120 then
  raise exception 'Invalid workspace details' using errcode='22023';
 end if;
 insert into connect.tenants(slug,name) values(p_slug,btrim(p_name)) returning id into v_tenant;
 insert into connect.memberships(tenant_id,user_id,role,status)
 values(v_tenant,p_actor_id,'owner','active');
 return v_tenant;
end $fn$;

create function public.connect_accept_invitation(
 p_actor_id uuid,p_actor_email text,p_token_sha256 text
) returns uuid language plpgsql security invoker set search_path = ''
as $fn$
declare v_inv connect.invitations%rowtype;v_email text;v_member uuid;
begin
 v_email:=lower(btrim(p_actor_email));
 if p_actor_id is null or v_email is null or v_email='' then
  raise exception 'Sign in to accept invitation' using errcode='28000';
 end if;
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

revoke all on function public.connect_accept_invitation(uuid,text,text) from public,anon,authenticated;
grant execute on function public.connect_accept_invitation(uuid,text,text) to service_role;
drop function public.connect_accept_invitation(uuid,text) restrict;
commit;
