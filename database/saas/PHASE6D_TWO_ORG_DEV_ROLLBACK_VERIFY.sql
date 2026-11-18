-- Phase 6D two-organization DEV white-label authorization acceptance.
-- All settings, membership and tier changes are rolled back.
begin;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $qa$
declare actor uuid; a uuid; b uuid; outsider uuid; r jsonb; t jsonb;
       stored jsonb; count_before integer; count_after integer; denied boolean;
begin
 select user_id into actor from saas.platform_administrators where active limit 1;
 select id into a from saas.organizations where status='active' order by slug limit 1;
 select id into b from saas.organizations where status='active' and id<>a order by slug limit 1;
 if a is null or b is null or actor is null then raise exception 'Two active organizations and Super Admin required';end if;
 -- Materialize two distinct saved themes, regardless of their initial entitlement.
 insert into saas.organization_settings(organization_id,setting_key,setting_value)
 values
 (a,'logo_url',to_jsonb('https://example.com/alpha-logo.png'::text)),
 (a,'tagline',to_jsonb('Alpha brand'::text)),
 (a,'accent_color',to_jsonb('#235ce2'::text)),
 (a,'theme_palette','{"primary":"#235ce2","secondary":"#e83d8c","accent":"#14b8a6","primaryHover":"#123b99","primarySoft":"#eef2ff","onPrimary":"#ffffff"}'::jsonb),
 (b,'logo_url',to_jsonb('https://example.com/beta-logo.png'::text)),
 (b,'tagline',to_jsonb('Beta brand retained'::text)),
 (b,'accent_color',to_jsonb('#126b4d'::text)),
 (b,'theme_palette','{"primary":"#126b4d","secondary":"#e83d8c","accent":"#14b8a6","primaryHover":"#0a4c32","primarySoft":"#e4f5eb","onPrimary":"#ffffff"}'::jsonb)
 on conflict(organization_id,setting_key) do update set setting_value=excluded.setting_value;
 perform public.saas_branding_tier_set_v1(actor,a,'white_label');
 -- If B was previously entitled, explicitly downgrade.
 if (public.saas_branding_tier_read_v1(actor,b)->>'level')<>'standard' then
  perform public.saas_branding_tier_set_v1(actor,b,'standard');
 end if;
 t:=public.saas_branding_tier_read_v1(actor,a);
 r:=public.saas_branding_view_v1(actor,a);
 if t->>'level'<>'white_label' or r->'branding'->>'logoUrl'<>'https://example.com/alpha-logo.png'
 or r->'branding'->'palette'->>'primary'<>'#235ce2' then raise exception 'A white label theme mismatch';end if;
 t:=public.saas_branding_tier_read_v1(actor,b);
 r:=public.saas_branding_view_v1(actor,b);
 if t->>'level'<>'standard' or r->'branding'->>'logoUrl'<>'https://example.com/beta-logo.png'
 then raise exception 'B saved-theme retention mismatch';end if;
 perform public.saas_branding_tier_set_v1(actor,b,'custom');
 t:=public.saas_branding_tier_read_v1(actor,b);
 if t->>'level'<>'custom' or
   (public.saas_branding_view_v1(actor,b)->'branding'->'palette'->>'primary')<>'#126b4d'
 then raise exception 'B reupgrade mismatch';end if;
 perform public.saas_branding_tier_set_v1(actor,a,'standard');
 if (public.saas_branding_tier_read_v1(actor,a)->>'level')<>'standard' or
   (public.saas_branding_view_v1(actor,a)->'branding'->>'logoUrl')<>'https://example.com/alpha-logo.png'
 then raise exception 'A downgrade preservation mismatch';end if;
 select m.user_id into outsider from saas.memberships m
 where m.status='active' and m.organization_id=b and
 not exists(select 1 from saas.memberships m2 where m2.organization_id=a and m2.user_id=m.user_id and m2.status='active')
 and not exists(select 1 from saas.platform_administrators pa where pa.user_id=m.user_id and pa.active)
 limit 1;
 if outsider is not null then
  if public.saas_branding_view_v1(outsider,a) is not null then raise exception 'Foreign user viewed A';end if;
  denied:=false;
  begin perform public.saas_branding_tier_read_v1(outsider,a);
   exception when insufficient_privilege then denied:=true;end;
  if not denied then raise exception 'Foreign user read A tier';end if;
 end if;
 perform public.saas_branding_tier_set_v1(actor,a,'white_label');
 if (public.saas_branding_tier_read_v1(actor,a)->>'level')<>'white_label' then raise exception 'White label reupgrade failed';end if;
 raise notice 'PASS 6D: two orgs, white_label/custom/standard, saved palette, downgrade, reupgrade, foreign denial (when fixture available); rolled back';
end $qa$;
rollback;
