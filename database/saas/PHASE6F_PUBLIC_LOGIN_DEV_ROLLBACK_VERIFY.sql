-- Phase 6F: prove public unauthenticated Academy login honors stored branding entitlements.
-- DEV only. All temporary subscription/tier/theme changes roll back.
begin;
do $qa$
declare org uuid;slug text;ret jsonb;original_url text:='https://example.com/phase6f-qa-logo.png';
begin
 select id,o.slug into org,slug from saas.organizations o
 where o.status='active' and exists(select 1 from saas.platform_subscriptions s where s.organization_id=o.id)
 and exists(select 1 from saas.module_entitlements e where e.organization_id=o.id and e.module_key='academy' and e.enabled)
 order by o.slug limit 1;
 if org is null then raise exception 'Active DEV synthetic Academy organization required';end if;
 if slug not like 'saas-e2e-%' then raise exception 'Refusing to mutate non-QA organization %',slug;end if;
 update saas.platform_subscriptions set ends_at=now()+interval '1 day'
 where id=(select id from saas.platform_subscriptions s where s.organization_id=org order by started_at desc,id desc limit 1);
 insert into saas.organization_settings(organization_id,setting_key,setting_value)
 values (org,'logo_url',to_jsonb(original_url)),(org,'tagline',to_jsonb('Retained QA tagline'::text)),
 (org,'accent_color',to_jsonb('#235ce2'::text)),(org,'branding_tier',to_jsonb('standard'::text))
 on conflict (organization_id,setting_key) do update set setting_value=excluded.setting_value;
 if not has_function_privilege('anon','public.saas_public_academy_brand(text)','execute') then
   raise exception 'Public login read grant missing';end if;
 ret:=public.saas_public_academy_brand(slug);
 if ret is null or ret->>'level'<>'standard' or ret->>'logoUrl'<>''
 or ret->>'tagline'<>''
 or ret->>'accentColor'<>'#6d3cc9' then raise exception 'Standard public leak: %',ret;end if;
 update saas.organization_settings set setting_value=to_jsonb('custom'::text)
 where organization_id=org and setting_key='branding_tier';
 ret:=public.saas_public_academy_brand(slug);
 if ret->>'level'<>'custom' or ret->>'logoUrl'<>original_url
 or ret->>'tagline'<>'Retained QA tagline' or ret->>'accentColor'<>'#235ce2' then
   raise exception 'Custom public identity failed: %',ret;end if;
 update saas.organization_settings set setting_value=to_jsonb('white_label'::text)
 where organization_id=org and setting_key='branding_tier';
 ret:=public.saas_public_academy_brand(slug);
 if ret->>'level'<>'white_label' or ret->>'logoUrl'<>original_url then
   raise exception 'White-label public identity failed: %',ret;end if;
 update saas.organization_settings set setting_value=to_jsonb('standard'::text)
 where organization_id=org and setting_key='branding_tier';
 ret:=public.saas_public_academy_brand(slug);
 if ret->>'logoUrl'<>''
 or (select setting_value #>> '{}' from saas.organization_settings where organization_id=org and setting_key='logo_url')<>original_url then
  raise exception 'Downgrade failed to suppress yet retain branding';end if;
 raise notice 'PASS public login standard/custom/white_label and downgrade preservation; rolled back';
end $qa$;
rollback;