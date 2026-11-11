-- Phase 3B Development: in-database scheduling for in-app reminders.
-- Enable pg_cron only on Development; evaluate Production separately at release.
begin;
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule(
 'robotronix-connect-inapp-reminders',
 '*/5 * * * *',
 'select public.connect_run_reminders(500);'
);
commit;