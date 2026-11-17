-- Phase 5C: compatibly recognize service role claims from current Supabase PostgREST.
-- auth.jwt() reads the claims document rather than relying on a legacy per-claim GUC.
-- Existing EXECUTE restrictions and actor/organization checks are preserved.
create or replace function public.saas_branding_access_v1(p_actor uuid,p_org uuid)
returns boolean language sql stable security definer set search_path='pg_catalog' as $fn$
 select (auth.jwt()->>'role')='service_role'
 and exists(select 1 from saas.organizations o where o.id=p_org and o.status='active'
 and exists(select 1 from saas.module_entitlements e where e.organization_id=o.id and e.module_key='academy' and e.enabled)
 and (exists(select 1 from saas.platform_administrators pa where pa.user_id=p_actor and pa.active)
 or exists(select 1 from saas.memberships m where m.organization_id=o.id and m.user_id=p_actor and m.role_key='owner' and m.status='active')));
$fn$;
revoke all on function public.saas_branding_access_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.saas_branding_access_v1(uuid,uuid) to service_role;

create or replace function public.saas_branding_owner_organizations_v1(p_actor uuid)
returns jsonb language sql stable security definer set search_path='pg_catalog' as $fn$
 select case when (auth.jwt()->>'role')='service_role'
 then coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'slug',o.slug,'display_name',o.display_name) order by o.display_name)
 from saas.organizations o join saas.memberships m on m.organization_id=o.id
 where m.user_id=p_actor and m.role_key='owner' and m.status='active' and o.status='active'
 and exists(select 1 from saas.module_entitlements e where e.organization_id=o.id and e.module_key='academy' and e.enabled)),'[]'::jsonb)
 else '[]'::jsonb end;
$fn$;
revoke all on function public.saas_branding_owner_organizations_v1(uuid) from public,anon,authenticated;
grant execute on function public.saas_branding_owner_organizations_v1(uuid) to service_role;

create or replace function public.saas_branding_view_v1(p_actor uuid,p_org uuid)
returns jsonb language sql stable security definer set search_path='pg_catalog' as $fn$
 select case when (auth.jwt()->>'role')='service_role'
 and exists(select 1 from saas.organizations o where o.id=p_org and o.status='active')
 and (exists(select 1 from saas.platform_administrators pa where pa.user_id=p_actor and pa.active)
      or exists(select 1 from saas.memberships m where m.organization_id=p_org and m.user_id=p_actor and m.status='active'))
 then (select jsonb_build_object(
   'organization',jsonb_build_object('id',o.id,'slug',o.slug,'displayName',o.display_name),
   'branding',jsonb_build_object(
     'tagline',coalesce((select s.setting_value #>> '{}' from saas.organization_settings s where s.organization_id=o.id and s.setting_key='tagline'),''),
     'logoUrl',coalesce((select s.setting_value #>> '{}' from saas.organization_settings s where s.organization_id=o.id and s.setting_key='logo_url'),''),
     'palette',(select s.setting_value from saas.organization_settings s where s.organization_id=o.id and s.setting_key='theme_palette'),
     'accentColor',coalesce((select s.setting_value #>> '{}' from saas.organization_settings s where s.organization_id=o.id and s.setting_key='accent_color'),'#6d3cc9')
   ))
  from saas.organizations o where o.id=p_org and o.status='active')
 else null end;
$fn$;
revoke all on function public.saas_branding_view_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.saas_branding_view_v1(uuid,uuid) to service_role;

