create or replace function public.saas_my_owned_organization()
returns jsonb language sql stable security definer set search_path=pg_catalog
as $$
 select jsonb_build_object('organizationId',o.id,'slug',o.slug,'name',o.display_name)
 from saas.memberships m join saas.organizations o on o.id=m.organization_id
 where m.user_id=auth.uid() and m.role_key='owner' and m.status='active'
 and o.status='active'
 order by m.created_at limit 1
$$;
revoke all on function public.saas_my_owned_organization() from public,anon;
grant execute on function public.saas_my_owned_organization() to authenticated;