-- My Tasks 2.0 Phase 3: board cards with checklist progress in one paginated query.
-- Development only. Existing task_list and task APIs remain unchanged.
begin;
create function public.task_v2_board_list(p_actor_id uuid,p_limit integer default 250,p_offset integer default 0)
returns jsonb language sql set search_path to '' as $$
 select coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object('subtask_total',counts.total,'subtask_done',counts.completed)
   order by t.status,t.board_rank,t.created_at,t.id),'[]'::jsonb)
 from (
  select * from tasks.items i
  where i.archived_at is null and ((i.owner_user_id=p_actor_id and i.workspace_id is null)
   or tasks.can_read(p_actor_id,i.id))
  order by i.created_at,i.id
  limit least(greatest(p_limit,1),250) offset least(greatest(p_offset,0),20000)
 ) t
 cross join lateral (
  select count(*)::integer total,count(*) filter(where s.done)::integer completed
  from tasks.subtasks s where s.task_id=t.id
 ) counts;
$$;
revoke all on function public.task_v2_board_list(uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.task_v2_board_list(uuid,integer,integer) to service_role;
commit;