-- P2/P3 event delivery: idempotent Supabase Realtime publication membership.
-- Apply only AFTER baseline schema and P1 action notifications migration.
-- Never expose sensitive trainer_finance / trainer_finance_change_requests row payloads
-- to public channels. Realtime Postgres Changes still enforces table RLS.
begin;
do $$
declare t text;
begin
 if not exists(select 1 from pg_publication where pubname='supabase_realtime') then
  raise exception 'Supabase Realtime publication is missing; verify correct DEV project';
 end if;
 foreach t in array array[
  'portal_notifications','onboarding_submissions',
  'students','trainers','courses','enrollments','cohorts',
  'schedule_events','class_attendance','session_records',
  'learning_observations','learner_projects',
  'trainer_earnings','trainer_payouts','trainer_compensation_plans',
  'trainer_finance','trainer_finance_change_requests',
  'trainer_availability','trainer_availability_overrides',
  'student_invoices','student_fee_payments',
  'progress_alert_actions','communication_threads','communication_messages'
 ] loop
  if to_regclass('public.'||t) is null then
    raise exception 'Realtime required table public.% missing; check migration order',t;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
   execute format('alter publication supabase_realtime add table public.%I',t);
  end if;
 end loop;
end $$;
commit;

-- Read-only verification:
-- select tablename from pg_publication_tables
-- where pubname='supabase_realtime' and schemaname='public' order by tablename;
