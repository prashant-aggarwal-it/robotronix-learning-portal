-- Read-only post-install certification of dormant future modules.
DO $future_check$ DECLARE n int; original_n int; exposed int; rls_n int; BEGIN
 SELECT count(*),count(*) FILTER (WHERE c.relrowsecurity),
 count(*) FILTER (WHERE has_table_privilege('anon',c.oid,'SELECT') OR has_table_privilege('authenticated',c.oid,'SELECT')
 OR has_table_privilege('anon',c.oid,'INSERT') OR has_table_privilege('authenticated',c.oid,'INSERT')
 OR has_table_privilege('anon',c.oid,'UPDATE') OR has_table_privilege('authenticated',c.oid,'UPDATE')
 OR has_table_privilege('anon',c.oid,'DELETE') OR has_table_privilege('authenticated',c.oid,'DELETE'))
 INTO n,rls_n,exposed
 FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace
 WHERE s.nspname IN ('lms','assessment','gamification','certificates','analytics','operations','ai')
 AND c.relkind IN ('r','p');
 IF n<>35 OR rls_n<>35 OR exposed<>0 THEN RAISE EXCEPTION 'Future modules security gate failed: tables %, RLS %, exposed %',n,rls_n,exposed; END IF;
 SELECT count(*) INTO original_n FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace
 WHERE s.nspname IN ('public','connect','tasks','saas') AND c.relkind IN ('r','p');
 IF original_n<>180 THEN RAISE EXCEPTION 'Existing schema count changed from 180 to %',original_n; END IF;
 IF to_regnamespace('platform') IS NOT NULL THEN RAISE EXCEPTION 'Competing platform schema unexpectedly installed'; END IF;
END $future_check$;
