-- READ-ONLY acceptance checks for tasks canonical module.
-- Run after its schema, functions and security scripts.
SELECT n.nspname AS module, count(*) AS tables,
 count(*) FILTER (WHERE c.relrowsecurity) AS rls_enabled
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='tasks' AND c.relkind='r' GROUP BY n.nspname;
DO $verify$
DECLARE nt integer; nf integer; ng integer; np integer; bad integer;
BEGIN
 SELECT count(*) INTO nt FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='tasks' AND c.relkind='r';
 SELECT count(*) INTO nf FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='tasks' OR (n.nspname='public' AND p.proname LIKE 'task_%');
 SELECT count(*) INTO ng FROM pg_trigger tg JOIN pg_class c ON c.oid=tg.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='tasks' AND NOT tg.tgisinternal;
 SELECT count(*) INTO np FROM pg_policies WHERE schemaname='tasks';
 IF nt<>21 OR nf<60 OR ng<3 OR np<15 THEN
  RAISE EXCEPTION 'tasks incomplete: tables %, functions %, triggers %, policies % (expected 21, at least 60/3/15)',nt,nf,ng,np; END IF;
 SELECT count(*) INTO bad FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='tasks' AND c.relkind='r'
  AND (NOT c.relrowsecurity OR has_table_privilege('anon',c.oid,'SELECT')
   OR has_table_privilege('authenticated',c.oid,'SELECT')
   OR NOT has_table_privilege('service_role',c.oid,'SELECT'));
 IF bad>0 THEN RAISE EXCEPTION 'tasks has % tables with incorrect private grants/RLS',bad; END IF;
 SELECT count(*) INTO bad FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE (n.nspname='tasks' OR (n.nspname='public' AND p.proname LIKE 'task_%'))
 AND (has_function_privilege('anon',p.oid,'EXECUTE')
   OR has_function_privilege('authenticated',p.oid,'EXECUTE')
   OR NOT has_function_privilege('service_role',p.oid,'EXECUTE'));
 IF bad>0 THEN RAISE EXCEPTION 'tasks has % functions with incorrect grants',bad; END IF;
 RAISE NOTICE 'tasks structural and privilege checks passed; application tests are separate';
END $verify$;
