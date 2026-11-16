-- Phase 4D: safe first-tenant branding without bypassing normal onboarding.
begin;
create or replace function public.saas_platform_configure_first_tenant_v1(
 p_actor_id uuid,p_organization_id uuid,p_tagline text,p_logo_url text,p_accent_color text
) returns jsonb language plpgsql security definer set search_path=pg_catalog
as $fn$
declare v_org saas.organizations%rowtype;v_logo text:=btrim(coalesce(p_logo_url,''));v_tagline text:=btrim(coalesce(p_tagline,''));v_accent text:=btrim(coalesce(p_accent_color,''));
begin
 if auth.role()<>'service_role' or not exists(select 1 from saas.platform_administrators where user_id=p_actor_id and active)
 then raise exception 'Platform administrator required' using errcode='42501';end if;
 select * into v_org from saas.organizations where id=p_organization_id for update;
 if not found or v_org.status<>'active' then raise exception 'Active organization required' using errcode='22023';end if;
 if not exists(select 1 from saas.memberships where organization_id=v_org.id and role_key='owner' and status='active')
 or not exists(select 1 from saas.module_entitlements where organization_id=v_org.id and module_key='academy' and enabled)
 then raise exception 'Provision owner and Academy entitlement first' using errcode='23514';end if;
 if length(v_tagline)>180 or length(v_logo)>600 or
  (v_logo<>'' and v_logo !~ '^https://[a-zA-Z0-9.-]+(/[a-zA-Z0-9_./%~-]*)?$')
  or v_accent !~ '^#[0-9a-fA-F]{6}$'
 then raise exception 'Invalid branding values' using errcode='22023';end if;
 insert into saas.organization_settings(organization_id,setting_key,setting_value)
 values(v_org.id,'tagline',to_jsonb(v_tagline)),(v_org.id,'logo_url',to_jsonb(v_logo)),(v_org.id,'accent_color',to_jsonb(v_accent))
 on conflict(organization_id,setting_key) do update set setting_value=excluded.setting_value;
 insert into saas.platform_admin_audit(actor_user_id,action)
 values(p_actor_id,'organization_brand_configured:'||v_org.id::text);
 return jsonb_build_object('ok',true,'organizationId',v_org.id,'slug',v_org.slug);
end $fn$;
revoke all on function public.saas_platform_configure_first_tenant_v1(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.saas_platform_configure_first_tenant_v1(uuid,uuid,text,text,text) to service_role;
-- Workspace selection and public branding must reflect the live subscription gate.
create or replace function public.saas_my_workspaces()
returns jsonb language sql stable security definer set search_path=pg_catalog as $fn$
 select coalesce(jsonb_agg(jsonb_build_object(
 'id',o.id,'slug',o.slug,'name',o.display_name,'role',m.role_key,
 'modules',coalesce((select jsonb_agg(e.module_key order by e.module_key)
 from saas.module_entitlements e where e.organization_id=o.id and e.enabled
 and public.saas_subscription_access_v1(o.id)),'[]'::jsonb),
 'crmAccess',public.saas_subscription_access_v1(o.id) and exists(select 1 from saas.legacy_tenant_links l join connect.memberships cm
 on cm.tenant_id=l.crm_tenant_id where l.organization_id=o.id
 and cm.user_id=auth.uid() and cm.status='active'),
 'tasksAccess',public.saas_subscription_access_v1(o.id) and exists(select 1 from saas.workspace_links l join tasks.workspace_members tm
 on tm.workspace_id=l.workspace_id where l.organization_id=o.id and tm.user_id=auth.uid())
 ) order by o.display_name),'[]'::jsonb)
 from saas.memberships m join saas.organizations o on o.id=m.organization_id
 where m.user_id=auth.uid() and m.status='active' and o.status='active';
$fn$;
revoke all on function public.saas_my_workspaces() from public,anon;
grant execute on function public.saas_my_workspaces() to authenticated;
create or replace function public.saas_public_academy_brand(p_slug text)
returns jsonb language sql stable security definer set search_path=pg_catalog as $fn$
 select jsonb_build_object('slug',o.slug,'name',o.display_name,
  'tagline',coalesce((select s.setting_value #>> '{}' from saas.organization_settings s where s.organization_id=o.id and s.setting_key='tagline'),''),
  'logoUrl',coalesce((select s.setting_value #>> '{}' from saas.organization_settings s where s.organization_id=o.id and s.setting_key='logo_url'),''),
  'accentColor',coalesce((select s.setting_value #>> '{}' from saas.organization_settings s where s.organization_id=o.id and s.setting_key='accent_color'),'#4537a5'))
 from saas.organizations o
 where o.slug=p_slug and o.status='active' and public.saas_subscription_access_v1(o.id)
 and exists(select 1 from saas.module_entitlements e where e.organization_id=o.id and e.module_key='academy' and e.enabled)
 limit 1;
$fn$;
revoke all on function public.saas_public_academy_brand(text) from public;
grant execute on function public.saas_public_academy_brand(text) to anon,authenticated;
commit;