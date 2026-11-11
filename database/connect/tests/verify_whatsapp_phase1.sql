-- WhatsApp Phase 1 verification (READ-ONLY). Test fixtures are run separately in a rollback transaction.
select p.proname,p.prosecdef as security_definer,
 has_function_privilege('service_role',p.oid,'execute') as service_execute,
 has_function_privilege('anon',p.oid,'execute') as anon_execute,
 has_function_privilege('authenticated',p.oid,'execute') as authenticated_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in (
 'connect_ingest_whatsapp_message','connect_ingest_whatsapp_status',
 'connect_whatsapp_threads','connect_whatsapp_conversation_messages')
order by p.proname;
-- Expected: service_execute TRUE, anon_execute FALSE, authenticated_execute FALSE,
-- security_definer FALSE. The direct intake RPCs are ONLY called after Meta signature validation.

select relrowsecurity as delivery_events_rls_enabled from pg_class
where oid='connect.whatsapp_delivery_events'::regclass;
-- Expected: TRUE; no public grants.

select name from supabase_migrations.schema_migrations
where name in ('connect_whatsapp_messaging_foundation_phase1','connect_whatsapp_inbox_read_phase1')
order by name;
-- Expected: both migrations installed in DEV only.

-- Rollback-only DEV fixture tests executed on 2026-11-06:
-- 1. Incoming WhatsApp message from a new phone creates one contact and one enquiry.
-- 2. Second message by the same person creates a message but NOT a second enquiry.
-- 3. Repeated webhook with the same external message ID does not create a duplicate.
-- 4. Second business phone number creates a separate conversation for the same contact.
-- 5. Delivery 'read' arriving before an outbound message is reconciled; a later
--    'sent' event must not downgrade it.
-- 6. Document message records type, ID and filename metadata without exposing a media URL.
-- 7. Read RPC thread/message keyset pagination works across pages.
-- 8. Unauthorized actors cannot read threads or messages.
-- All fixture writes ran within BEGIN/ROLLBACK; no test data persisted.
--
-- Still required before any LIVE activation:
-- TypeScript and Next.js production build; signed Meta webhook replay and real API integration;
-- app coexistence eligibility; permissions and tenant-switch browser QA; media retrieval tests;
-- Meta provider setup. No production database, Meta account, or WA Simple change has been made.
