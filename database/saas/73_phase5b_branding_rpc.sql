-- Phase 5B private-schema RPC interface: checked service role + verified actor.
create or replace function public.saas_branding_access_v1(p_actor uuid,p_org uuid)
returns boolean language sql stable security definer set search_path='pg_catalog' as $fn$
 select current_setting('request.jwt.claim.role',true)='service_role'
 and exists(select 1 from saas.organizations o where o.id=p_org and o.status='active'
 and exists(select 1 from saas.module_entitlements e where e.organization_id=o.id and e.module_key='academy' and e.enabled)
 and (exists(select 1 from saas.platform_administrators pa where pa.user_id=p_actor and pa.active)
 or exists(select 1 from saas.memberships m where m.organization_id=o.id and m.user_id=p_actor and m.role_key='owner' and m.status='active')));
$fn$;
revoke all on function public.saas_branding_access_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.saas_branding_access_v1(uuid,uuid) to service_role;

create or replace function public.saas_branding_owner_organizations_v1(p_actor uuid)
returns jsonb language sql stable security definer set search_path='pg_catalog' as $fn$
 select case when current_setting('request.jwt.claim.role',true)='service_role'
 then coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'slug',o.slug,'display_name',o.display_name) order by o.display_name)
 from saas.organizations o join saas.memberships m on m.organization_id=o.id
 where m.user_id=p_actor and m.role_key='owner' and m.status='active' and o.status='active'
 and exists(select 1 from saas.module_entitlements e where e.organization_id=o.id and e.module_key='academy' and e.enabled)),'[]'::jsonb)
 else '[]'::jsonb end;
$fn$;
revoke all on function public.saas_branding_owner_organizations_v1(uuid) from public,anon,authenticated;
grant execute on function public.saas_branding_owner_organizations_v1(uuid) to service_role;

create or replace function public.saas_branding_detail_v1(p_actor uuid,p_org uuid)
returns jsonb language sql stable security definer set search_path='pg_catalog' as $fn$
 select case when public.saas_branding_access_v1(p_actor,p_org)
 then (select jsonb_build_object('organization',jsonb_build_object('id',o.id,'slug',o.slug,'display_name',o.display_name),
 'branding',jsonb_build_object(
 'tagline',coalesce((select s.setting_value #>> '{}' from saas.organization_settings s where s.organization_id=o.id and s.setting_key='tagline'),''),
 'logoUrl',coalesce((select s.setting_value #>> '{}' from saas.organization_settings s where s.organization_id=o.id and s.setting_key='logo_url'),''),
 'accentColor',coalesce((select s.setting_value #>> '{}' from saas.organization_settings s where s.organization_id=o.id and s.setting_key='accent_color'),'#4537a5'),
 'palette',(select s.setting_value from saas.organization_settings s where s.organization_id=o.id and s.setting_key='theme_palette')))
 from saas.organizations o where o.id=p_org)
 else null end;
$fn$;
revoke all on function public.saas_branding_detail_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.saas_branding_detail_v1(uuid,uuid) to service_role;

create or replace function public.saas_branding_save_v1(p_actor uuid,p_org uuid,p_tagline text,p_logo text,p_primary text,p_secondary text,p_accent text,p_hover text,p_soft text,p_foreground text)
returns jsonb language plpgsql security definer set search_path='pg_catalog' as $fn$
declare v_slug text;
begin
 if not public.saas_branding_access_v1(p_actor,p_org) then raise exception 'Academy Owner or Platform Admin access required' using errcode='42501';end if;
 if p_tagline is null or length(btrim(p_tagline))>180 or p_logo is null or length(p_logo)>600 or
 (p_logo<>'' and p_logo !~ '^https://[a-zA-Z0-9.-]+(/[a-zA-Z0-9_./%~-]*)?$') or
 p_primary !~ '^#[0-9a-fA-F]{6}$' or p_secondary !~ '^#[0-9a-fA-F]{6}$' or p_accent !~ '^#[0-9a-fA-F]{6}$' or
 p_hover !~ '^#[0-9a-fA-F]{6}$' or p_soft !~ '^#[0-9a-fA-F]{6}$' or p_foreground !~ '^#[0-9a-fA-F]{6}$'
 then raise exception 'Invalid branding values' using errcode='22023';end if;
 select slug into v_slug from saas.organizations where id=p_org;
 insert into saas.organization_settings(organization_id,setting_key,setting_value)
 values(p_org,'tagline',to_jsonb(btrim(p_tagline))),(p_org,'logo_url',to_jsonb(p_logo)),
 (p_org,'accent_color',to_jsonb(p_primary)),
 (p_org,'theme_palette',jsonb_build_object('primary',p_primary,'secondary',p_secondary,'accent',p_accent,
 'primaryHover',p_hover,'primarySoft',p_soft,'onPrimary',p_foreground))
 on conflict(organization_id,setting_key) do update set setting_value=excluded.setting_value;
 if exists(select 1 from saas.platform_administrators pa where pa.user_id=p_actor and pa.active) then
 insert into saas.platform_admin_audit(actor_user_id,action) values(p_actor,'organization_brand_configured:'||p_org::text);
 end if;
 return jsonb_build_object('ok',true,'organizationId',p_org,'slug',v_slug);
end $fn$;
revoke all on function public.saas_branding_save_v1(uuid,uuid,text,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.saas_branding_save_v1(uuid,uuid,text,text,text,text,text,text,text,text) to service_role;
