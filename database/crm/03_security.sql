-- Canonical connect security and triggers, independent of other Robotronix products.
BEGIN;
DO $gate$ BEGIN IF to_regnamespace('connect') IS NULL THEN RAISE EXCEPTION 'connect schema not installed'; END IF; END $gate$;
CREATE TRIGGER contact_import_enrich_profile AFTER INSERT ON connect.contact_import_details FOR EACH ROW EXECUTE FUNCTION connect.contact_import_enrich_profile();
CREATE TRIGGER connect_inquiry_initial_followup AFTER INSERT ON connect.inquiries FOR EACH ROW EXECUTE FUNCTION connect.automate_unqualified_inquiry();
CREATE TRIGGER connect_opportunity_automation AFTER INSERT ON connect.opportunities FOR EACH ROW EXECUTE FUNCTION connect.automate_new_opportunity();
CREATE TRIGGER connect_tenant_default_categories AFTER INSERT ON connect.tenants FOR EACH ROW EXECUTE FUNCTION connect.initialize_enquiry_categories();
CREATE TRIGGER whatsapp_test_send_rate_guard BEFORE INSERT ON connect.whatsapp_send_requests FOR EACH ROW EXECUTE FUNCTION connect.whatsapp_send_test_rate_guard();

DO $acl$ DECLARE t record; BEGIN FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='connect' AND c.relkind='r' LOOP EXECUTE format('ALTER TABLE connect.%I ENABLE ROW LEVEL SECURITY',t.relname); EXECUTE format('REVOKE ALL ON TABLE connect.%I FROM PUBLIC,anon,authenticated',t.relname); EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE connect.%I TO service_role',t.relname); END LOOP; END $acl$;
COMMIT;
