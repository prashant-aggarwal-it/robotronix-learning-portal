-- Read-only Contact 360 Phase 3 verification; no records are inserted.
select p.proname, p.prosecdef as security_definer,
 has_function_privilege('service_role',p.oid,'execute') as service_execute,
 has_function_privilege('anon',p.oid,'execute') as anon_execute,
 has_function_privilege('authenticated',p.oid,'execute') as authenticated_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('connect_contact_relations','connect_contact_relation_command')
order by p.proname;
-- Expect both service_execute=true, anon/authenticated_execute=false, security_definer=false.
select relrowsecurity as rls_enabled from pg_class where oid='connect.contact_owners'::regclass;
-- Expect true.
select name from supabase_migrations.schema_migrations
where name in ('connect_contact_relationships_phase3','connect_contact_owners_rls') order by name;
-- UI QA: owner/admin assignment and unassignment; counsellor read-only ownership;
-- user with viewer role cannot write; parent-student outgoing/incoming relation;
-- organization creation and link; cross-workspace and cross-person IDs rejected;
-- refresh and rapid contact/workspace switching; mobile interactions.
