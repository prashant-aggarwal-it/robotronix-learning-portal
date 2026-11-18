-- Phase 6F: Public Academy login must respect commercial branding tier.
-- Only public presentation fields are emitted; saved settings never change.
begin;
create or replace function public.saas_public_academy_brand(p_slug text)
returns jsonb language sql stable security definer set search_path=pg_catalog as $fn$
 select jsonb_build_object(
  'slug',o.slug,'name',o.display_name,
  'level',coalesce((select s.setting_value #>> '{}' from saas.organization_settings s
      where s.organization_id=o.id and s.setting_key='branding_tier'),'standard'),
  'tagline',case when exists(select 1 from saas.organization_settings s
    where s.organization_id=o.id and s.setting_key='branding_tier'
    and s.setting_value in ('"custom"'::jsonb,'"white_label"'::jsonb))
   then coalesce((select s.setting_value #>> '{}' from saas.organization_settings s
    where s.organization_id=o.id and s.setting_key='tagline'),'') else '' end,
  'logoUrl',case when exists(select 1 from saas.organization_settings s
    where s.organization_id=o.id and s.setting_key='branding_tier'
    and s.setting_value in ('"custom"'::jsonb,'"white_label"'::jsonb))
   then coalesce((select s.setting_value #>> '{}' from saas.organization_settings s
    where s.organization_id=o.id and s.setting_key='logo_url'),'') else '' end,
  'accentColor',case when exists(select 1 from saas.organization_settings s
    where s.organization_id=o.id and s.setting_key='branding_tier'
    and s.setting_value in ('"custom"'::jsonb,'"white_label"'::jsonb))
   then coalesce((select s.setting_value #>> '{}' from saas.organization_settings s
    where s.organization_id=o.id and s.setting_key='accent_color'),'#6d3cc9') else '#6d3cc9' end)
 from saas.organizations o where o.slug=p_slug and o.status='active'
 and public.saas_subscription_access_v1(o.id)
 and exists(select 1 from saas.module_entitlements e where e.organization_id=o.id and e.module_key='academy' and e.enabled)
 limit 1;
$fn$;
revoke all on function public.saas_public_academy_brand(text) from public;
grant execute on function public.saas_public_academy_brand(text) to anon,authenticated,service_role;
commit;