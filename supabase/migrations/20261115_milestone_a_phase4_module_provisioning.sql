-- Milestone A Phase 4 — owner-only, one-time, atomic product provisioning.
-- SaaS organization stays canonical; CRM and Tasks are linked module workspaces.
create or replace function public.saas_provision_owned_modules(p_modules text[])
returns jsonb language plpgsql security definer set search_path=pg_catalog
as $$
declare
 v_actor uuid := auth.uid();
 v_org saas.organizations%rowtype;
 v_modules text[];
 v_module text;
 v_crm uuid;
 v_tasks uuid;
begin
 if v_actor is null or auth.role() <> 'authenticated' then
   raise exception 'Authentication required' using errcode='42501';
 end if;
 select array_agg(distinct x order by x) into v_modules from unnest(p_modules) x;
 if v_modules is null or cardinality(v_modules)=0
    or exists(select 1 from unnest(v_modules) x where x not in ('academy','crm','tasks')) then
   raise exception 'Choose one or more supported products' using errcode='22023';
 end if;
 select o.* into v_org from saas.organizations o
 join saas.memberships m on m.organization_id=o.id
 where m.user_id=v_actor and m.role_key='owner' and m.status='active'
 and o.status='active'
 order by m.created_at limit 1 for update of o;
 if v_org.id is null then raise exception 'Active organization owner required' using errcode='42501'; end if;
 if exists(select 1 from saas.module_entitlements e where e.organization_id=v_org.id) then
   raise exception 'Products already configured. Contact your organization administrator to change them.' using errcode='23514';
 end if;
 foreach v_module in array v_modules loop
  insert into saas.module_entitlements(organization_id,module_key,enabled)
  values(v_org.id,v_module,true);
 end loop;
 if 'crm'=any(v_modules) then
   insert into connect.tenants(name,slug,status)
   values(v_org.display_name,v_org.slug,'active') returning id into v_crm;
   insert into connect.memberships(tenant_id,user_id,role,status)
   values(v_crm,v_actor,'owner','active');
   insert into saas.legacy_tenant_links(organization_id,crm_tenant_id)
   values(v_org.id,v_crm);
 end if;
 if 'tasks'=any(v_modules) then
   insert into tasks.accounts(user_id,display_name,status)
   values(v_actor,left(v_org.display_name,100),'active')
   on conflict(user_id) do nothing;
   insert into tasks.workspaces(name,owner_user_id)
   values(left(v_org.display_name,100),v_actor) returning id into v_tasks;
   insert into tasks.workspace_members(workspace_id,user_id,role)
   values(v_tasks,v_actor,'owner');
   insert into saas.workspace_links(workspace_id,organization_id)
   values(v_tasks,v_org.id);
 end if;
 return jsonb_build_object('organizationId',v_org.id,'modules',v_modules,'crmTenantId',v_crm,'tasksWorkspaceId',v_tasks);
end;
$$;
revoke all on function public.saas_provision_owned_modules(text[]) from public,anon;
grant execute on function public.saas_provision_owned_modules(text[]) to authenticated;
create or replace function public.saas_my_module_setup()
returns jsonb language sql stable security definer set search_path=pg_catalog
as $$
select jsonb_build_object(
 'organizationId',o.id,'slug',o.slug,'name',o.display_name,
 'configured',exists(select 1 from saas.module_entitlements e where e.organization_id=o.id),
 'modules',coalesce((select jsonb_agg(e.module_key order by e.module_key)
                     from saas.module_entitlements e where e.organization_id=o.id and e.enabled), '[]'::jsonb))
from saas.organizations o
join saas.memberships m on m.organization_id=o.id
where m.user_id=auth.uid() and m.role_key='owner' and m.status='active' and o.status='active'
order by m.created_at limit 1
$$;
revoke all on function public.saas_my_module_setup() from public,anon;
grant execute on function public.saas_my_module_setup() to authenticated;
