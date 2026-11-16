-- Phase 4F: read-only DEV release gate. It deliberately reports blockers instead of certifying an empty DEV.
with guarded as (
 select p.proname,position('saas_subscription_access_v1' in pg_get_functiondef(p.oid))>0 as enforced
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in
 ('saas_authorized_module_entitlements','saas_my_workspaces','saas_my_academy_family',
 'saas_public_academy_brand','saas_crm_portal_access_v1','saas_crm_portal_install_v1',
 'saas_academy_v1','saas_academy_resource_owned','saas_admin_academy_overview',
 'saas_my_academy_trainer','saas_resolve_module_links')
)
select 'subscription_rpc_guards' as gate,
 case when count(*)=11 and bool_and(enforced) then 'PASS' else 'FAIL' end as status,
 count(*)::text||'/11 checked' as detail from guarded
union all
select 'verified_dev_users',case when count(*)>=2 then 'PASS' else 'BLOCKED' end,count(*)::text||' verified accounts'
from auth.users where email_confirmed_at is not null and coalesce(is_anonymous,false)=false
union all
select 'two_tenant_isolation_fixture',case when count(*)>=2 then 'PASS' else 'BLOCKED' end,count(*)::text||' organizations'
from saas.organizations
union all
select 'platform_admin_bootstrap',case when count(*)>=1 then 'PASS' else 'BLOCKED' end,count(*)::text||' active admins'
from saas.platform_administrators where active
union all
select 'subscription_fixture',case when count(*)>=1 then 'PASS' else 'BLOCKED' end,count(*)::text||' subscriptions'
from saas.platform_subscriptions;