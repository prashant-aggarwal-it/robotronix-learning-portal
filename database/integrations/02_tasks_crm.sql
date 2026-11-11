-- Optional Tasks + CRM integration: install ONLY when both schemas exist.
-- Preserves the existing CRM task linking and bidirectional status sync contracts.
BEGIN;
DO $gate$ BEGIN IF to_regnamespace('tasks') IS NULL OR to_regnamespace('connect') IS NULL THEN RAISE EXCEPTION 'Tasks and Connect CRM must both be installed'; END IF; END $gate$;
-- public.task_module_link(p_actor_id uuid, p_module text, p_resource text, p_resource_id uuid, p_tenant_id uuid)
CREATE OR REPLACE FUNCTION public.task_module_link(p_actor_id uuid, p_module text, p_resource text, p_resource_id uuid, p_tenant_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_title text;v_due timestamptz;v_status text:='todo';v_task uuid;v_existing uuid;v_membership connect.memberships%rowtype;
begin
 if not exists(select 1 from public.profiles where id=p_actor_id and active=true) then raise exception 'Inactive profile' using errcode='42501';end if;
 if p_module='connect' and p_resource in ('crm_task','crm_person','crm_opportunity') and p_tenant_id is not null then
  select * into v_membership from connect.memberships where tenant_id=p_tenant_id and user_id=p_actor_id and status='active';
  if v_membership.id is null then raise exception 'Connect membership required' using errcode='42501';end if;
  if p_resource='crm_task' then
   select t.title,t.due_at,case when t.status='done' then 'done' else 'todo' end
     into v_title,v_due,v_status from connect.tasks t where t.tenant_id=p_tenant_id and t.id=p_resource_id
      and (t.assignee_membership_id=v_membership.id or v_membership.role in ('owner','admin','manager'));
  elsif p_resource='crm_person' then
   select 'Follow up: '||p.full_name into v_title from connect.people p
    where p.tenant_id=p_tenant_id and p.id=p_resource_id and p.status='active';
  else
   select 'Follow up: '||o.title into v_title from connect.opportunities o
    where o.tenant_id=p_tenant_id and o.id=p_resource_id;
  end if;
 elsif p_module='learning' and p_resource='schedule_event' and p_tenant_id is null then
  select 'Review class: '||e.title into v_title from public.schedule_events e
   where e.id=p_resource_id and (exists(select 1 from public.profiles p where p.id=p_actor_id and p.active=true and p.role='admin')
    or exists(select 1 from public.trainers tr where tr.id=e.trainer_id and tr.profile_id=p_actor_id and tr.record_status='active'));
  select (e.date::timestamp + e.end_time) at time zone e.timezone into v_due
   from public.schedule_events e where e.id=p_resource_id and v_title is not null;
 else raise exception 'Invalid module link' using errcode='22023';end if;
 if v_title is null then raise exception 'Record unavailable' using errcode='42501';end if;
 select l.task_id into v_existing from tasks.module_links l where l.owner_user_id=p_actor_id and l.module=p_module
   and l.resource=p_resource and l.resource_id=p_resource_id and l.tenant_id is not distinct from p_tenant_id;
 if v_existing is not null then return jsonb_build_object('task_id',v_existing,'created',false);end if;
 insert into tasks.items(owner_user_id,created_by_user_id,title,status,priority,due_at,completed_at)
  values(p_actor_id,p_actor_id,left(v_title,240),v_status,'medium',v_due,case when v_status='done' then now() else null end)
  returning id into v_task;
 insert into tasks.module_links(task_id,owner_user_id,module,resource,resource_id,tenant_id)
  values(v_task,p_actor_id,p_module,p_resource,p_resource_id,p_tenant_id);
 insert into tasks.activity(task_id,actor_user_id,action,details) values(v_task,p_actor_id,'module_linked',jsonb_build_object('module',p_module,'resource',p_resource));
 return jsonb_build_object('task_id',v_task,'created',true);
end $function$;

-- public.task_module_links_list(p_actor_id uuid, p_module text, p_tenant_id uuid)
CREATE OR REPLACE FUNCTION public.task_module_links_list(p_actor_id uuid, p_module text DEFAULT NULL::text, p_tenant_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 select coalesce(jsonb_agg(jsonb_build_object('task_id',l.task_id,'module',l.module,'resource',l.resource,
   'resource_id',l.resource_id,'tenant_id',l.tenant_id,'title',t.title,'status',t.status,'due_at',t.due_at)
   order by t.updated_at desc),'[]'::jsonb)
 from tasks.module_links l join tasks.items t on t.id=l.task_id
 where l.owner_user_id=p_actor_id and t.archived_at is null and t.workspace_id is null
  and (p_module is null or l.module=p_module) and (p_tenant_id is null or l.tenant_id=p_tenant_id)
  and (l.module<>'connect' or exists(select 1 from connect.memberships m where m.tenant_id=l.tenant_id and m.user_id=p_actor_id and m.status='active'))
  and (l.module<>'learning' or exists(select 1 from public.profiles p where p.id=p_actor_id and p.active=true and p.role='admin')
    or exists(select 1 from public.schedule_events e join public.trainers tr on tr.id=e.trainer_id where e.id=l.resource_id and tr.profile_id=p_actor_id and tr.record_status='active'));
$function$;

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
DO $acl$ DECLARE f record; BEGIN FOR f IN SELECT oid FROM pg_proc WHERE proname IN ('task_module_link','task_module_links_list','sync_crm_task_status','sync_imported_from_crm') LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.oid::regprocedure); EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.oid::regprocedure); END LOOP; END $acl$;
COMMIT;
