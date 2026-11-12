-- My Tasks Phase 2. Apply once to Development only, after 01_foundation.sql.
begin;
alter table tasks.items add column focus_date date;
alter table tasks.items add column focus_rank smallint check(focus_rank between 1 and 3);
alter table tasks.items add column reminder_at timestamptz;
alter table tasks.items add column recurrence text not null default 'none' check(recurrence in ('none','daily','weekly','monthly'));
alter table tasks.items add column recurrence_series_id uuid;
alter table tasks.items add column recurrence_anchor_day smallint check(recurrence_anchor_day between 1 and 31);
create unique index tasks_focus_order on tasks.items(owner_user_id,focus_date,focus_rank) where focus_rank is not null and archived_at is null and status<>'done';
create index tasks_due_reminder on tasks.items(reminder_at) where reminder_at is not null and status<>'done' and archived_at is null;

create table tasks.subtasks (
 id uuid primary key default gen_random_uuid(),
 task_id uuid not null references tasks.items(id) on delete cascade,
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(length(btrim(title)) between 1 and 240),
 done boolean not null default false,
 sort_order integer not null default 0,
 created_at timestamptz not null default now(),
 unique(task_id,id)
);
create index tasks_subtask_parent on tasks.subtasks(task_id,sort_order);
alter table tasks.subtasks enable row level security;
create policy task_subtasks_select on tasks.subtasks for select to authenticated using ((select auth.uid())=owner_user_id);
create policy task_subtasks_insert on tasks.subtasks for insert to authenticated with check ((select auth.uid())=owner_user_id and exists(select 1 from tasks.items t where t.id=task_id and t.owner_user_id=owner_user_id));
create policy task_subtasks_update on tasks.subtasks for update to authenticated using ((select auth.uid())=owner_user_id) with check ((select auth.uid())=owner_user_id);
create policy task_subtasks_delete on tasks.subtasks for delete to authenticated using ((select auth.uid())=owner_user_id);
grant select,insert,update,delete on tasks.subtasks to service_role;

create table tasks.reminder_deliveries (
 task_id uuid not null references tasks.items(id) on delete cascade,
 reminder_at timestamptz not null,
 delivered_at timestamptz not null default now(),
 primary key(task_id,reminder_at)
);
alter table tasks.reminder_deliveries enable row level security;
grant select,insert,update,delete on tasks.reminder_deliveries to service_role;

create or replace function public.task_create(p_actor_id uuid,p_data jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result tasks.items%rowtype;
begin
 insert into tasks.items(owner_user_id,created_by_user_id,title,description,status,priority,category_id,scheduled_date,due_at,completed_at,focus_date,focus_rank,reminder_at,recurrence,recurrence_series_id,recurrence_anchor_day)
 values(p_actor_id,p_actor_id,btrim(p_data->>'title'),coalesce(p_data->>'description',''),coalesce(p_data->>'status','todo'),coalesce(p_data->>'priority','medium'),
  nullif(p_data->>'category_id','')::uuid,nullif(p_data->>'scheduled_date','')::date,nullif(p_data->>'due_at','')::timestamptz,
  case when p_data->>'status'='done' then now() else null end,
  nullif(p_data->>'focus_date','')::date,nullif(p_data->>'focus_rank','')::smallint,nullif(p_data->>'reminder_at','')::timestamptz,
  coalesce(p_data->>'recurrence','none'),
  case when coalesce(p_data->>'recurrence','none')<>'none' then gen_random_uuid() else null end,
  case when coalesce(p_data->>'recurrence','none')<>'none' then extract(day from coalesce(nullif(p_data->>'scheduled_date','')::date,(nullif(p_data->>'due_at','')::timestamptz)::date,current_date))::smallint else null end)
 returning * into result;
 return to_jsonb(result);
end $$;

create or replace function public.task_update(p_actor_id uuid,p_id uuid,p_data jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result tasks.items%rowtype; old tasks.items%rowtype; next_date date; next_due timestamptz; next_reminder timestamptz; days_between integer;
begin
 select * into old from tasks.items where id=p_id and owner_user_id=p_actor_id and archived_at is null for update;
 if old.id is null then return null; end if;
 update tasks.items t set
  title=case when p_data ? 'title' then btrim(p_data->>'title') else t.title end,
  description=case when p_data ? 'description' then p_data->>'description' else t.description end,
  status=coalesce(p_data->>'status',t.status),priority=coalesce(p_data->>'priority',t.priority),
  category_id=case when p_data ? 'category_id' then nullif(p_data->>'category_id','')::uuid else t.category_id end,
  scheduled_date=case when p_data ? 'scheduled_date' then nullif(p_data->>'scheduled_date','')::date else t.scheduled_date end,
  due_at=case when p_data ? 'due_at' then nullif(p_data->>'due_at','')::timestamptz else t.due_at end,
  focus_date=case when p_data ? 'focus_date' then nullif(p_data->>'focus_date','')::date else t.focus_date end,
  focus_rank=case when p_data ? 'focus_rank' then nullif(p_data->>'focus_rank','')::smallint else t.focus_rank end,
  reminder_at=case when p_data ? 'reminder_at' then nullif(p_data->>'reminder_at','')::timestamptz else t.reminder_at end,
  recurrence=coalesce(p_data->>'recurrence',t.recurrence),
  recurrence_series_id=case when p_data->>'recurrence'='none' then null when p_data->>'recurrence' in ('daily','weekly','monthly') then coalesce(t.recurrence_series_id,gen_random_uuid()) else t.recurrence_series_id end,
  recurrence_anchor_day=case when p_data->>'recurrence'='none' then null when p_data->>'recurrence' in ('daily','weekly','monthly') then coalesce(t.recurrence_anchor_day,extract(day from coalesce(t.scheduled_date,t.due_at::date,current_date))::smallint) else t.recurrence_anchor_day end,
  completed_at=case when p_data->>'status'='done' and t.status<>'done' then now()
    when p_data->>'status' in ('todo','in_progress') then null else t.completed_at end,
  updated_at=now()
 where t.id=p_id and t.owner_user_id=p_actor_id and t.archived_at is null returning * into result;
 if old.status<>'done' and result.status='done' and result.recurrence<>'none' then
  next_date:=coalesce(result.scheduled_date,result.due_at::date,current_date);
  if result.recurrence='daily' then next_date:=next_date+1;
  elsif result.recurrence='weekly' then next_date:=next_date+7;
  else
   next_date:=(date_trunc('month',next_date::timestamp)+interval '1 month')::date;
   next_date:=next_date+least(coalesce(result.recurrence_anchor_day,1),extract(day from (date_trunc('month',next_date::timestamp)+interval '1 month - 1 day'))::int)::int-1;
  end if;
  days_between:=next_date-coalesce(result.scheduled_date,result.due_at::date,current_date);
  next_due:=case when result.due_at is null then null else result.due_at+make_interval(days=>days_between) end;
  next_reminder:=case when result.reminder_at is null then null else result.reminder_at+make_interval(days=>days_between) end;
  insert into tasks.items(owner_user_id,created_by_user_id,category_id,title,description,status,priority,scheduled_date,due_at,reminder_at,recurrence,recurrence_series_id,recurrence_anchor_day)
  values(p_actor_id,p_actor_id,result.category_id,result.title,result.description,'todo',result.priority,next_date,next_due,next_reminder,result.recurrence,result.recurrence_series_id,result.recurrence_anchor_day);
 end if;
 return to_jsonb(result);
end $$;

create function public.task_subtasks_list(p_actor_id uuid,p_task_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(s) order by s.sort_order,s.created_at),'[]'::jsonb)
 from (select s.id,s.task_id,s.title,s.done,s.sort_order,s.created_at from tasks.subtasks s
 join tasks.items t on t.id=s.task_id and t.owner_user_id=p_actor_id and t.archived_at is null
 where s.task_id=p_task_id and s.owner_user_id=p_actor_id) s;
$$;
create function public.task_subtask_save(p_actor_id uuid,p_task_id uuid,p_id uuid,p_title text,p_done boolean)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result tasks.subtasks%rowtype;
begin
 if not exists(select 1 from tasks.items where id=p_task_id and owner_user_id=p_actor_id and archived_at is null) then return null; end if;
 if p_id is null then
  insert into tasks.subtasks(task_id,owner_user_id,title,done) values(p_task_id,p_actor_id,btrim(p_title),coalesce(p_done,false)) returning * into result;
 else
  update tasks.subtasks set title=btrim(p_title),done=coalesce(p_done,false)
  where id=p_id and task_id=p_task_id and owner_user_id=p_actor_id returning * into result;
 end if;
 return case when result.id is null then null else to_jsonb(result) end;
end $$;
create function public.task_subtask_delete(p_actor_id uuid,p_task_id uuid,p_id uuid)
returns boolean language sql security invoker set search_path='' as $$
 with deleted as (delete from tasks.subtasks where id=p_id and task_id=p_task_id and owner_user_id=p_actor_id returning id)
 select exists(select 1 from deleted);
$$;

create function public.task_reminder_process(p_limit integer default 100)
returns integer language plpgsql security invoker set search_path='' as $$
declare rec record; inserted_count integer:=0;
begin
 for rec in select t.id,t.owner_user_id,t.title,t.reminder_at from tasks.items t
  where t.reminder_at<=now() and t.reminder_at>now()-interval '30 days' and t.status<>'done' and t.archived_at is null
  and not exists(select 1 from tasks.reminder_deliveries d where d.task_id=t.id and d.reminder_at=t.reminder_at)
  order by t.reminder_at limit least(greatest(p_limit,1),500) for update skip locked
 loop
  insert into tasks.reminder_deliveries(task_id,reminder_at) values(rec.id,rec.reminder_at) on conflict do nothing;
  if found then
   insert into public.portal_notifications(recipient_role,recipient_profile_id,type,priority,title,message,href,dedupe_key)
   select p.role,rec.owner_user_id,'task_reminder','info','Task reminder',left(rec.title,240),'/tasks?task='||rec.id::text,'task:'||rec.id::text||':'||extract(epoch from rec.reminder_at)::bigint
   from public.profiles p where p.id=rec.owner_user_id and p.active=true;
   inserted_count:=inserted_count+1;
  end if;
 end loop;
 return inserted_count;
end $$;

revoke all on function public.task_subtasks_list(uuid,uuid),public.task_subtask_save(uuid,uuid,uuid,text,boolean),public.task_subtask_delete(uuid,uuid,uuid),public.task_reminder_process(integer) from public,anon,authenticated;
grant execute on function public.task_subtasks_list(uuid,uuid),public.task_subtask_save(uuid,uuid,uuid,text,boolean),public.task_subtask_delete(uuid,uuid,uuid),public.task_reminder_process(integer) to service_role;
commit;
