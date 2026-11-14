-- Canonical fresh-install audit coverage for P0/P1 operational tables.
-- Run only after the baseline schema. No existing rows are changed.
-- SECURITY: audit records contain sensitive before/after values. Keep portal_audit_log RLS admin-only.
BEGIN;
DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['portal_access_requests','student_invoices','zoom_meetings','zoom_recordings'] LOOP
  IF to_regclass('public.'||t) IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM pg_trigger trg JOIN pg_class c ON c.oid=trg.tgrelid
   JOIN pg_namespace ns ON ns.oid=c.relnamespace
   WHERE ns.nspname='public' AND c.relname=t AND trg.tgname='audit_'||t
  ) THEN
   EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_core_change()', 'audit_'||t,t);
  END IF;
 END LOOP;
END $$;
COMMIT;

