-- Optional Tasks + CRM integration: install ONLY when both schemas exist.
-- Shared CRM+Tasks status synchronization; link RPCs are selected separately for CRM+Tasks vs full suite.
BEGIN;
DO $gate$ BEGIN IF to_regnamespace('tasks') IS NULL OR to_regnamespace('connect') IS NULL THEN RAISE EXCEPTION 'Tasks and Connect CRM must both be installed'; END IF; END $gate$;
-- tasks.sync_crm_task_status()
CREATE OR REPLACE FUNCTION tasks.sync_crm_task_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if new.status is distinct from old.status then
  update connect.tasks c set status=case when new.status='done' then 'done' else 'open' end,
   completed_at=case when new.status='done' then coalesce(c.completed_at,now()) else null end
  from tasks.module_links l join connect.memberships m on m.tenant_id=l.tenant_id and m.user_id=l.owner_user_id and m.status='active'
  where l.task_id=new.id and l.module='connect' and l.resource='crm_task' and c.tenant_id=l.tenant_id and c.id=l.resource_id
   and m.role in ('owner','admin','manager','counsellor')
   and (c.assignee_membership_id=m.id or m.role in ('owner','admin','manager')) and c.status<>'cancelled';
  update tasks.module_links set last_synced_at=now() where task_id=new.id and module='connect' and resource='crm_task';
 end if;
 return new;
end $function$;

-- tasks.sync_imported_from_crm()
CREATE OR REPLACE FUNCTION tasks.sync_imported_from_crm()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if new.status is distinct from old.status and new.status in ('done','open') then
  update tasks.items t set status=case when new.status='done' then 'done' else 'todo' end,
   completed_at=case when new.status='done' then now() else null end,updated_at=now()
  from tasks.module_links l join connect.memberships m on m.tenant_id=l.tenant_id and m.user_id=l.owner_user_id and m.status='active'
  where l.task_id=t.id and l.module='connect' and l.resource='crm_task' and l.resource_id=new.id and l.tenant_id=new.tenant_id
   and t.archived_at is null and t.status<>case when new.status='done' then 'done' else 'todo' end;
 end if;
 return new;
end $function$;


CREATE TRIGGER task_module_crm_source_sync AFTER UPDATE OF status ON connect.tasks FOR EACH ROW EXECUTE FUNCTION tasks.sync_imported_from_crm();
CREATE TRIGGER task_module_crm_status_sync AFTER UPDATE OF status ON tasks.items FOR EACH ROW EXECUTE FUNCTION tasks.sync_crm_task_status();
DO $acl$ DECLARE f record; BEGIN FOR f IN SELECT oid FROM pg_proc WHERE proname IN ('sync_crm_task_status','sync_imported_from_crm') LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.oid::regprocedure); EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.oid::regprocedure); END LOOP; END $acl$;
COMMIT;
