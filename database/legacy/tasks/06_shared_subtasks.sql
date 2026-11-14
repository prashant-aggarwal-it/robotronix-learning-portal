-- Phase 3: subtasks follow the effective task permissions.
begin;
create or replace function public.task_subtasks_list(p_actor_id uuid,p_task_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select case when tasks.can_read(p_actor_id,p_task_id) then coalesce((select jsonb_agg(to_jsonb(s) order by s.sort_order,s.created_at) from (
  select id,task_id,title,done,sort_order,created_at from tasks.subtasks where task_id=p_task_id) s),'[]'::jsonb) else '[]'::jsonb end;
$$;
create or replace function public.task_subtask_save(p_actor_id uuid,p_task_id uuid,p_id uuid,p_title text,p_done boolean)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result tasks.subtasks%rowtype;assignee uuid;
begin
 if not tasks.can_read(p_actor_id,p_task_id) then return null;end if;
 select assignee_user_id into assignee from tasks.items where id=p_task_id;
 if not tasks.can_edit(p_actor_id,p_task_id) and assignee is distinct from p_actor_id then return null;end if;
 if p_id is null then
  insert into tasks.subtasks(task_id,owner_user_id,title,done)
  select p_task_id,t.owner_user_id,btrim(p_title),coalesce(p_done,false) from tasks.items t where t.id=p_task_id
  returning * into result;
 else
  update tasks.subtasks set title=btrim(p_title),done=coalesce(p_done,false)
  where id=p_id and task_id=p_task_id returning * into result;
 end if;
 return case when result.id is null then null else to_jsonb(result) end;
end $$;
create or replace function public.task_subtask_delete(p_actor_id uuid,p_task_id uuid,p_id uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
declare assignee uuid;
begin
 if not tasks.can_read(p_actor_id,p_task_id) then return false;end if;
 select assignee_user_id into assignee from tasks.items where id=p_task_id;
 if not tasks.can_edit(p_actor_id,p_task_id) and assignee is distinct from p_actor_id then return false;end if;
 delete from tasks.subtasks where id=p_id and task_id=p_task_id;
 return found;
end $$;
commit;
