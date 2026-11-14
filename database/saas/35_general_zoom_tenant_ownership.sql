-- Phase 3B: SaaS ownership for general Zoom meetings (no class schedule FK).
-- Shared Zoom host accounts remain platform-managed resources; meetings are tenant-owned.
BEGIN;
ALTER TABLE public.zoom_meetings ADD COLUMN IF NOT EXISTS saas_org_id uuid REFERENCES saas.organizations(id);
CREATE INDEX IF NOT EXISTS zoom_general_saas_org ON public.zoom_meetings(saas_org_id,scheduled_start DESC)
 WHERE purpose='general' AND saas_org_id IS NOT NULL;
CREATE OR REPLACE FUNCTION saas.zoom_general_org_reassignment_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
BEGIN
 IF NEW.saas_org_id IS DISTINCT FROM OLD.saas_org_id
 THEN RAISE EXCEPTION 'Zoom meeting organization is immutable' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION saas.zoom_general_org_reassignment_guard() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS saas_zoom_general_org_guard ON public.zoom_meetings;
CREATE TRIGGER saas_zoom_general_org_guard BEFORE UPDATE ON public.zoom_meetings FOR EACH ROW EXECUTE FUNCTION saas.zoom_general_org_reassignment_guard();
COMMIT;
