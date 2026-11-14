-- OPTIONAL Tasks → Learning Portal notification bridge.
-- Install only when Tasks and Portal notification tables are present.
-- Tasks remains fully usable without a Portal deployment.
BEGIN;
DO $preflight$ BEGIN
 IF to_regclass('tasks.notifications') IS NULL OR to_regclass('public.portal_notifications') IS NULL OR to_regclass('public.profiles') IS NULL
 THEN RAISE EXCEPTION 'Tasks + Learning Portal notification tables required'; END IF;
END $preflight$;
CREATE FUNCTION tasks.forward_notification_to_portal() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path TO '' AS $fn$
BEGIN
 INSERT INTO public.portal_notifications(recipient_role,recipient_profile_id,type,priority,title,message,href,dedupe_key)
 SELECT p.role, NEW.recipient_user_id,
  CASE WHEN NEW.kind='assignment' THEN 'task_assigned' ELSE 'task_reminder' END,
  'info',CASE WHEN NEW.kind='assignment' THEN 'New task assigned' ELSE 'Task reminder' END,
  CASE WHEN NEW.kind='assignment' THEN 'A task was assigned to you.' ELSE left(NEW.title,240) END,
  NEW.href, 'taskbridge:'||NEW.dedupe_key
 FROM public.profiles p WHERE p.id=NEW.recipient_user_id AND p.active=true;
 RETURN NEW;
END $fn$;
CREATE TRIGGER tasks_portal_notification_bridge
AFTER INSERT ON tasks.notifications FOR EACH ROW
EXECUTE FUNCTION tasks.forward_notification_to_portal();
REVOKE ALL ON FUNCTION tasks.forward_notification_to_portal() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION tasks.forward_notification_to_portal() TO service_role;
COMMIT;
