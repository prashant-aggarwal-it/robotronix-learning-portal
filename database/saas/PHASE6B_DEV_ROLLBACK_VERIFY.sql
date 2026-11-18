-- Phase 6B DEV rollback acceptance; checks tier transition, save enforcement,
-- owner/outsider isolation, saved settings and audit behavior. All changes rollback.
begin;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $qa$
declare
 a uuid;org uuid;owner_id uuid;outsider uuid;
 brand_before jsonb;brand_after jsonb;bad boolean;v_result jsonb;v_count int;
begin
 select user_id into a from saas.platform_administrators where active limit 1;
 select m.organization_id,m.user_id into org,owner_id from saas.memberships m
 join saas.organizations o on o.id=m.organization_id and o.status='active'
 where m.status='active' and not exists(select 1 from saas.platform_administrators p where p.user_id=m.user_id and p.active)
 order by m.created_at limit 1;
 if a is null or owner_id is null then raise exception 'Need DEV admin and member';end if;
 select m.user_id into outsider from saas.memberships m where m.status='active'
 and m.organization_id<>org and not exists(select 1 from saas.platform_administrators p where p.user_id=m.user_id and p.active)
 and not exists(select 1 from saas.memberships mm where mm.organization_id=org and mm.user_id=m.user_id and mm.status='active')
 limit 1;
 if outsider is null then raise exception 'Need independent DEV foreign member';end if;
 update saas.memberships set role_key='owner' where organization_id=org and user_id=owner_id;
 select coalesce(jsonb_object_agg(setting_key,setting_value),'{}'::jsonb) into brand_before
 from saas.organization_settings where organization_id=org and setting_key in ('logo_url','tagline','accent_color','theme_palette');
 -- For standard the owner must not be able to write, even via privileged RPC.
 if public.saas_branding_write_access_v2(owner_id,org) then raise exception 'Default owner incorrectly allowed';end if;
 if not public.saas_branding_write_access_v2(a,org) then raise exception 'Super Admin incorrectly denied';end if;
 -- Exercise actual service-only save RPC; checks are not merely UI/boolean gating.
 bad:=false;
 begin
  perform public.saas_branding_save_v1(owner_id,org,'Test','', '#235ce2','#e83d8c','#14b8a6','#123b99','#eef2ff','#ffffff');
 exception when insufficient_privilege then bad:=true;end;
 if not bad then raise exception 'Owner direct RPC bypassed Standard tier';end if;
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);

 if public.saas_branding_write_access_v2(outsider,org) then raise exception 'Foreign owner incorrectly allowed';end if;
 perform public.saas_branding_tier_set_v1(a,org,'custom');
 if not public.saas_branding_write_access_v2(owner_id,org) then raise exception 'Custom owner denied';end if;
 v_result:=public.saas_branding_save_v1(owner_id,org,'Temporary DEV QA','', '#235ce2','#e83d8c','#14b8a6','#123b99','#eef2ff','#ffffff');
 if v_result->>'ok'<>'true' then raise exception 'Custom owner direct RPC save rejected';end if;
 select coalesce(jsonb_object_agg(setting_key,setting_value),'{}'::jsonb) into brand_before
 from saas.organization_settings where organization_id=org and setting_key in ('logo_url','tagline','accent_color','theme_palette');

 perform public.saas_branding_tier_set_v1(a,org,'white_label');
 if not public.saas_branding_write_access_v2(owner_id,org) then raise exception 'White-label owner denied';end if;
 perform public.saas_branding_tier_set_v1(a,org,'standard');
 if public.saas_branding_write_access_v2(owner_id,org) then raise exception 'Downgraded owner incorrectly allowed';end if;
 select coalesce(jsonb_object_agg(setting_key,setting_value),'{}'::jsonb) into brand_after
 from saas.organization_settings where organization_id=org and setting_key in ('logo_url','tagline','accent_color','theme_palette');
 if brand_after<>brand_before then raise exception 'Downgrade erased saved branding';end if;
 perform public.saas_branding_tier_set_v1(a,org,'custom');
 if not public.saas_branding_write_access_v2(owner_id,org) then raise exception 'Upgrade did not restore edit access';end if;
 if has_function_privilege('authenticated','public.saas_branding_write_access_v2(uuid,uuid)','execute')
 or has_function_privilege('anon','public.saas_branding_save_v1(uuid,uuid,text,text,text,text,text,text,text,text)','execute') then
  raise exception 'Client executable RPC breach';
 end if;
 raise notice 'PASS Phase6B owner, admin, foreign denial, all levels, downgrade preservation, restoration, RPC grants; ROLLBACK';
end $qa$;
rollback;
