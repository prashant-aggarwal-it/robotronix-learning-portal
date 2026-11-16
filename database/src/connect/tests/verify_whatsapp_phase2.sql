-- Read-only Phase 2 WhatsApp inbox permission and migration checks.
select p.proname,p.prosecdef as security_definer,
 has_function_privilege('service_role',p.oid,'EXECUTE') as service_execute,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in (
 'connect_whatsapp_manage_thread','connect_whatsapp_thread_details',
 'connect_whatsapp_contact_search','connect_whatsapp_threads')
order by p.proname;
-- Expected: service role only, SECURITY INVOKER (security_definer false).
select relrowsecurity as rls_enabled from pg_class
where oid='connect.whatsapp_thread_state'::regclass;
-- Expected: true. Agent read markers and drafts are stored privately.
select name from supabase_migrations.schema_migrations
where name in ('connect_whatsapp_inbox_workflow_phase2','connect_whatsapp_preserve_manual_links_phase2')
order by name;
-- Expected: both migrations recorded in DEV.
-- Rollback-only DEV tests performed 2026-11-06:
--  - unread count 1 before read, 0 after mark_read
--  - saved draft fetched through thread details
--  - manager assignment and status updates
--  - contact linking and search by partial name
--  - arbitrary external actor cannot update thread
--  - contact link survives a subsequent incoming message on the same business number
--  - that new message does NOT create another enquiry.
--
-- Browser QA still required: simple/advanced navigation, responsive breakpoint, viewer
-- permissions, selected thread after pagination/refresh, empty state, loading, errors,
-- contact search and linking, manual draft edits, saved draft persistence, stale calls
-- across workspace switches. Live sending is intentionally disabled until Phase 3.
