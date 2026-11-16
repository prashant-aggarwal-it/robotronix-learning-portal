-- Phase 5 post-apply correction: Someday removes current Top 3 focus. Development only.
begin;
create or replace function public.task_v2_plan_move(p_actor_id uuid,p_task_ids uuid[],p_action text,p_date date default null)
returns jsonb language plpgsql set search_path to '' as $$
declare expected_count integer; updated_count integer; result jsonb;
begin
 if p_actor_id is null or p_task_ids is null or cardinality(p_task_ids)<1 or cardinality(p_task_ids)>50
  or exists(select 1 from unnest(p_task_ids) t where t is null)
  or (select count(distinct t) from unnest(p_task_ids) t)<>cardinality(p_task_ids)
 then raise exception 'Invalid batch of task IDs';end if;
 if p_action not in ('plan','unschedule','someday') then raise exception 'Invalid plan action';end if;
 if (p_action='plan' and p_date is null) or (p_action<>'plan' and p_date is not null) then
  raise exception 'Date required only when planning';end if;
 perform pg_advisory_xact_lock(hashtextextended('tasks-v2-plan:'||p_actor_id::text,0));
 expected_count:=cardinality(p_task_ids);
 if (select count(*) from tasks.items i where i.id=any(p_task_ids) and i.owner_user_id=p_actor_id
   and i.archived_at is null and i.status<>'done')<>expected_count then
  raise exception 'One or more tasks are unavailable or completed';end if;
 update tasks.items i set
  scheduled_date=case when p_action='plan' then p_date else null end,
  someday=p_action='someday',
  focus_date=case when p_action='someday' then null else i.focus_date end,
  focus_rank=case when p_action='someday' then null else i.focus_rank end,
  reschedule_count=case when p_action='plan' and i.scheduled_date is distinct from p_date
       and i.scheduled_date is not null then least(1000000,i.reschedule_count+1) else i.reschedule_count end,
  updated_at=now()
 where i.id=any(p_task_ids) and i.owner_user_id=p_actor_id;
 get diagnostics updated_count=row_count;
 if updated_count<>expected_count then raise exception 'Plan update incomplete';end if;
 select jsonb_agg(to_jsonb(i) order by i.id) into result from tasks.items i where i.id=any(p_task_ids);
 return coalesce(result,'[]'::jsonb);
end $$;

commit;
