-- Phase 4E DEV read-only security gate. Execute after migration 69.
-- Fails if the subscription-aware RPC boundaries or privileged grants regress.
do $audit$
declare v_name text;v_oid oid;v_definition text;v_count integer;
begin
 foreach v_name in array array[
 'saas_authorized_module_entitlements','saas_my_workspaces','saas_my_academy_family',
 'saas_public_academy_brand','saas_crm_portal_access_v1','saas_crm_portal_install_v1'
 ] loop
  select p.oid,pg_get_functiondef(p.oid) into v_oid,v_definition
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname=v_name limit 1;
  if v_oid is null or position('saas_subscription_access_v1' in v_definition)=0 then
   raise exception '4E subscription gate missing: %',v_name;
  end if;
 end loop;
 foreach v_name in array array[
 'saas_platform_subscription_manage_v1','saas_platform_configure_first_tenant_v1',
 'saas_crm_portal_access_v1','saas_crm_portal_install_v1',
 'saas_authorized_module_entitlements'
 ] loop
  select p.oid into v_oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname=v_name limit 1;
  if v_oid is null or has_function_privilege('anon',v_oid,'EXECUTE')
   or has_function_privilege('authenticated',v_oid,'EXECUTE')
  then raise exception '4E privileged function grant regression: %',v_name;end if;
 end loop;
 select count(*) into v_count from saas.organizations where slug='phase4e-rollback-probe';
 if v_count<>0 then raise exception '4E rollback test left data behind';end if;
end $audit$;
select 'PASS: subscription RPC guards and privileged grants' as phase4e_readonly_audit;