-- Read-only Meta test messaging Phase 3 validation (DEV).
select p.proname,p.prosecdef as security_definer,
 has_function_privilege('service_role',p.oid,'execute') as service_execute,
 has_function_privilege('anon',p.oid,'execute') as anon_execute,
 has_function_privilege('authenticated',p.oid,'execute') as authenticated_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
 ('connect_whatsapp_reserve_test_send','connect_whatsapp_complete_test_send',
  'connect_whatsapp_test_reply_context')
order by p.proname;
-- Expected all service=true, anon/authenticated=false, security_definer=false.

select relrowsecurity as send_requests_rls_enabled
from pg_class where oid='connect.whatsapp_send_requests'::regclass;
-- Expected true.

select name from supabase_migrations.schema_migrations where name in
('connect_whatsapp_meta_test_sending_phase3',
 'connect_whatsapp_meta_reply_eligibility_phase3',
 'connect_whatsapp_meta_test_send_limits_phase3') order by name;
-- Expected 3 installed in DEV, none in Production.

select count(*) as live_send_requests from connect.whatsapp_send_requests;
-- DEV has no actual sends before Meta developer configuration.

-- Verified with rollback-only fixtures:
-- * one recent inbound customer message allows reserving a reply;
-- * same client_request_id cannot reserve a second send;
-- * completion accepts Meta message ID and inserts outbound message once;
-- * repeated completion remains idempotent;
-- * forged actor cannot reserve;
-- * inbound older than 23h45m blocks freeform replies;
-- * sixth send request in one minute on same thread is rejected;
-- * temporary contacts and sent messages are rolled back.
--
-- Pending live acceptance: test app setup, verified Meta recipient,
-- real signed webhook callback, 200 verification challenge, live test send,
-- provider statuses, mobile browser and production build. No live number
-- migration or WA Simple modifications.
