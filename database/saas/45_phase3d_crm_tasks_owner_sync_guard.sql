-- Phase 3D optional CRM + Tasks upgrade on existing integrated installs.
-- Independent CRM-only or Tasks-only installs must NOT execute this package.
DO $preflight$ BEGIN
 IF to_regclass('connect.tasks') IS NULL OR to_regclass('tasks.module_links') IS NULL
 OR to_regprocedure('tasks.sync_imported_from_crm()') IS NULL THEN
  RAISE EXCEPTION 'CRM + Tasks integration is not installed';
 END IF;
END $preflight$;
CREATE OR REPLACE FUNCTION tasks.sync_imported_from_crm()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $function$
BEGIN
 IF new.status IS DISTINCT FROM old.status AND new.status IN ('done','open') THEN
  UPDATE tasks.items t
   SET status=CASE WHEN new.status='done' THEN 'done' ELSE 'todo' END,
       completed_at=CASE WHEN new.status='done' THEN now() ELSE null END,
       updated_at=now()
  FROM tasks.module_links l
  JOIN connect.memberships m ON m.tenant_id=l.tenant_id AND m.user_id=l.owner_user_id AND m.status='active'
  WHERE l.task_id=t.id AND t.owner_user_id=l.owner_user_id
    AND l.module='connect' AND l.resource='crm_task'
    AND l.resource_id=new.id AND l.tenant_id=new.tenant_id AND t.archived_at IS NULL
    AND t.status<>CASE WHEN new.status='done' THEN 'done' ELSE 'todo' END;
 END IF;
 RETURN new;
END $function$;
REVOKE ALL ON FUNCTION tasks.sync_imported_from_crm() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION tasks.sync_imported_from_crm() TO service_role;
