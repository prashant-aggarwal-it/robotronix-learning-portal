-- Canonical Tasks + CRM installation verification. READ-ONLY.
-- Expected source-of-truth DEV baseline captured 2026-11-11.
SELECT n.nspname AS feature,count(*) AS installed_tables,
 count(*) FILTER (WHERE c.relrowsecurity) AS rls_enabled_tables
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('tasks','connect') AND c.relkind='r'
GROUP BY n.nspname ORDER BY n.nspname;

SELECT n.nspname AS routine_schema,count(*) AS installed_functions
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname IN ('tasks','connect') OR
 (n.nspname='public' AND (p.proname LIKE 'task_%' OR p.proname LIKE 'connect_%'
 OR p.proname LIKE 'portal_admission_%' OR p.proname LIKE 'portal_demo_%'))
GROUP BY n.nspname ORDER BY n.nspname;

DO $verify$ DECLARE t int; c int; f int; exposed int;
BEGIN
 SELECT count(*) INTO t FROM pg_class x JOIN pg_namespace n ON n.oid=x.relnamespace WHERE n.nspname='tasks' AND x.relkind='r';
 SELECT count(*) INTO c FROM pg_class x JOIN pg_namespace n ON n.oid=x.relnamespace WHERE n.nspname='connect' AND x.relkind='r';
 SELECT count(*) INTO f FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('tasks','connect') OR
 (n.nspname='public' AND (p.proname LIKE 'task_%' OR p.proname LIKE 'connect_%' OR p.proname LIKE 'portal_admission_%' OR p.proname LIKE 'portal_demo_%'));
 IF t<>21 OR c<>66 OR f<>150 THEN RAISE EXCEPTION 'Incomplete canonical install: tasks %, CRM %, functions % (expected 21,66,150)',t,c,f; END IF;
 SELECT count(*) INTO exposed FROM pg_class x JOIN pg_namespace n ON n.oid=x.relnamespace WHERE n.nspname IN ('tasks','connect') AND x.relkind='r'
 AND (NOT x.relrowsecurity OR has_table_privilege('anon',x.oid,'SELECT') OR has_table_privilege('authenticated',x.oid,'SELECT') OR NOT has_table_privilege('service_role',x.oid,'SELECT'));
 IF exposed>0 THEN RAISE EXCEPTION '% module tables have unsafe/incorrect access',exposed; END IF;
 IF to_regprocedure('public.task_v2_capture(uuid,jsonb)') IS NULL THEN RAISE EXCEPTION 'Task V2 capture missing'; END IF;
 IF to_regprocedure('public.portal_admission_handoff_token(text,text,uuid,uuid,text)') IS NULL THEN RAISE EXCEPTION 'Guardian handoff missing'; END IF;
 RAISE NOTICE 'Canonical structural verification passed; application smoke tests still required';
END $verify$;
