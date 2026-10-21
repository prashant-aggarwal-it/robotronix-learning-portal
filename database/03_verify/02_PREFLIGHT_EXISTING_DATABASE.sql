-- READ-ONLY PRE-FLIGHT for an EXISTING Robotronix DEV/Production DB.
-- Run BEFORE any migration. Save the results and review discrepancies.
-- This script makes no modifications and does not approve deployment.
select current_database() as database_name, current_user as session_role, current_setting('server_version') as postgres_version, now() as checked_at;
with required(table_name) as (values
 ('public.portal_notifications'),('public.trainer_finance_change_requests'),
 ('public.trainer_finance'),('public.trainer_payouts'),
 ('public.portal_access_requests'),('public.system_settings'),
 ('public.schedule_events'),('public.communication_messages'),
 ('public.progress_alert_actions'),('public.onboarding_submissions')
)
select table_name, case when to_regclass(table_name) is null then 'MISSING - STOP' else 'FOUND' end as result
from required order by table_name;

select 'P1 payout trigger' as feature,
 exists(select 1 from pg_trigger where tgname='trainer_payout_action_insert_trg' and not tgisinternal) as installed
union all select 'P1 onboarding trigger',
 exists(select 1 from pg_trigger where tgname='onboarding_submission_admin_notification_trg' and not tgisinternal)
union all select 'P2 Realtime notifications',
 exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='portal_notifications')
union all select '06 diagnostic table',to_regclass('public.portal_system_logs') is not null
union all select '07 payout instruction versions',to_regclass('public.trainer_payout_instruction_versions') is not null
union all select '07 monthly lock trigger',
 exists(select 1 from pg_trigger where tgname='trainer_payout_instruction_lock_trg' and not tgisinternal)
union all select '08 provisioned access state',
 exists(select 1 from pg_constraint where conrelid=to_regclass('public.portal_access_requests') and pg_get_constraintdef(oid) like '%provisioned%')
union all select '09 retention function',
 to_regprocedure('public.purge_old_portal_system_logs(integer)') is not null;

-- Confirm existing payroll before 07. Collect counts ONLY; do not export bank details.
select status,count(*) as payout_rows
from public.trainer_payouts group by status order by status;
select count(*) filter(where status in ('approved','paid')) as finalized_payouts,
 count(*) as total_payouts from public.trainer_payouts;

-- Record permissions status; must be evaluated under real role tokens after migrations.
select tablename,rowsecurity from pg_tables where schemaname='public'
and tablename in ('trainer_finance','trainer_finance_change_requests','trainer_payouts','portal_notifications','portal_access_requests');
