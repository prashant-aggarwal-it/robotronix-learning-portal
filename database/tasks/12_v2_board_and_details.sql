-- My Tasks 2.0 Phase 3 — transactional board moves and a single safe detail update.
-- Only apply to Development project fflejkqcspivnhsmkdtn.
begin;

-- Existing rows have default rank 0; assign deterministic board order only to
-- those untouched records, without changing statuses, dates or activity timestamps.
with ordered as (
 select id, row_number() over(partition by owner_user_id,status order by created_at,id)::numeric * 1024 as rank
 from tasks.items where board_rank=0 and archived_at is null
)
update tasks.items t set board_rank=o.rank from ordered o where t.id=o.id;

create function public.task_v2_board_move(
 p_actor_id uuid, p_task_id uuid, p_status text,
 p_group_by text default 'status', p_group_id uuid default null,
 p_position integer default 0
) returns jsonb
language plpgsql set search_path to '' as $$
declare
 v tasks.items%rowtype; result jsonb;
 target_project tasks.projects%rowtype;
 ids uuid[]; ordered_ids uuid[]; n integer; pos integer;
begin
 if p_status not in ('todo','in_progress','waiting','done') then raise exception 'Invalid board status';end if;
 if p_group_by not in ('status','area','project') then raise exception 'Invalid board grouping';end if;
 if p_position < 0 or p_position > 10000 then raise exception 'Invalid board position';end if;
 -- Protect against concurrent reorders from this owner.
 perform pg_advisory_xact_lock(hashtextextended('tasks-v2-board:'||p_actor_id::text,0));
 select * into v from tasks.items where id=p_task_id and archived_at is null for update;
 if v.id is null or v.owner_user_id<>p_actor_id then return null;end if;

 if p_group_by='area' then
  if p_group_id is not null and not exists(
   select 1 from tasks.areas a where a.id=p_group_id and a.owner_user_id=p_actor_id and a.archived_at is null
  ) then raise exception 'Invalid destination area';end if;
  -- Moving between areas clears a mismatched project instead of retaining a contradictory association.
  result:=public.task_v2_patch(p_actor_id,p_task_id,
   jsonb_build_object('area_id',p_group_id,'project_id',
     case when v.project_id is not null and exists(
       select 1 from tasks.projects p where p.id=v.project_id and p.owner_user_id=p_actor_id
        and (p.area_id is null or p.area_id=p_group_id)
     ) then v.project_id else null end));
 elsif p_group_by='project' then
  if p_group_id is not null then
   select * into target_project from tasks.projects
    where id=p_group_id and owner_user_id=p_actor_id and archived_at is null;
   if target_project.id is null then raise exception 'Invalid destination project';end if;
  end if;
  result:=public.task_v2_patch(p_actor_id,p_task_id,
   jsonb_build_object('project_id',p_group_id,'area_id',
      case when p_group_id is null then v.area_id else coalesce(target_project.area_id,v.area_id) end));
 end if;

 if p_status is distinct from v.status then
  if p_status='waiting' then
   if v.status='done' then
    result:=public.task_update(p_actor_id,p_task_id,'{"status":"todo"}'::jsonb);
   end if;
   result:=public.task_v2_patch(p_actor_id,p_task_id,'{"status":"waiting"}'::jsonb);
  else
   result:=public.task_update(p_actor_id,p_task_id,jsonb_build_object('status',p_status));
  end if;
  if result is null then return null;end if;
 end if;

 select coalesce(array_agg(t.id order by t.board_rank,t.created_at,t.id),'{}'::uuid[]) into ids
 from tasks.items t where t.owner_user_id=p_actor_id and t.archived_at is null
  and t.status=p_status and t.id<>p_task_id
  and (p_group_by='status'
   or (p_group_by='area' and t.area_id is not distinct from p_group_id)
   or (p_group_by='project' and t.project_id is not distinct from p_group_id));
 n:=coalesce(array_length(ids,1),0);
 pos:=least(p_position,n);
 ordered_ids:=coalesce(ids[1:pos],'{}'::uuid[]) ||
   array[p_task_id]::uuid[] ||
   coalesce(ids[pos+1:n],'{}'::uuid[]);
 -- All ordering updates are atomic and do not modify the legacy "updated_at" chronology.
 update tasks.items t set board_rank=x.ordinal::numeric*1024
 from unnest(ordered_ids) with ordinality as x(id,ordinal)
 where t.id=x.id and t.owner_user_id=p_actor_id;
 select to_jsonb(t) into result from tasks.items t where t.id=p_task_id;
 return result;
end $$;

create function public.task_v2_detail_save(
 p_actor_id uuid,p_task_id uuid,p_data jsonb
) returns jsonb
language plpgsql set search_path to '' as $$
declare legacy jsonb; extra jsonb; result jsonb; original tasks.items%rowtype;
begin
 if p_data is null or jsonb_typeof(p_data)<>'object' or p_data='{}'::jsonb then raise exception 'Invalid task details';end if;
 if exists(select 1 from jsonb_object_keys(p_data) k where k not in
  ('title','description','priority','scheduled_date','due_at','status',
   'area_id','project_id','important','estimated_minutes','done_definition',
   'resume_note','waiting_for','followup_date')) then raise exception 'Unsupported task field';end if;
 select * into original from tasks.items where id=p_task_id and owner_user_id=p_actor_id and archived_at is null for update;
 if original.id is null then return null;end if;
 legacy:=p_data - 'area_id' - 'project_id' - 'important' - 'estimated_minutes' - 'done_definition' - 'resume_note' - 'waiting_for' - 'followup_date';
 extra:=p_data - 'title' - 'description' - 'priority' - 'scheduled_date' - 'due_at' - 'status';
 if p_data ? 'status' and p_data->>'status'='waiting' then
  if original.status='done' then
   perform public.task_update(p_actor_id,p_task_id,'{"status":"todo"}'::jsonb);
  end if;
  perform public.task_v2_patch(p_actor_id,p_task_id,'{"status":"waiting"}'::jsonb);
  legacy:=legacy-'status';
 end if;
 if legacy<>'{}'::jsonb then
  result:=public.task_update(p_actor_id,p_task_id,legacy);
  if result is null then return null;end if;
 end if;
 if extra<>'{}'::jsonb then
  result:=public.task_v2_patch(p_actor_id,p_task_id,extra);
  if result is null then return null;end if;
 end if;
 select to_jsonb(t) into result from tasks.items t where t.id=p_task_id;
 return result;
end $$;

revoke all on function public.task_v2_board_move(uuid,uuid,text,text,uuid,integer),
 public.task_v2_detail_save(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.task_v2_board_move(uuid,uuid,text,text,uuid,integer),
 public.task_v2_detail_save(uuid,uuid,jsonb) to service_role;
commit;
