-- Canonical final triggers and row-level security policies.
-- Required after schema and function definitions; no phase patches.
BEGIN;
CREATE TRIGGER contact_import_enrich_profile AFTER INSERT ON connect.contact_import_details FOR EACH ROW EXECUTE FUNCTION connect.contact_import_enrich_profile();
CREATE TRIGGER connect_inquiry_initial_followup AFTER INSERT ON connect.inquiries FOR EACH ROW EXECUTE FUNCTION connect.automate_unqualified_inquiry();
CREATE TRIGGER connect_opportunity_automation AFTER INSERT ON connect.opportunities FOR EACH ROW EXECUTE FUNCTION connect.automate_new_opportunity();
CREATE TRIGGER guard_portal_enrollment_won BEFORE UPDATE ON connect.opportunities FOR EACH ROW EXECUTE FUNCTION connect.guard_portal_enrollment_won();
CREATE TRIGGER task_module_crm_source_sync AFTER UPDATE OF status ON connect.tasks FOR EACH ROW EXECUTE FUNCTION tasks.sync_imported_from_crm();
CREATE TRIGGER connect_tenant_default_categories AFTER INSERT ON connect.tenants FOR EACH ROW EXECUTE FUNCTION connect.initialize_enquiry_categories();
CREATE TRIGGER whatsapp_test_send_rate_guard BEFORE INSERT ON connect.whatsapp_send_requests FOR EACH ROW EXECUTE FUNCTION connect.whatsapp_send_test_rate_guard();
CREATE TRIGGER task_module_crm_status_sync AFTER UPDATE OF status ON tasks.items FOR EACH ROW EXECUTE FUNCTION tasks.sync_crm_task_status();
CREATE TRIGGER tasks_assignee_notifications AFTER UPDATE OF assignee_user_id ON tasks.items FOR EACH ROW EXECUTE FUNCTION tasks.notify_task_assignee();
CREATE TRIGGER tasks_prevent_module_link_sharing BEFORE UPDATE OF workspace_id ON tasks.items FOR EACH ROW EXECUTE FUNCTION tasks.prevent_module_link_sharing();
CREATE TRIGGER tasks_v2_inherit_recurring_context BEFORE INSERT ON tasks.items FOR EACH ROW EXECUTE FUNCTION tasks.v2_inherit_recurring_context();
CREATE POLICY "task_categories_delete" ON "tasks"."categories" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((( SELECT auth.uid() AS uid) = owner_user_id));
CREATE POLICY "task_categories_insert" ON "tasks"."categories" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((( SELECT auth.uid() AS uid) = owner_user_id));
CREATE POLICY "task_categories_select" ON "tasks"."categories" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((( SELECT auth.uid() AS uid) = owner_user_id));
CREATE POLICY "task_categories_update" ON "tasks"."categories" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((( SELECT auth.uid() AS uid) = owner_user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = owner_user_id));
CREATE POLICY "task_items_delete" ON "tasks"."items" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((( SELECT auth.uid() AS uid) = owner_user_id));
CREATE POLICY "task_items_insert" ON "tasks"."items" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((( SELECT auth.uid() AS uid) = owner_user_id) AND (( SELECT auth.uid() AS uid) = created_by_user_id)));
CREATE POLICY "task_items_select" ON "tasks"."items" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((( SELECT auth.uid() AS uid) = owner_user_id));
CREATE POLICY "task_items_update" ON "tasks"."items" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((( SELECT auth.uid() AS uid) = owner_user_id)) WITH CHECK (((( SELECT auth.uid() AS uid) = owner_user_id) AND (( SELECT auth.uid() AS uid) = created_by_user_id)));
CREATE POLICY "task_subtasks_delete" ON "tasks"."subtasks" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((( SELECT auth.uid() AS uid) = owner_user_id));
CREATE POLICY "task_subtasks_insert" ON "tasks"."subtasks" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((( SELECT auth.uid() AS uid) = owner_user_id) AND (EXISTS ( SELECT 1
   FROM tasks.items t
  WHERE ((t.id = subtasks.task_id) AND (t.owner_user_id = t.owner_user_id))))));
CREATE POLICY "task_subtasks_select" ON "tasks"."subtasks" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((( SELECT auth.uid() AS uid) = owner_user_id));
CREATE POLICY "task_subtasks_update" ON "tasks"."subtasks" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((( SELECT auth.uid() AS uid) = owner_user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = owner_user_id));
CREATE POLICY "task_preferences_insert" ON "tasks"."user_preferences" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "task_preferences_select" ON "tasks"."user_preferences" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "task_preferences_update" ON "tasks"."user_preferences" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));
-- Private module tables; no direct client grants.
DO $final_acl$ DECLARE t record; BEGIN FOR t IN SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('tasks','connect') AND c.relkind='r' LOOP EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',t.nspname,t.relname); EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM PUBLIC,anon,authenticated',t.nspname,t.relname); EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE %I.%I TO service_role',t.nspname,t.relname); END LOOP; END $final_acl$;
COMMIT;
