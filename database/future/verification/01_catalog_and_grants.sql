-- Future database safety and catalog verification (run INSIDE installation transaction).
-- Requires all 8 future module DDL packages to have been installed in the same transaction.
DO $future_verify$
DECLARE expected integer := 41; actual integer; secured integer; leaked integer; schema_n text;
BEGIN
 SELECT count(*) INTO actual FROM pg_class c
 JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname IN ('platform','lms','assessment','gamification','certificates','analytics','ai','operations')
 AND c.relkind IN ('r','p');
 IF actual <> expected THEN RAISE EXCEPTION 'Future module table count mismatch: % expected %',actual,expected; END IF;

 SELECT count(*) INTO secured FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname IN ('platform','lms','assessment','gamification','certificates','analytics','ai','operations')
 AND c.relkind IN ('r','p') AND c.relrowsecurity;
 IF secured <> expected THEN RAISE EXCEPTION 'Future module RLS coverage mismatch: % of %',secured,expected; END IF;

 SELECT count(*) INTO leaked FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname IN ('platform','lms','assessment','gamification','certificates','analytics','ai','operations')
 AND c.relkind IN ('r','p')
 AND (has_table_privilege('anon',c.oid,'SELECT') OR has_table_privilege('authenticated',c.oid,'SELECT')
 OR has_table_privilege('anon',c.oid,'INSERT') OR has_table_privilege('authenticated',c.oid,'INSERT')
 OR has_table_privilege('anon',c.oid,'UPDATE') OR has_table_privilege('authenticated',c.oid,'UPDATE')
 OR has_table_privilege('anon',c.oid,'DELETE') OR has_table_privilege('authenticated',c.oid,'DELETE'));
 IF leaked <> 0 THEN RAISE EXCEPTION 'Future module direct client privileges detected: %',leaked; END IF;

 IF to_regclass('public.students') IS NULL OR to_regclass('public.courses') IS NULL
 OR to_regclass('public.enrollments') IS NULL OR to_regclass('connect.tenants') IS NULL
 OR to_regclass('tasks.items') IS NULL THEN
   RAISE EXCEPTION 'Existing Release 1 reference tables unavailable';
 END IF;
END
$future_verify$;
