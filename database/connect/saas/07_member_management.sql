-- Connect 2A staff administration. Owner-only role transfer and safe staff disabling.
begin;
create or replace function public.connect_update_member(
 p_actor_id uuid,p_tenant_id uuid,p_member_id uuid,p_role text,p_status text
) returns boolean language plpgsql security invoker set search_path=''
as $fn$
declare actor_role text; target_role text; target_user uuid;
begin
 -- Serialize membership changes within this tenant to protect the final owner.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_tenant_id::text,0));
 select m.role into actor_role from connect.memberships m
 join connect.tenants t on t.id=m.tenant_id
 where m.tenant_id=p_tenant_id and m.user_id=p_actor_id
 and m.status='active' and t.status in ('active','trial');
 if actor_role is null or actor_role not in ('owner','admin') then
  raise exception 'Workspace administrator required' using errcode='42501';
 end if;
 select m.role,m.user_id into target_role,target_user from connect.memberships m
 where m.id=p_member_id and m.tenant_id=p_tenant_id for update;
 if not found then raise exception 'Member not found' using errcode='42501';end if;
 if p_role not in ('owner','admin','manager','counsellor','viewer')
    or p_status not in ('active','disabled') then
  raise exception 'Invalid membership change' using errcode='22023';end if;
 if actor_role='admin' and (
  target_role in ('owner','admin') or p_role in ('owner','admin')
 ) then
  raise exception 'Only owner can manage privileged roles' using errcode='42501';
 end if;
 -- Never remove or downgrade the final active owner.
 if target_role='owner' and (p_role<>'owner' or p_status<>'active')
    and (select count(*) from connect.memberships
         where tenant_id=p_tenant_id and role='owner' and status='active')<=1 then
  raise exception 'A workspace must retain an active owner' using errcode='42501';
 end if;
 update connect.memberships set role=p_role,status=p_status
 where id=p_member_id and tenant_id=p_tenant_id;
 return true;
end $fn$;
revoke all on function public.connect_update_member(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.connect_update_member(uuid,uuid,uuid,text,text) to service_role;
commit;
