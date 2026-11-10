-- Phase 5: allow recurring tasks and reminders via shared V2 detail drawer.
-- Corrects the V2 detail-save JSONB field projection. Development only.
begin;
create or replace function public.task_v2_detail_save(
 p_actor_id uuid,p_task_id uuid,p_data jsonb
) returns jsonb
language plpgsql set search_path to '' as $$
declare legacy jsonb; extra jsonb; result jsonb; original tasks.items%rowtype;
begin
 if p_data is null or jsonb_typeof(p_data)<>'object' or p_data='{}'::jsonb then raise exception 'Invalid task details';end if;
 if exists(select 1 from jsonb_object_keys(p_data) k where k not in
  ('title','description','priority','scheduled_date','due_at','status','reminder_at','recurrence',
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

commit;
