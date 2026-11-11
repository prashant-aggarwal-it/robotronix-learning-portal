-- Robotronix manual SQL release: 09 post-install verification.
-- Read-only checks. Fail if essential schema/RPC security is missing.
SELECT n.nspname AS feature,
 count(*) FILTER (WHERE c.relkind='r') AS tables,
 count(*) FILTER (WHERE c.relkind='r' AND c.relrowsecurity) AS rls_tables
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('tasks','connect')
GROUP BY n.nspname ORDER BY n.nspname;

SELECT split_part(p.proname,'_',1) AS feature, count(*) AS rpc_count,
 count(*) FILTER (WHERE NOT has_function_privilege('service_role',p.oid,'EXECUTE')) AS missing_service_execute,
 count(*) FILTER (WHERE has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE')) AS public_execute_exposure
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND (p.proname LIKE 'task_%' OR p.proname LIKE 'connect_%')
GROUP BY 1 ORDER BY 1;

DO $verify$
DECLARE total_tasks integer; total_connect integer;
  task_rpcs integer; connect_rpcs integer; bad_rpcs integer; bad_tables integer;
BEGIN
 SELECT count(*) INTO total_tasks FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='tasks' AND c.relkind='r';
 SELECT count(*) INTO total_connect FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='connect' AND c.relkind='r';
 SELECT count(*) INTO task_rpcs FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'task_%';
 SELECT count(*) INTO connect_rpcs FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'connect_%';
 IF total_tasks<>21 OR total_connect<>66 THEN RAISE EXCEPTION 'Table count mismatch: tasks %, connect % (expected 21 / 66)',total_tasks,total_connect; END IF;
 IF task_rpcs<57 OR connect_rpcs<76 THEN RAISE EXCEPTION 'Missing RPCs: tasks %, connect % (expected >=57 / >=76)',task_rpcs,connect_rpcs; END IF;
 SELECT count(*) INTO bad_tables FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname IN ('tasks','connect') AND c.relkind='r'
  AND (NOT c.relrowsecurity OR NOT has_table_privilege('service_role',c.oid,'SELECT') OR NOT has_table_privilege('service_role',c.oid,'INSERT')
   OR has_table_privilege('anon',c.oid,'SELECT') OR has_table_privilege('authenticated',c.oid,'SELECT'));
 IF bad_tables<>0 THEN RAISE EXCEPTION '% private tables have missing RLS / incorrect grants',bad_tables; END IF;
 SELECT count(*) INTO bad_rpcs FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND (p.proname LIKE 'task_%' OR p.proname LIKE 'connect_%')
  AND (NOT has_function_privilege('service_role',p.oid,'EXECUTE')
   OR has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE'));
 IF bad_rpcs<>0 THEN RAISE EXCEPTION '% task/connect RPCs have invalid grants',bad_rpcs; END IF;
 IF to_regprocedure('public.task_v2_capture(uuid,jsonb)') IS NULL THEN RAISE EXCEPTION 'Task V2 capture function missing'; END IF;
 IF to_regprocedure('public.portal_admission_handoff_token(text,text,uuid,uuid,text)') IS NULL THEN RAISE EXCEPTION 'Verified guardian handoff RPC missing'; END IF;
 IF to_regprocedure('public.portal_admission_handoff_token(text,text,uuid,uuid)') IS NOT NULL THEN RAISE EXCEPTION 'Old insecure guardian handoff RPC overload still installed'; END IF;
 RAISE NOTICE 'Robotronix Tasks + CRM structural/permission checks passed. App-level testing is still required.';
END $verify$;
