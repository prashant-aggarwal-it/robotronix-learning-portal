-- Read-only catalog / access verification for SaaS Academy ownership bridge.
DO $v$ DECLARE n int; r int; legacy int; insecure int; BEGIN
 SELECT count(*),count(*) FILTER(WHERE c.relrowsecurity) INTO n,r
 FROM pg_class c JOIN pg_namespace x ON x.oid=c.relnamespace
 WHERE x.nspname='saas' AND c.relkind IN ('r','p');
 IF n<>13 OR r<>13 THEN RAISE EXCEPTION 'SaaS table RLS mismatch: %/%',r,n; END IF;
 SELECT count(*) INTO legacy FROM pg_class c JOIN pg_namespace x ON x.oid=c.relnamespace
 WHERE x.nspname IN ('public','connect','tasks') AND c.relkind IN ('r','p');
 IF legacy<>167 THEN RAISE EXCEPTION 'Legacy table mismatch: %',legacy; END IF;
 SELECT count(*) INTO insecure FROM pg_class c JOIN pg_namespace x ON x.oid=c.relnamespace
 WHERE x.nspname='saas' AND c.relname LIKE 'academy_%' AND c.relkind IN ('r','p')
 AND (has_table_privilege('anon',c.oid,'SELECT') OR has_table_privilege('authenticated',c.oid,'SELECT')
 OR has_table_privilege('anon',c.oid,'INSERT') OR has_table_privilege('authenticated',c.oid,'INSERT'));
 IF insecure<>0 THEN RAISE EXCEPTION 'Unexpected client grants on ownership bridge'; END IF;
 IF has_function_privilege('authenticated','saas.link_academy_enrollment(uuid,uuid)','EXECUTE') OR
 has_function_privilege('anon','saas.link_academy_enrollment(uuid,uuid)','EXECUTE') THEN
  RAISE EXCEPTION 'Dangerous link function exposed to API roles';
 END IF;
END $v$;
