-- Read-only checks for DEV Phase 4.
select n.nspname,p.proname,p.prosecdef as security_definer,
 has_function_privilege('service_role',p.oid,'execute') as service_execute,
 has_function_privilege('anon',p.oid,'execute') as anon_execute,
 has_function_privilege('authenticated',p.oid,'execute') as authenticated_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='connect_contact_insights';
-- Expect 1 row, service=true; anon/authenticated=false; security_definer=false.
select name from supabase_migrations.schema_migrations where name='connect_contact_intelligence_phase4';
-- End-to-end QA: zero contacts, active leads with no tasks, overdue task,
-- upcoming appointment, unassigned contact, inactive actor, another workspace,
-- contact record beyond first 100 list rows, UI refresh after creating a follow-up.
-- Rules are factual heuristics. Do not interpret as predictions or contact quality scores.
