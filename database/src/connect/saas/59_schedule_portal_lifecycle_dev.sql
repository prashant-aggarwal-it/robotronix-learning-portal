-- Development only: Portal is authoritative; reconciled CRM projections are refreshed every 5 minutes.
select cron.schedule('robotronix-connect-portal-lifecycle','*/5 * * * *',
 'select public.connect_sync_portal_lifecycle(500);');
