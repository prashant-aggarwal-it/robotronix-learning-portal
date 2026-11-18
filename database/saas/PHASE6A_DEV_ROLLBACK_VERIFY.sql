-- Phase 6A DEV verification. Run in Supabase SQL editor against DEV only.
-- Transaction rolls back all synthetic tier writes and audit rows.
begin;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $qa$
declare
 v_org uuid;v_admin uuid;v_owner uuid;v_foreign uuid;v_result jsonb;
 v_before integer;v_after integer;v_did_reject boolean;
begin
 select user_id into v_admin from saas.platform_administrators where active limit 1;
 -- Use an active DEV member; temporarily set Owner inside the rollback transaction
 -- because old synthetic Owner organizations have already been archived.
 select m.organization_id,m.user_id into v_org,v_owner from saas.memberships m
 join saas.organizations o on o.id=m.organization_id and o.status='active'
 where m.status='active' and not exists(
  select 1 from saas.platform_administrators a where a.user_id=m.user_id and a.active)
 order by m.created_at limit 1;
 if v_admin is null or v_org is null or v_owner is null then raise exception 'DEV active admin and active member required';end if;
 update saas.memberships set role_key='owner' where organization_id=v_org and user_id=v_owner;
 select m.user_id into v_foreign from saas.memberships m where m.status='active' and m.organization_id<>v_org
  and not exists(select 1 from saas.platform_administrators a where a.user_id=m.user_id and a.active)
  and not exists(select 1 from saas.memberships mm where mm.organization_id=v_org and mm.user_id=m.user_id and mm.status='active') limit 1;
 if v_foreign is null then raise exception 'DEV independent foreign member required';end if;
 if has_function_privilege('anon','public.saas_branding_tier_read_v1(uuid,uuid)','EXECUTE')
 or has_function_privilege('authenticated','public.saas_branding_tier_set_v1(uuid,uuid,text)','EXECUTE')
 or not has_function_privilege('service_role','public.saas_branding_tier_set_v1(uuid,uuid,text)','EXECUTE')
 then raise exception 'RPC privilege boundary failed';end if;
 v_result:=public.saas_branding_tier_read_v1(v_owner,v_org);
 if v_result->>'level'<>'standard' then raise exception 'Owner/default read failed';end if;
 v_did_reject:=false;
 begin
  perform public.saas_branding_tier_set_v1(v_owner,v_org,'custom');
 exception when insufficient_privilege then v_did_reject:=true;end;
 if not v_did_reject then raise exception 'Owner escalation permitted';end if;
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 v_did_reject:=false;
 begin
  perform public.saas_branding_tier_read_v1(v_foreign,v_org);
 exception when insufficient_privilege then v_did_reject:=true;end;
 if not v_did_reject then raise exception 'Foreign user read permitted';end if;
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 v_did_reject:=false;
 begin
  perform public.saas_branding_tier_set_v1(v_admin,v_org,'invalid');
 exception when invalid_parameter_value then v_did_reject:=true;end;
 if not v_did_reject then raise exception 'Invalid tier permitted';end if;
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 select count(*) into v_before from saas.audit_events where organization_id=v_org and event_type='branding_tier_changed';
 v_result:=public.saas_branding_tier_set_v1(v_admin,v_org,'custom');
 if v_result->>'changed'<>'true' or v_result->>'previous'<>'standard' then raise exception 'Custom change failed';end if;
 v_result:=public.saas_branding_tier_set_v1(v_admin,v_org,'white_label');
 if v_result->>'previous'<>'custom' then raise exception 'White label change failed';end if;
 v_result:=public.saas_branding_tier_set_v1(v_admin,v_org,'standard');
 if v_result->>'previous'<>'white_label' then raise exception 'Standard restoration failed';end if;
 v_result:=public.saas_branding_tier_set_v1(v_admin,v_org,'standard');
 if v_result->>'changed'<>'false' then raise exception 'No-op improperly changed state';end if;
 select count(*) into v_after from saas.audit_events where organization_id=v_org and event_type='branding_tier_changed';
 if v_after-v_before<>3 then raise exception 'Expected three audited changes';end if;
 raise notice 'PASS phase6a: default, owner read, denied escalation, foreign denial, invalid tier, 3 audited transitions, no-op; all rolled back';
end $qa$;
rollback;
