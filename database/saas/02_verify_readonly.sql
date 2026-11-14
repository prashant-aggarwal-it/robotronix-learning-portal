-- SaaS additive foundation verification, safe read-only.
DO $verify$ DECLARE expected int; secured int; other_schemas int; BEGIN
 SELECT count(*) INTO expected FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='saas' AND c.relkind IN ('r','p');
 SELECT count(*) INTO secured FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='saas' AND c.relkind IN ('r','p') AND c.relrowsecurity;
 SELECT count(*) INTO other_schemas FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','connect','tasks') AND c.relkind IN ('r','p');
 IF expected <> 9 OR secured <> 9 OR other_schemas <> 167 THEN RAISE EXCEPTION 'Catalog mismatch: saas=%, rls=%, legacy=%',expected,secured,other_schemas; END IF;
 IF EXISTS (
 SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='saas' AND c.relkind IN ('r','p')
 AND (has_table_privilege('anon',c.oid,'SELECT') OR has_table_privilege('anon',c.oid,'INSERT')
 OR has_table_privilege('authenticated',c.oid,'INSERT') OR has_table_privilege('authenticated',c.oid,'UPDATE')
 OR has_table_privilege('authenticated',c.oid,'DELETE'))
 ) THEN RAISE EXCEPTION 'Unauthorized direct table grant detected'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='saas' AND tablename='organizations' AND policyname='member_org_read') THEN RAISE EXCEPTION 'Organization RLS absent'; END IF;
END $verify$;
