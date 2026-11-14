-- FINAL Portal + Tasks link package, with no CRM dependency.
-- Use instead of 03/05; install after both product cores and 04.
BEGIN;
DO $gate$ BEGIN
 IF to_regclass('tasks.accounts') IS NULL OR to_regclass('tasks.module_links') IS NULL
 OR to_regclass('public.profiles') IS NULL OR to_regclass('public.schedule_events') IS NULL
 OR to_regclass('public.trainers') IS NULL THEN
  RAISE EXCEPTION 'Portal + Tasks installation required';
 END IF;
 IF to_regprocedure('public.task_module_link(uuid,text,text,uuid,uuid)') IS NOT NULL
 OR to_regprocedure('public.task_module_links_list(uuid,text,uuid)') IS NOT NULL THEN
  RAISE EXCEPTION 'A task link implementation already exists; install exactly one customer package';
 END IF;
END $gate$;

CREATE FUNCTION public.task_module_link(p_actor_id uuid,p_module text,p_resource text,p_resource_id uuid,p_tenant_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path TO '' AS $fn$
DECLARE v_title text;v_due timestamptz;v_task uuid;v_existing uuid;
BEGIN
 IF p_module<>'learning' OR p_resource<>'schedule_event' OR p_tenant_id IS NOT NULL THEN
  RAISE EXCEPTION 'Unsupported module link' USING errcode='22023';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM tasks.accounts WHERE user_id=p_actor_id AND status='active') THEN
  RAISE EXCEPTION 'Inactive Tasks account' USING errcode='42501';
 END IF;
 SELECT 'Review class: '||e.title,(e.date::timestamp+e.end_time) AT TIME ZONE e.timezone
 INTO v_title,v_due FROM public.schedule_events e
 WHERE e.id=p_resource_id AND (EXISTS(SELECT 1 FROM public.profiles p
    WHERE p.id=p_actor_id AND p.active=true AND p.role='admin')
  OR EXISTS(SELECT 1 FROM public.trainers tr WHERE tr.id=e.trainer_id
    AND tr.profile_id=p_actor_id AND tr.record_status='active'));
 IF v_title IS NULL THEN RAISE EXCEPTION 'Record unavailable' USING errcode='42501';END IF;
 -- Serialize concurrent requests for this source; the unique module-link index is
 -- the final backstop. No second task is created for an already linked class.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  p_actor_id::text||':learning:schedule_event:'||p_resource_id::text,0));
 SELECT l.task_id INTO v_existing FROM tasks.module_links l WHERE l.owner_user_id=p_actor_id
 AND l.module='learning' AND l.resource='schedule_event' AND l.resource_id=p_resource_id;
 IF v_existing IS NOT NULL THEN RETURN jsonb_build_object('task_id',v_existing,'created',false);END IF;
 INSERT INTO tasks.items(owner_user_id,created_by_user_id,title,status,priority,due_at)
 VALUES(p_actor_id,p_actor_id,left(v_title,240),'todo','medium',v_due) RETURNING id INTO v_task;
 INSERT INTO tasks.module_links(task_id,owner_user_id,module,resource,resource_id,tenant_id)
 VALUES(v_task,p_actor_id,'learning','schedule_event',p_resource_id,NULL);
 INSERT INTO tasks.activity(task_id,actor_user_id,action,details)
 VALUES(v_task,p_actor_id,'module_linked',jsonb_build_object('module','learning','resource','schedule_event'));
 RETURN jsonb_build_object('task_id',v_task,'created',true);
END $fn$;

CREATE FUNCTION public.task_module_links_list(p_actor_id uuid,p_module text DEFAULT NULL,p_tenant_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO '' AS $fn$
 SELECT coalesce(jsonb_agg(jsonb_build_object('task_id',l.task_id,'module',l.module,
  'resource',l.resource,'resource_id',l.resource_id,'tenant_id',l.tenant_id,
  'title',t.title,'status',t.status,'due_at',t.due_at) ORDER BY t.updated_at DESC),'[]'::jsonb)
 FROM tasks.module_links l JOIN tasks.items t ON t.id=l.task_id
 WHERE l.owner_user_id=p_actor_id AND t.archived_at IS NULL AND t.workspace_id IS NULL
 AND l.module='learning' AND (p_module IS NULL OR p_module='learning') AND p_tenant_id IS NULL
 AND (EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=p_actor_id AND p.active=true AND p.role='admin')
  OR EXISTS(SELECT 1 FROM public.schedule_events e JOIN public.trainers tr ON tr.id=e.trainer_id
   WHERE e.id=l.resource_id AND tr.profile_id=p_actor_id AND tr.record_status='active'));
$fn$;
REVOKE ALL ON FUNCTION public.task_module_link(uuid,text,text,uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.task_module_links_list(uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.task_module_link(uuid,text,text,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.task_module_links_list(uuid,text,uuid) TO service_role;
COMMIT;
