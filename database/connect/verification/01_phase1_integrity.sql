-- Read-only audit of the installed Connect CRM foundation.
-- Expected: crm_tables=28, crm_rls_tables=28, no browser permissions on canonical identity/opportunities.
-- Run on Development ONLY while validating Phase 1.
select
 (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' and c.relname like 'crm_%') as crm_tables,
 (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' and c.relname like 'crm_%' and c.relrowsecurity) as crm_rls_tables,
 (select count(*) from public.crm_people) as crm_people,
 (select count(*) from public.crm_opportunities) as crm_opportunities,
 has_table_privilege('anon','public.crm_people','SELECT') as anonymous_can_read_people,
 has_table_privilege('authenticated','public.crm_people','SELECT') as portal_user_can_read_people,
 has_table_privilege('service_role','public.crm_people','SELECT') as server_can_read_people,
 has_table_privilege('anon','public.crm_opportunities','SELECT') as anonymous_can_read_opportunities,
 has_table_privilege('authenticated','public.crm_opportunities','SELECT') as portal_user_can_read_opportunities;

-- Relationship coverage by table.
select
 c.relname as crm_table,
 count(*) filter(where k.contype='p') as primary_keys,
 count(*) filter(where k.contype='f') as foreign_keys
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
left join pg_constraint k on k.conrelid=c.oid
where n.nspname='public' and c.relkind='r' and c.relname like 'crm_%'
group by c.relname order by c.relname;

-- Ensure legacy operational tables are still present.
select name, to_regclass('public.'||name) is not null as present
from (values ('demo_leads'),('demo_sessions'),('demo_session_participants'),
 ('parents'),('students'),('onboarding_submissions'),('enrollments'),
 ('schedule_events'),('student_invoices'),('zoom_meetings')) q(name);
