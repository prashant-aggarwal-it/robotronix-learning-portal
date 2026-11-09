-- Development only: extend the existing 5-minute CRM reminder job.
-- Production scheduling requires separate deployment approval.
select cron.schedule(
 'robotronix-connect-inapp-reminders',
 '*/5 * * * *',
 'select public.connect_run_reminders(500),public.connect_process_portal_demo_followups(100);'
);
