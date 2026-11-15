-- Public branding lookup contains no private membership or tenant data.
create or replace function public.saas_public_academy_brand(p_slug text)
returns jsonb language sql stable security definer set search_path=pg_catalog as $$
 select jsonb_build_object('slug',o.slug,'name',o.display_name,
  'tagline',coalesce((select s.setting_value #>> '{}' from saas.organization_settings s where s.organization_id=o.id and s.setting_key='tagline'),''),
  'logoUrl',coalesce((select s.setting_value #>> '{}' from saas.organization_settings s where s.organization_id=o.id and s.setting_key='logo_url'),''),
  'accentColor',coalesce((select s.setting_value #>> '{}' from saas.organization_settings s where s.organization_id=o.id and s.setting_key='accent_color'),'#4537a5'))
 from saas.organizations o
 where o.slug=p_slug and o.status='active'
 and exists(select 1 from saas.module_entitlements e where e.organization_id=o.id and e.module_key='academy' and e.enabled)
 limit 1;
$$;
revoke all on function public.saas_public_academy_brand(text) from public;
grant execute on function public.saas_public_academy_brand(text) to anon,authenticated;
create or replace function public.saas_save_academy_brand(p_tagline text,p_logo_url text,p_accent_color text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_org uuid; v_tagline text:=btrim(coalesce(p_tagline,''));v_logo text:=btrim(coalesce(p_logo_url,''));v_accent text:=btrim(coalesce(p_accent_color,''));
begin
 if auth.uid() is null or auth.role()<>'authenticated' then raise exception 'Authentication required' using errcode='42501'; end if;
 select o.id into v_org from saas.organizations o join saas.memberships m on m.organization_id=o.id
 where m.user_id=auth.uid() and m.role_key='owner' and m.status='active' and o.status='active'
 and exists(select 1 from saas.module_entitlements e where e.organization_id=o.id and e.module_key='academy' and e.enabled)
 order by m.created_at limit 1;
 if v_org is null then raise exception 'Academy owner access required' using errcode='42501';end if;
 if length(v_tagline)>180 or length(v_logo)>600 or (v_logo<>'' and v_logo !~ '^https://[a-zA-Z0-9.-]+(/[a-zA-Z0-9_./%~-]*)?$') or v_accent !~ '^#[0-9a-fA-F]{6}$' then
   raise exception 'Invalid branding values' using errcode='22023';
 end if;
 insert into saas.organization_settings(organization_id,setting_key,setting_value)
 values (v_org,'tagline',to_jsonb(v_tagline)),(v_org,'logo_url',to_jsonb(v_logo)),(v_org,'accent_color',to_jsonb(v_accent))
 on conflict(organization_id,setting_key) do update set setting_value=excluded.setting_value;
 return jsonb_build_object('saved',true);
end;
$$;
revoke all on function public.saas_save_academy_brand(text,text,text) from public,anon;
grant execute on function public.saas_save_academy_brand(text,text,text) to authenticated;