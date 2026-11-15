create or replace function public.saas_list_members_v1(p_actor_id uuid,p_organization_id uuid)
returns table(id uuid,user_id uuid,email text,role_key text,status text,created_at timestamptz)
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 if p_actor_id is null or p_organization_id is null or not exists(
  select 1 from saas.memberships m join saas.organizations o on o.id=m.organization_id and o.status='active'
  where m.organization_id=p_organization_id and m.user_id=p_actor_id and m.status='active'
  and m.role_key in ('owner','admin')
 ) then raise exception 'Membership management not authorized' using errcode='42501';end if;
 return query select m.id,m.user_id,u.email::text,m.role_key,m.status,m.created_at
 from saas.memberships m join auth.users u on u.id=m.user_id
 where m.organization_id=p_organization_id order by m.created_at;
end $$;
revoke all on function public.saas_list_members_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.saas_list_members_v1(uuid,uuid) to service_role;