-- Connect SaaS v2 acceptance checks. All read-only.
-- Expected: 35 Connect tables, 80 intact Portal tables in shared DEV,
-- 0 prototype crm_* tables, 0 missing RLS, 0 direct Portal foreign keys.
select (select count(*) from pg_tables where schemaname='connect') as connect_tables,
 (select count(*) from pg_tables where schemaname='public') as portal_tables,
 (select count(*) from pg_tables where schemaname='public' and tablename like 'crm_%') as obsolete_prototypes,
 (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='connect' and c.relkind='r' and not c.relrowsecurity) as missing_rls,
 (select count(*) from pg_constraint c where c.connamespace='connect'::regnamespace
   and c.contype='f' and c.confrelid::regclass::text like 'public.%') as portal_dependencies,
 has_schema_privilege('anon','connect','USAGE') as anon_has_connect_access,
 has_schema_privilege('authenticated','connect','USAGE') as authenticated_has_connect_access,
 has_table_privilege('authenticated','connect.people','SELECT') as authenticated_can_read_people;
-- No example tenant data is needed for installation.
select (select count(*) from connect.tenants) as tenants,
 (select count(*) from connect.people) as people,
 (select count(*) from connect.opportunities) as opportunities;
