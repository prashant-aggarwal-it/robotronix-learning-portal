-- Phase 12 / DEV readiness assertions. READ ONLY: no mutations.
do $qa$
declare missing text; violations text;
begin
 select string_agg(r.name,', ') into missing from
 (values ('saas_create_owned_organization'),('saas_provision_owned_modules'),
 ('saas_my_workspaces'),('saas_invite_academy_family'),('saas_accept_academy_family_invite'),
 ('saas_admin_academy_overview'),('saas_my_academy_trainer'),('saas_my_academy_family'),
 ('saas_public_academy_brand'),('saas_academy_v1'),
 ('saas_list_members_v1')) as r(name)
 where not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname=r.name);
 if missing is not null then raise exception 'Missing required SaaS functions: %',missing;end if;

 select string_agg(n.nspname||'.'||p.proname,', ') into violations
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public'
 and p.proname in ('saas_create_owned_organization','saas_provision_owned_modules',
  'saas_my_workspaces','saas_invite_academy_family','saas_accept_academy_family_invite',
  'saas_admin_academy_overview','saas_my_academy_trainer','saas_my_academy_family',
  'saas_academy_v1','saas_list_members_v1')
 and (not p.prosecdef or has_function_privilege('anon',p.oid,'EXECUTE'));
 if violations is not null then raise exception 'Unsafe SaaS RPC privileges: %',violations;end if;

 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('saas_academy_v1','saas_list_members_v1')
 and has_function_privilege('authenticated',p.oid,'EXECUTE')) then
 raise exception 'Server-only RPC is available to authenticated web clients';end if;

 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='saas' and c.relname in
 ('academy_family_access','academy_family_invitations','academy_trainer_account_links')
 and not c.relrowsecurity) then raise exception 'Tenant linkage table missing RLS';end if;

 if not exists(select 1 from pg_trigger where tgname='saas_sync_module_membership'
 and tgrelid='saas.memberships'::regclass and tgenabled='O') then
 raise exception 'CRM/Tasks membership lifecycle trigger missing or disabled';end if;
 raise notice 'Milestone C Phase 12 database readiness assertions passed';
end $qa$;
select 'Milestone C Phase 12 database security checks passed' as result;