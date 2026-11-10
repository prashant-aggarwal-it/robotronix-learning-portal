-- My Tasks V2 Phase 2: atomic fast capture with optional area/project context.
-- Development project only. Existing task APIs and records are unchanged.
begin;
create function public.task_v2_capture(p_actor_id uuid,p_data jsonb) returns jsonb
language plpgsql set search_path to '' as $$
declare created jsonb; extras jsonb;
begin
 if p_actor_id is null or not exists(select 1 from auth.users where id=p_actor_id) then raise exception 'Invalid account'; end if;
 if p_data is null or jsonb_typeof(p_data)<>'object'
   or exists(select 1 from jsonb_object_keys(p_data) k where k not in
     ('title','description','priority','scheduled_date','due_at','category_id',
      'area_id','project_id','important','estimated_minutes'))
 then raise exception 'Invalid quick capture payload'; end if;
 if char_length(btrim(coalesce(p_data->>'title',''))) not between 1 and 240 then raise exception 'Task title required'; end if;
 created:=public.task_create(p_actor_id, p_data - 'area_id' - 'project_id' - 'important' - 'estimated_minutes');
 extras:=p_data - 'title' - 'description' - 'priority' - 'scheduled_date' - 'due_at' - 'category_id';
 if extras<>'{}'::jsonb then
   created:=public.task_v2_patch(p_actor_id,(created->>'id')::uuid,extras);
   if created is null then raise exception 'Unable to apply V2 task details'; end if;
 end if;
 return created;
end $$;
revoke all on function public.task_v2_capture(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.task_v2_capture(uuid,jsonb) to service_role;
commit;
