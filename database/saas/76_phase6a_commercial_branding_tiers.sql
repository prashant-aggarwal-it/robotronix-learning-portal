-- Phase 6A: commercial branding tier. Reuses private organization_settings + audit_events.
-- Missing setting means 'standard' for both existing and future organizations.
-- Saved Phase 5 logo, palette and tagline remain untouched.
begin;

-- Prevent invalid tier values even if a privileged caller writes organization_settings directly.
create or replace function saas.validate_branding_tier_setting_v1()
returns trigger language plpgsql set search_path=pg_catalog as $fn$
begin
 if new.setting_key='branding_tier' and
    (jsonb_typeof(new.setting_value) is distinct from 'string' or
     new.setting_value #>> '{}' not in ('standard','custom','white_label')) then
  raise exception 'Invalid branding tier' using errcode='22023';
 end if;
 return new;
end $fn$;
revoke all on function saas.validate_branding_tier_setting_v1() from public,anon,authenticated;
drop trigger if exists validate_branding_tier_setting_v1 on saas.organization_settings;
create trigger validate_branding_tier_setting_v1
before insert or update on saas.organization_settings for each row
execute function saas.validate_branding_tier_setting_v1();

create or replace function public.saas_branding_tier_read_v1(p_actor uuid,p_org uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $fn$
declare v_level text;v_status text;v_admin boolean;
begin
 if (auth.jwt()->>'role') is distinct from 'service_role' or p_actor is null or p_org is null then
  raise exception 'Service authorization required' using errcode='42501';
 end if;
 select status into v_status from saas.organizations where id=p_org;
 if v_status is null then raise exception 'Organization not accessible' using errcode='42501'; end if;
 select exists(select 1 from saas.platform_administrators where user_id=p_actor and active) into v_admin;
 if not v_admin and (v_status<>'active' or not exists(
  select 1 from saas.memberships m where m.organization_id=p_org
   and m.user_id=p_actor and m.status='active')) then
  raise exception 'Organization not accessible' using errcode='42501';
 end if;
 select s.setting_value #>> '{}' into v_level from saas.organization_settings s
 where s.organization_id=p_org and s.setting_key='branding_tier';
 if v_level is null then v_level:='standard'; end if;
 if v_level not in ('standard','custom','white_label') then
  raise exception 'Branding tier configuration invalid' using errcode='22023';
 end if;
 return jsonb_build_object('organizationId',p_org,'level',v_level,'isDefault',not exists(
  select 1 from saas.organization_settings where organization_id=p_org and setting_key='branding_tier'
 ));
end $fn$;
revoke all on function public.saas_branding_tier_read_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.saas_branding_tier_read_v1(uuid,uuid) to service_role;

create or replace function public.saas_branding_tier_set_v1(p_actor uuid,p_org uuid,p_level text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $fn$
declare v_previous text;v_status text;v_changed boolean;
begin
 if (auth.jwt()->>'role') is distinct from 'service_role' or p_actor is null or
    not exists(select 1 from saas.platform_administrators where user_id=p_actor and active) then
  raise exception 'Platform Super Admin required' using errcode='42501';
 end if;
 if p_level is null or p_level not in ('standard','custom','white_label') then
  raise exception 'Unsupported branding tier' using errcode='22023';
 end if;
 -- Serialize updates to this organization and preserve a reliable old/new audit.
 select status into v_status from saas.organizations where id=p_org for update;
 if v_status is null or v_status='archived' then
  raise exception 'Organization unavailable' using errcode='22023';
 end if;
 select s.setting_value #>> '{}' into v_previous from saas.organization_settings s
 where s.organization_id=p_org and s.setting_key='branding_tier';
 v_previous:=coalesce(v_previous,'standard');
 if v_previous not in ('standard','custom','white_label') then
  raise exception 'Existing branding tier invalid' using errcode='22023';
 end if;
 v_changed:=v_previous<>p_level;
 if v_changed then
  insert into saas.organization_settings(organization_id,setting_key,setting_value)
  values(p_org,'branding_tier',to_jsonb(p_level))
  on conflict(organization_id,setting_key)
  do update set setting_value=excluded.setting_value;
  insert into saas.audit_events(organization_id,actor_user_id,event_type,object_type,object_id,details)
  values(p_org,p_actor,'branding_tier_changed','organization',p_org,
   jsonb_build_object('previous',v_previous,'next',p_level,'source','platform_admin'));
  insert into saas.platform_admin_audit(actor_user_id,action)
  values(p_actor,'branding_tier_changed:'||p_org::text||':'||v_previous||'>'||p_level);
 end if;
 return jsonb_build_object('ok',true,'organizationId',p_org,'level',p_level,
  'previous',v_previous,'changed',v_changed);
end $fn$;
revoke all on function public.saas_branding_tier_set_v1(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.saas_branding_tier_set_v1(uuid,uuid,text) to service_role;

commit;
