-- Phase 5: importance and urgency are independent decisions for optional matrix.
begin;
alter table tasks.items add column if not exists urgent boolean not null default false;
create index if not exists task_v2_matrix_flags on tasks.items(owner_user_id,important,urgent) where archived_at is null and status<>'done';
create function public.task_v2_matrix_set(p_actor_id uuid,p_task_id uuid,p_important boolean,p_urgent boolean)
returns jsonb language plpgsql set search_path to '' as $$
declare result jsonb;
begin
 if p_important is null or p_urgent is null then raise exception 'Both decisions are required';end if;
 update tasks.items t set important=p_important,urgent=p_urgent,updated_at=now()
 where t.owner_user_id=p_actor_id and t.id=p_task_id and t.archived_at is null and t.status<>'done'
 returning to_jsonb(t) into result;
 return result;
end $$;
revoke all on function public.task_v2_matrix_set(uuid,uuid,boolean,boolean) from public,anon,authenticated;
grant execute on function public.task_v2_matrix_set(uuid,uuid,boolean,boolean) to service_role;
commit;