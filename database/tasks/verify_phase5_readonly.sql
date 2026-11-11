-- Read-only Development verification; no test identities or rows are created.
-- Run after 07 and 08. Every assertion fails loudly if the boundary regresses.
do $$
begin
 if to_regclass('tasks.accounts') is null or to_regclass('tasks.module_links') is null or to_regclass('tasks.notifications') is null then
  raise exception 'Task-only account or integration tables missing';end if;
 if exists(select 1 from pg_class where oid in ('tasks.accounts'::regclass,'tasks.module_links'::regclass,'tasks.notifications'::regclass) and not relrowsecurity) then
  raise exception 'Private task table missing RLS';end if;
 if exists(select 1 from information_schema.role_table_grants
  where table_schema='tasks' and table_name in ('accounts','module_links','notifications') and grantee in ('anon','authenticated')) then
  raise exception 'Direct client privileges found on private task tables';end if;
 if not exists(select 1 from pg_proc where oid='public.task_bulk_import(uuid,jsonb)'::regprocedure)
  or not exists(select 1 from pg_proc where oid='public.task_account_activate(uuid,text)'::regprocedure) then
  raise exception 'Required Phase 5 RPC missing';end if;
 if (select count(*) from pg_trigger where tgname in ('task_module_crm_status_sync','task_module_crm_source_sync','tasks_prevent_module_link_sharing') and not tgisinternal)<>3 then
  raise exception 'Expected CRM safeguards missing';end if;
 if position('counsellor' in pg_get_functiondef('tasks.sync_crm_task_status()'::regprocedure))=0 then
  raise exception 'CRM sync membership role guard missing';end if;
 if public.task_account_get('00000000-0000-4000-8000-000000000000'::uuid) is not null then
  raise exception 'Unknown account should not exist';end if;
 if (public.task_account_metrics('00000000-0000-4000-8000-000000000000'::uuid)->>'personal_tasks')::int<>0 then
  raise exception 'Metrics are leaking across users';end if;
 if public.task_notifications_list('00000000-0000-4000-8000-000000000000'::uuid,10)<>'[]'::jsonb then
  raise exception 'Notifications leaking across users';end if;
end $$;
