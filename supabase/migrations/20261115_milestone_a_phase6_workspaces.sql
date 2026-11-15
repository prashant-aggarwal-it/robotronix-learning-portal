-- Read only the signed-in user's verified SaaS organizations and enabled modules.
create or replace function public.saas_my_workspaces()
returns jsonb language sql stable security definer set search_path=pg_catalog as $$
 select coalesce(jsonb_agg(jsonb_build_object(
 'id',o.id,'slug',o.slug,'name',o.display_name,'role',m.role_key,
 'modules',coalesce((select jsonb_agg(e.module_key order by e.module_key)
 from saas.module_entitlements e where e.organization_id=o.id and e.enabled),'[]'::jsonb),
 'crmAccess',exists(select 1 from saas.legacy_tenant_links l join connect.memberships cm
 on cm.tenant_id=l.crm_tenant_id where l.organization_id=o.id
 and cm.user_id=auth.uid() and cm.status='active'),
 'tasksAccess',exists(select 1 from saas.workspace_links l join tasks.workspace_members tm
 on tm.workspace_id=l.workspace_id where l.organization_id=o.id and tm.user_id=auth.uid())
 ) order by o.display_name),'[]'::jsonb)
 from saas.memberships m join saas.organizations o on o.id=m.organization_id
 where m.user_id=auth.uid() and m.status='active' and o.status='active';
$$;
revoke all on function public.saas_my_workspaces() from public,anon;
grant execute on function public.saas_my_workspaces() to authenticated;