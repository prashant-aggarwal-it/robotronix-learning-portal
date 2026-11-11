-- Robotronix PRODUCTION INSTALL BUNDLE: 01 Tasks foundation and collaboration.
-- New tasks schema only. Run once in SQL Editor on the confirmed target project.
-- Must NOT be run on a database where schema tasks already exists.
-- Preserves existing public Portal tables and auth users.
BEGIN;
DO $guard$ BEGIN IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='tasks') THEN RAISE EXCEPTION 'tasks schema exists; refusing repeat installation'; END IF; END $guard$;

-- ===== SOURCE: database/tasks/01_foundation.sql =====
-- Universal My Tasks Phase 1. Apply ONLY to the confirmed Development project.
-- Private schema; Next.js service layer verifies the bearer token and scopes every query.

create schema if not exists tasks;
revoke all on schema tasks from public, anon, authenticated;
grant usage on schema tasks to service_role;

create table tasks.categories (
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (length(btrim(name)) between 1 and 80),
 color text not null default 'slate' check(color in ('slate','blue','green','amber','red','purple')),
 icon text not null default 'folder' check(length(icon) between 1 and 40),
 archived_at timestamptz,
 created_at timestamptz not null default now(),
 unique(owner_user_id,id)
);
create unique index task_categories_unique_active_name on tasks.categories(owner_user_id,lower(name)) where archived_at is null;

create table tasks.items (
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 created_by_user_id uuid not null references auth.users(id) on delete restrict,
 category_id uuid,
 title text not null check(length(btrim(title)) between 1 and 240),
 description text not null default '' check(length(description)<=12000),
 status text not null default 'todo' check(status in ('todo','in_progress','done')),
 priority text not null default 'medium' check(priority in ('low','medium','high')),
 scheduled_date date,
 due_at timestamptz,
 completed_at timestamptz,
 archived_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint task_completion_consistency check ((status='done')=(completed_at is not null)),
 constraint task_category_same_owner foreign key(owner_user_id,category_id) references tasks.categories(owner_user_id,id) on delete restrict
);
create index task_items_owner_status_date on tasks.items(owner_user_id,status,scheduled_date) where archived_at is null;
create index task_items_owner_due on tasks.items(owner_user_id,due_at) where archived_at is null;
create index task_items_owner_updated on tasks.items(owner_user_id,updated_at desc);

create table tasks.user_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 timezone text not null default 'Asia/Kolkata' check(length(timezone) between 1 and 80),
 week_starts_on smallint not null default 1 check(week_starts_on between 0 and 6),
 focus_limit smallint not null default 3 check(focus_limit between 1 and 10),
 updated_at timestamptz not null default now()
);

-- Dedicated personal-data RLS policies. Service-role access remains server-only.
alter table tasks.categories enable row level security;
alter table tasks.items enable row level security;
alter table tasks.user_preferences enable row level security;
create policy task_categories_select on tasks.categories for select to authenticated using ((select auth.uid())=owner_user_id);
create policy task_categories_insert on tasks.categories for insert to authenticated with check ((select auth.uid())=owner_user_id);
create policy task_categories_update on tasks.categories for update to authenticated using ((select auth.uid())=owner_user_id) with check ((select auth.uid())=owner_user_id);
create policy task_categories_delete on tasks.categories for delete to authenticated using ((select auth.uid())=owner_user_id);
create policy task_items_select on tasks.items for select to authenticated using ((select auth.uid())=owner_user_id);
create policy task_items_insert on tasks.items for insert to authenticated with check ((select auth.uid())=owner_user_id and (select auth.uid())=created_by_user_id);
create policy task_items_update on tasks.items for update to authenticated using ((select auth.uid())=owner_user_id) with check ((select auth.uid())=owner_user_id and (select auth.uid())=created_by_user_id);
create policy task_items_delete on tasks.items for delete to authenticated using ((select auth.uid())=owner_user_id);
create policy task_preferences_select on tasks.user_preferences for select to authenticated using ((select auth.uid())=user_id);
create policy task_preferences_insert on tasks.user_preferences for insert to authenticated with check ((select auth.uid())=user_id);
create policy task_preferences_update on tasks.user_preferences for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

-- Authenticated users have no direct schema access in Phase 1. Their RLS policies
-- provide defense in depth if a reviewed future release exposes the schema.
grant select,insert,update,delete on all tables in schema tasks to service_role;

-- Private schema access through narrow, service-role-only public RPCs.
-- The Next.js API authenticates the caller before supplying p_actor_id.
create function public.task_list(p_actor_id uuid,p_status text default null,p_limit integer default 50,p_offset integer default 0)
returns jsonb language sql security invoker set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(t) order by t.updated_at desc),'[]'::jsonb)
 from (select * from tasks.items where owner_user_id=p_actor_id and archived_at is null
  and (p_status is null or status=p_status) order by updated_at desc
  limit least(greatest(p_limit,1),100) offset least(greatest(p_offset,0),100000)) t;
$$;
create function public.task_create(p_actor_id uuid,p_data jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result tasks.items%rowtype;
begin
 insert into tasks.items(owner_user_id,created_by_user_id,title,description,status,priority,category_id,scheduled_date,due_at,completed_at)
 values(p_actor_id,p_actor_id,btrim(p_data->>'title'),coalesce(p_data->>'description',''),coalesce(p_data->>'status','todo'),coalesce(p_data->>'priority','medium'),
  nullif(p_data->>'category_id','')::uuid,nullif(p_data->>'scheduled_date','')::date,nullif(p_data->>'due_at','')::timestamptz,
  case when p_data->>'status'='done' then now() else null end)
 returning * into result;
 return to_jsonb(result);
end $$;
create function public.task_update(p_actor_id uuid,p_id uuid,p_data jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result tasks.items%rowtype;
begin
 update tasks.items t set
  title=case when p_data ? 'title' then btrim(p_data->>'title') else t.title end,
  description=case when p_data ? 'description' then p_data->>'description' else t.description end,
  status=coalesce(p_data->>'status',t.status),
  priority=coalesce(p_data->>'priority',t.priority),
  category_id=case when p_data ? 'category_id' then nullif(p_data->>'category_id','')::uuid else t.category_id end,
  scheduled_date=case when p_data ? 'scheduled_date' then nullif(p_data->>'scheduled_date','')::date else t.scheduled_date end,
  due_at=case when p_data ? 'due_at' then nullif(p_data->>'due_at','')::timestamptz else t.due_at end,
  completed_at=case when p_data->>'status'='done' and t.status<>'done' then now()
    when p_data->>'status' in ('todo','in_progress') then null else t.completed_at end,
  updated_at=now()
 where t.id=p_id and t.owner_user_id=p_actor_id and t.archived_at is null
 returning * into result;
 return case when result.id is null then null else to_jsonb(result) end;
end $$;
create function public.task_archive(p_actor_id uuid,p_id uuid)
returns boolean language sql security invoker set search_path='' as $$
 with changed as (update tasks.items set archived_at=now(),updated_at=now()
  where id=p_id and owner_user_id=p_actor_id and archived_at is null returning id)
 select exists(select 1 from changed);
$$;
create function public.task_categories_list(p_actor_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(c) order by c.name),'[]'::jsonb)
 from (select id,name,color,icon,created_at from tasks.categories
  where owner_user_id=p_actor_id and archived_at is null order by name) c;
$$;
create function public.task_category_create(p_actor_id uuid,p_name text,p_color text,p_icon text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result tasks.categories%rowtype;
begin
 insert into tasks.categories(owner_user_id,name,color,icon)
 values(p_actor_id,btrim(p_name),p_color,p_icon) returning * into result;
 return jsonb_build_object('id',result.id,'name',result.name,'color',result.color,'icon',result.icon,'created_at',result.created_at);
end $$;
revoke all on function public.task_list(uuid,text,integer,integer),public.task_create(uuid,jsonb),
 public.task_update(uuid,uuid,jsonb),public.task_archive(uuid,uuid),
 public.task_categories_list(uuid),public.task_category_create(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.task_list(uuid,text,integer,integer),public.task_create(uuid,jsonb),
 public.task_update(uuid,uuid,jsonb),public.task_archive(uuid,uuid),
 public.task_categories_list(uuid),public.task_category_create(uuid,text,text,text) to service_role;


-- ===== SOURCE: database/tasks/02_personal_workspace.sql =====
-- My Tasks Phase 2. Apply once to Development only, after 01_foundation.sql.

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


-- ===== SOURCE: database/tasks/03_preferences_categories.sql =====
-- Phase 2 refinements. Apply once after 02_personal_workspace.sql.

create function public.task_preferences_get(p_actor_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select coalesce((select to_jsonb(p) from tasks.user_preferences p where p.user_id=p_actor_id),
 jsonb_build_object('user_id',p_actor_id,'timezone',coalesce((select timezone from public.profiles where id=p_actor_id),'Asia/Kolkata'),'week_starts_on',1,'focus_limit',3));
$$;
create function public.task_preferences_save(p_actor_id uuid,p_timezone text,p_week_start smallint)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result tasks.user_preferences%rowtype;
begin
 insert into tasks.user_preferences(user_id,timezone,week_starts_on)
 values(p_actor_id,p_timezone,p_week_start)
 on conflict(user_id) do update set timezone=excluded.timezone,week_starts_on=excluded.week_starts_on,updated_at=now()
 returning * into result;
 return to_jsonb(result);
end $$;
create function public.task_category_update(p_actor_id uuid,p_id uuid,p_name text,p_color text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result tasks.categories%rowtype;
begin
 update tasks.categories set name=btrim(p_name),color=p_color where owner_user_id=p_actor_id and id=p_id and archived_at is null returning * into result;
 return case when result.id is null then null else to_jsonb(result) end;
end $$;
create function public.task_category_archive(p_actor_id uuid,p_id uuid)
returns boolean language sql security invoker set search_path='' as $$
 with changed as (update tasks.categories set archived_at=now() where owner_user_id=p_actor_id and id=p_id and archived_at is null returning id)
 select exists(select 1 from changed);
$$;
revoke all on function public.task_preferences_get(uuid),public.task_preferences_save(uuid,text,smallint),public.task_category_update(uuid,uuid,text,text),public.task_category_archive(uuid,uuid) from public,anon,authenticated;
grant execute on function public.task_preferences_get(uuid),public.task_preferences_save(uuid,text,smallint),public.task_category_update(uuid,uuid,text,text),public.task_category_archive(uuid,uuid) to service_role;


-- ===== SOURCE: database/tasks/04_collaboration_foundation.sql =====
-- Phase 3: private-by-default workspaces, invitations, assignments, comments, activity, attachments.
-- Apply once to Development, after 03_preferences_categories.sql.

create table tasks.workspaces (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(btrim(name)) between 2 and 100),
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 archived_at timestamptz
);
create table tasks.workspace_members (
 workspace_id uuid not null references tasks.workspaces(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check(role in ('owner','admin','member')),
 joined_at timestamptz not null default now(),
 primary key(workspace_id,user_id)
);
create index task_workspace_members_user on tasks.workspace_members(user_id,workspace_id);
create table tasks.workspace_invitations (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references tasks.workspaces(id) on delete cascade,
 email text not null check(length(btrim(email)) between 3 and 254),
 role text not null check(role in ('admin','member')),
 invited_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '14 days'),
 accepted_at timestamptz,
 revoked_at timestamptz
);
create unique index task_invite_pending on tasks.workspace_invitations(workspace_id,lower(email)) where accepted_at is null and revoked_at is null;

alter table tasks.items add column workspace_id uuid references tasks.workspaces(id) on delete restrict;
alter table tasks.items add column assignee_user_id uuid references auth.users(id) on delete set null;
alter table tasks.items add column share_with_workspace boolean not null default false;
create index task_items_workspace on tasks.items(workspace_id,status) where archived_at is null;
create index task_items_assignee on tasks.items(assignee_user_id,status) where archived_at is null;
alter table tasks.items add constraint task_assignment_workspace_required check(assignee_user_id is null or workspace_id is not null);
alter table tasks.items add constraint task_personal_not_workspace_visible check(workspace_id is not null or share_with_workspace=false);

create table tasks.task_collaborators (
 task_id uuid not null references tasks.items(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 permission text not null check(permission in ('view','edit')),
 granted_by uuid not null references auth.users(id),
 granted_at timestamptz not null default now(),
 primary key(task_id,user_id)
);
create index task_collaborators_user on tasks.task_collaborators(user_id,task_id);
create table tasks.comments (
 id uuid primary key default gen_random_uuid(),
 task_id uuid not null references tasks.items(id) on delete cascade,
 author_user_id uuid not null references auth.users(id) on delete restrict,
 body text not null check(length(btrim(body)) between 1 and 4000),
 created_at timestamptz not null default now(),
 edited_at timestamptz
);
create index task_comments_task_time on tasks.comments(task_id,created_at);
create table tasks.activity (
 id uuid primary key default gen_random_uuid(),
 task_id uuid not null references tasks.items(id) on delete cascade,
 actor_user_id uuid not null references auth.users(id) on delete restrict,
 action text not null check(length(action) between 1 and 60),
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index task_activity_task_time on tasks.activity(task_id,created_at desc);
create table tasks.attachments (
 id uuid primary key default gen_random_uuid(),
 task_id uuid not null references tasks.items(id) on delete cascade,
 uploaded_by uuid not null references auth.users(id) on delete restrict,
 storage_path text not null unique,
 file_name text not null check(length(file_name) between 1 and 250),
 mime_type text not null,
 byte_size integer not null check(byte_size between 1 and 10485760),
 created_at timestamptz not null default now()
);
create index task_attachments_task on tasks.attachments(task_id,created_at);

alter table tasks.workspaces enable row level security;
alter table tasks.workspace_members enable row level security;
alter table tasks.workspace_invitations enable row level security;
alter table tasks.task_collaborators enable row level security;
alter table tasks.comments enable row level security;
alter table tasks.activity enable row level security;
alter table tasks.attachments enable row level security;
grant select,insert,update,delete on tasks.workspaces,tasks.workspace_members,tasks.workspace_invitations,tasks.task_collaborators,tasks.comments,tasks.activity,tasks.attachments to service_role;

-- The private bucket has no end-user storage policies: uploads and signed downloads
-- go through server routes after explicit task-access checks.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('task-attachments','task-attachments',false,10485760,ARRAY['application/pdf','image/png','image/jpeg','image/webp','text/plain'])
 on conflict(id) do nothing;

-- Access is denied if the workspace membership was removed, even for prior assignees.
create function tasks.can_read(p_actor uuid,p_task uuid)
returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from tasks.items t where t.id=p_task and t.archived_at is null and (
  (t.workspace_id is null and t.owner_user_id=p_actor)
  or (t.workspace_id is not null and exists(select 1 from tasks.workspace_members m where m.workspace_id=t.workspace_id and m.user_id=p_actor)
   and (t.owner_user_id=p_actor or t.assignee_user_id=p_actor or t.share_with_workspace
    or exists(select 1 from tasks.task_collaborators c where c.task_id=t.id and c.user_id=p_actor)))))
$$;
create function tasks.can_edit(p_actor uuid,p_task uuid)
returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from tasks.items t where t.id=p_task and t.archived_at is null and (
  (t.workspace_id is null and t.owner_user_id=p_actor)
  or (t.workspace_id is not null and exists(select 1 from tasks.workspace_members m where m.workspace_id=t.workspace_id and m.user_id=p_actor)
   and (t.owner_user_id=p_actor or exists(select 1 from tasks.task_collaborators c where c.task_id=t.id and c.user_id=p_actor and c.permission='edit')))))
$$;
revoke all on function tasks.can_read(uuid,uuid),tasks.can_edit(uuid,uuid) from public,anon,authenticated;
grant execute on function tasks.can_read(uuid,uuid),tasks.can_edit(uuid,uuid) to service_role;

create function public.task_access_check(p_actor_id uuid,p_task_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select jsonb_build_object('read',tasks.can_read(p_actor_id,p_task_id),'edit',tasks.can_edit(p_actor_id,p_task_id),
 'owner',(select owner_user_id=p_actor_id from tasks.items where id=p_task_id));
$$;
create or replace function public.task_list(p_actor_id uuid,p_status text default null,p_limit integer default 50,p_offset integer default 0)
returns jsonb language sql security invoker set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(t) order by t.updated_at desc),'[]'::jsonb)
 from (select * from tasks.items t where t.archived_at is null
  and (t.owner_user_id=p_actor_id and t.workspace_id is null or tasks.can_read(p_actor_id,t.id))
  and (p_status is null or t.status=p_status) order by t.updated_at desc
  limit least(greatest(p_limit,1),100) offset least(greatest(p_offset,0),100000)) t;
$$;
create or replace function public.task_update(p_actor_id uuid,p_id uuid,p_data jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result tasks.items%rowtype; old tasks.items%rowtype; next_date date; next_due timestamptz; next_reminder timestamptz; days_between integer;
begin
 select * into old from tasks.items where id=p_id and archived_at is null for update;
 if old.id is null or not tasks.can_read(p_actor_id,p_id) then return null;end if;
 if not tasks.can_edit(p_actor_id,p_id) then
  if (select count(*) from jsonb_object_keys(p_data))<>1 or not(p_data ? 'status') or old.assignee_user_id<>p_actor_id then return null;end if;
 end if;
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
  completed_at=case when p_data->>'status'='done' and t.status<>'done' then now() when p_data->>'status' in ('todo','in_progress') then null else t.completed_at end,
  updated_at=now()
 where t.id=p_id returning * into result;
 if old.status<>result.status then insert into tasks.activity(task_id,actor_user_id,action,details) values(p_id,p_actor_id,'status_changed',jsonb_build_object('from',old.status,'to',result.status));end if;
 if old.status<>'done' and result.status='done' and result.recurrence<>'none' then
  next_date:=coalesce(result.scheduled_date,result.due_at::date,current_date);
  if result.recurrence='daily' then next_date:=next_date+1;elsif result.recurrence='weekly' then next_date:=next_date+7;
  else next_date:=(date_trunc('month',next_date::timestamp)+interval '1 month')::date;
   next_date:=next_date+least(coalesce(result.recurrence_anchor_day,1),extract(day from (date_trunc('month',next_date::timestamp)+interval '1 month - 1 day'))::int)::int-1;
  end if;
  days_between:=next_date-coalesce(result.scheduled_date,result.due_at::date,current_date);
  next_due:=case when result.due_at is null then null else result.due_at+make_interval(days=>days_between) end;
  next_reminder:=case when result.reminder_at is null then null else result.reminder_at+make_interval(days=>days_between) end;
  insert into tasks.items(owner_user_id,created_by_user_id,category_id,title,description,status,priority,scheduled_date,due_at,reminder_at,recurrence,recurrence_series_id,recurrence_anchor_day,workspace_id,assignee_user_id,share_with_workspace)
  values(result.owner_user_id,result.owner_user_id,result.category_id,result.title,result.description,'todo',result.priority,next_date,next_due,next_reminder,result.recurrence,result.recurrence_series_id,result.recurrence_anchor_day,result.workspace_id,result.assignee_user_id,result.share_with_workspace);
 end if;
 return to_jsonb(result);
end $$;

-- Grant only to the trusted server role; private schema never enters the Data API.
revoke all on function public.task_access_check(uuid,uuid) from public,anon,authenticated;
grant execute on function public.task_access_check(uuid,uuid) to service_role;


-- ===== SOURCE: database/tasks/05_collaboration_commands.sql =====
-- Phase 3 service-only commands. Depends on 04_collaboration_foundation.sql.

create function public.task_workspace_create(p_actor_id uuid,p_name text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare w tasks.workspaces%rowtype;
begin
 insert into tasks.workspaces(name,owner_user_id) values(btrim(p_name),p_actor_id) returning * into w;
 insert into tasks.workspace_members(workspace_id,user_id,role) values(w.id,p_actor_id,'owner');
 return to_jsonb(w);
end $$;
create function public.task_workspaces_list(p_actor_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(w) order by w.name),'[]'::jsonb)
 from (select w.id,w.name,m.role,w.created_at from tasks.workspaces w join tasks.workspace_members m on m.workspace_id=w.id and m.user_id=p_actor_id where w.archived_at is null) w;
$$;
create function public.task_workspace_members(p_actor_id uuid,p_workspace_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select case when exists(select 1 from tasks.workspace_members where workspace_id=p_workspace_id and user_id=p_actor_id)
 then coalesce((select jsonb_agg(to_jsonb(v) order by v.role,v.full_name) from (
  select m.user_id,m.role,coalesce(p.full_name,'Member') as full_name from tasks.workspace_members m
  left join public.profiles p on p.id=m.user_id where m.workspace_id=p_workspace_id) v),'[]'::jsonb) else '[]'::jsonb end;
$$;
create function public.task_invite_send(p_actor_id uuid,p_workspace_id uuid,p_email text,p_role text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare inv tasks.workspace_invitations%rowtype;
begin
 if not exists(select 1 from tasks.workspace_members where workspace_id=p_workspace_id and user_id=p_actor_id and role in ('owner','admin')) then raise exception 'Permission denied' using errcode='42501';end if;
 if p_role not in ('admin','member') or length(btrim(p_email)) not between 3 and 254 then raise exception 'Invalid invitation' using errcode='22023';end if;
 insert into tasks.workspace_invitations(workspace_id,email,role,invited_by)
 values(p_workspace_id,lower(btrim(p_email)),p_role,p_actor_id) returning * into inv;
 return jsonb_build_object('id',inv.id,'email',inv.email,'role',inv.role,'expires_at',inv.expires_at);
end $$;
create function public.task_invitations_list(p_actor_id uuid,p_verified_email text)
returns jsonb language sql security invoker set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(i) order by i.created_at desc),'[]'::jsonb) from (
  select x.id,x.workspace_id,w.name as workspace_name,x.role,x.created_at,x.expires_at
  from tasks.workspace_invitations x join tasks.workspaces w on w.id=x.workspace_id
  where lower(x.email)=lower(p_verified_email) and x.accepted_at is null and x.revoked_at is null and x.expires_at>now()
    and w.archived_at is null and not exists(select 1 from tasks.workspace_members m where m.workspace_id=x.workspace_id and m.user_id=p_actor_id)) i;
$$;
create function public.task_invite_accept(p_actor_id uuid,p_verified_email text,p_invitation_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare inv tasks.workspace_invitations%rowtype;
begin
 select * into inv from tasks.workspace_invitations where id=p_invitation_id and lower(email)=lower(p_verified_email)
  and accepted_at is null and revoked_at is null and expires_at>now() for update;
 if inv.id is null then raise exception 'Invitation unavailable' using errcode='42501';end if;
 if not exists(select 1 from tasks.workspaces where id=inv.workspace_id and archived_at is null) then raise exception 'Workspace unavailable' using errcode='42501';end if;
 insert into tasks.workspace_members(workspace_id,user_id,role) values(inv.workspace_id,p_actor_id,inv.role)
 on conflict(workspace_id,user_id) do nothing;
 update tasks.workspace_invitations set accepted_at=now() where id=inv.id;
 return jsonb_build_object('workspace_id',inv.workspace_id,'role',inv.role);
end $$;
create function public.task_workspace_member_manage(p_actor_id uuid,p_workspace_id uuid,p_member_id uuid,p_action text,p_role text default null)
returns boolean language plpgsql security invoker set search_path='' as $$
declare actor_role text;target_role text;
begin
 select role into actor_role from tasks.workspace_members where workspace_id=p_workspace_id and user_id=p_actor_id;
 select role into target_role from tasks.workspace_members where workspace_id=p_workspace_id and user_id=p_member_id;
 if actor_role not in ('owner','admin') or target_role is null or target_role='owner' or p_member_id=p_actor_id then return false;end if;
 if p_action='remove' then delete from tasks.workspace_members where workspace_id=p_workspace_id and user_id=p_member_id;return found;end if;
 if p_action='role' and actor_role='owner' and p_role in ('admin','member') then
  update tasks.workspace_members set role=p_role where workspace_id=p_workspace_id and user_id=p_member_id;return found;
 end if;
 return false;
end $$;

create function public.task_workspace_task_create(p_actor_id uuid,p_workspace_id uuid,p_data jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result tasks.items%rowtype;
begin
 if not exists(select 1 from tasks.workspace_members m join tasks.workspaces w on w.id=m.workspace_id where m.workspace_id=p_workspace_id and m.user_id=p_actor_id and w.archived_at is null) then raise exception 'Not a workspace member' using errcode='42501';end if;
 insert into tasks.items(owner_user_id,created_by_user_id,workspace_id,title,description,status,priority,scheduled_date,due_at,reminder_at,recurrence,recurrence_series_id,recurrence_anchor_day,share_with_workspace)
 values(p_actor_id,p_actor_id,p_workspace_id,btrim(p_data->>'title'),coalesce(p_data->>'description',''),'todo',coalesce(p_data->>'priority','medium'),nullif(p_data->>'scheduled_date','')::date,nullif(p_data->>'due_at','')::timestamptz,nullif(p_data->>'reminder_at','')::timestamptz,coalesce(p_data->>'recurrence','none'),case when coalesce(p_data->>'recurrence','none')<>'none' then gen_random_uuid() else null end,case when coalesce(p_data->>'recurrence','none')<>'none' then extract(day from coalesce(nullif(p_data->>'scheduled_date','')::date,current_date))::smallint else null end,coalesce((p_data->>'share_with_workspace')::boolean,false)) returning * into result;
 insert into tasks.activity(task_id,actor_user_id,action) values(result.id,p_actor_id,'created');
 return to_jsonb(result);
end $$;

create function public.task_share(p_actor_id uuid,p_task_id uuid,p_workspace_id uuid,p_assignee_id uuid,p_workspace_visible boolean)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare task tasks.items%rowtype;
begin
 select * into task from tasks.items where id=p_task_id and owner_user_id=p_actor_id and archived_at is null for update;
 if task.id is null then raise exception 'Not owner' using errcode='42501';end if;
 if task.workspace_id is not null and task.workspace_id<>p_workspace_id then raise exception 'Cannot move shared task between workspaces' using errcode='42501';end if;
 if p_workspace_id is null and task.workspace_id is not null then raise exception 'Cannot convert shared task back to personal' using errcode='42501';end if;
 if p_workspace_id is not null and not exists(select 1 from tasks.workspace_members where workspace_id=p_workspace_id and user_id=p_actor_id) then raise exception 'Not a member' using errcode='42501';end if;
 if p_assignee_id is not null and (p_workspace_id is null or not exists(select 1 from tasks.workspace_members where workspace_id=p_workspace_id and user_id=p_assignee_id)) then raise exception 'Assignee must be a workspace member' using errcode='42501';end if;
 update tasks.items set workspace_id=p_workspace_id,assignee_user_id=p_assignee_id,share_with_workspace=coalesce(p_workspace_visible,false),updated_at=now()
 where id=p_task_id returning * into task;
 insert into tasks.activity(task_id,actor_user_id,action,details) values(p_task_id,p_actor_id,'sharing_changed',jsonb_build_object('workspace_id',p_workspace_id,'assignee_id',p_assignee_id,'workspace_visible',p_workspace_visible));
 if p_assignee_id is not null and p_assignee_id<>p_actor_id then
  insert into public.portal_notifications(recipient_role,recipient_profile_id,type,priority,title,message,href,dedupe_key)
  select p.role,p_assignee_id,'task_assigned','info','New task assigned','A task was assigned to you.','/tasks/assigned','task-assigned:'||p_task_id::text||':'||extract(epoch from now())::bigint::text
  from public.profiles p where p.id=p_assignee_id and p.active=true;
 end if;
 return to_jsonb(task);
end $$;
create function public.task_collaborator_manage(p_actor_id uuid,p_task_id uuid,p_user_id uuid,p_permission text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare w uuid;
begin
 select workspace_id into w from tasks.items where id=p_task_id and owner_user_id=p_actor_id and archived_at is null;
 if w is null or p_user_id=p_actor_id then return false;end if;
 if p_permission is null then delete from tasks.task_collaborators where task_id=p_task_id and user_id=p_user_id;return found;end if;
 if p_permission not in ('view','edit') or not exists(select 1 from tasks.workspace_members where workspace_id=w and user_id=p_user_id) then return false;end if;
 insert into tasks.task_collaborators(task_id,user_id,permission,granted_by) values(p_task_id,p_user_id,p_permission,p_actor_id)
 on conflict(task_id,user_id) do update set permission=excluded.permission,granted_by=excluded.granted_by,granted_at=now();
 return true;
end $$;
create function public.task_collaborators_list(p_actor_id uuid,p_task_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select case when tasks.can_read(p_actor_id,p_task_id) then coalesce((select jsonb_agg(to_jsonb(v)) from (
  select c.user_id,c.permission,coalesce(p.full_name,'Member') as full_name from tasks.task_collaborators c left join public.profiles p on p.id=c.user_id where c.task_id=p_task_id) v),'[]'::jsonb) else '[]'::jsonb end;
$$;

create function public.task_comments_list(p_actor_id uuid,p_task_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select case when tasks.can_read(p_actor_id,p_task_id) then coalesce((select jsonb_agg(to_jsonb(v) order by v.created_at) from (
  select c.id,c.body,c.created_at,c.edited_at,c.author_user_id,coalesce(p.full_name,'Member') as author_name
  from tasks.comments c left join public.profiles p on p.id=c.author_user_id where c.task_id=p_task_id order by c.created_at) v),'[]'::jsonb) else '[]'::jsonb end;
$$;
create function public.task_comment_add(p_actor_id uuid,p_task_id uuid,p_body text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare comment tasks.comments%rowtype;
begin
 if not tasks.can_read(p_actor_id,p_task_id) then raise exception 'Not authorized' using errcode='42501';end if;
 insert into tasks.comments(task_id,author_user_id,body) values(p_task_id,p_actor_id,btrim(p_body)) returning * into comment;
 insert into tasks.activity(task_id,actor_user_id,action) values(p_task_id,p_actor_id,'commented');
 return to_jsonb(comment);
end $$;
create function public.task_activity_list(p_actor_id uuid,p_task_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select case when tasks.can_read(p_actor_id,p_task_id) then coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from (
  select id,actor_user_id,action,details,created_at from tasks.activity where task_id=p_task_id order by created_at desc limit 100) a),'[]'::jsonb) else '[]'::jsonb end;
$$;

create function public.task_attachments_list(p_actor_id uuid,p_task_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select case when tasks.can_read(p_actor_id,p_task_id) then coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from (
  select id,file_name,mime_type,byte_size,uploaded_by,created_at from tasks.attachments where task_id=p_task_id) a),'[]'::jsonb) else '[]'::jsonb end;
$$;
create function public.task_attachment_add(p_actor_id uuid,p_task_id uuid,p_path text,p_name text,p_mime text,p_size integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare file tasks.attachments%rowtype;
begin
 if not tasks.can_read(p_actor_id,p_task_id) then raise exception 'Not authorized' using errcode='42501';end if;
 insert into tasks.attachments(task_id,uploaded_by,storage_path,file_name,mime_type,byte_size)
 values(p_task_id,p_actor_id,p_path,p_name,p_mime,p_size) returning * into file;
 insert into tasks.activity(task_id,actor_user_id,action,details) values(p_task_id,p_actor_id,'attachment_added',jsonb_build_object('file_name',p_name));
 return jsonb_build_object('id',file.id,'file_name',file.file_name,'byte_size',file.byte_size);
end $$;
create function public.task_attachment_lookup(p_actor_id uuid,p_task_id uuid,p_attachment_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select case when tasks.can_read(p_actor_id,p_task_id) then (select to_jsonb(a) from (
  select id,storage_path,file_name,mime_type,byte_size,uploaded_by from tasks.attachments where id=p_attachment_id and task_id=p_task_id) a) else null end;
$$;
create function public.task_attachment_remove(p_actor_id uuid,p_task_id uuid,p_attachment_id uuid)
returns text language plpgsql security invoker set search_path='' as $$
declare path text;
begin
 if not tasks.can_read(p_actor_id,p_task_id) then return null;end if;
 delete from tasks.attachments where id=p_attachment_id and task_id=p_task_id and (uploaded_by=p_actor_id or exists(select 1 from tasks.items where id=p_task_id and owner_user_id=p_actor_id)) returning storage_path into path;
 if path is not null then insert into tasks.activity(task_id,actor_user_id,action) values(p_task_id,p_actor_id,'attachment_removed');end if;
 return path;
end $$;

revoke all on function public.task_workspace_create(uuid,text),public.task_workspaces_list(uuid),public.task_workspace_members(uuid,uuid),
 public.task_invite_send(uuid,uuid,text,text),public.task_invitations_list(uuid,text),public.task_invite_accept(uuid,text,uuid),
 public.task_workspace_member_manage(uuid,uuid,uuid,text,text),public.task_workspace_task_create(uuid,uuid,jsonb),
 public.task_share(uuid,uuid,uuid,uuid,boolean),public.task_collaborator_manage(uuid,uuid,uuid,text),public.task_collaborators_list(uuid,uuid),
 public.task_comments_list(uuid,uuid),public.task_comment_add(uuid,uuid,text),public.task_activity_list(uuid,uuid),
 public.task_attachments_list(uuid,uuid),public.task_attachment_add(uuid,uuid,text,text,text,integer),
 public.task_attachment_lookup(uuid,uuid,uuid),public.task_attachment_remove(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.task_workspace_create(uuid,text),public.task_workspaces_list(uuid),public.task_workspace_members(uuid,uuid),
 public.task_invite_send(uuid,uuid,text,text),public.task_invitations_list(uuid,text),public.task_invite_accept(uuid,text,uuid),
 public.task_workspace_member_manage(uuid,uuid,uuid,text,text),public.task_workspace_task_create(uuid,uuid,jsonb),
 public.task_share(uuid,uuid,uuid,uuid,boolean),public.task_collaborator_manage(uuid,uuid,uuid,text),public.task_collaborators_list(uuid,uuid),
 public.task_comments_list(uuid,uuid),public.task_comment_add(uuid,uuid,text),public.task_activity_list(uuid,uuid),
 public.task_attachments_list(uuid,uuid),public.task_attachment_add(uuid,uuid,text,text,text,integer),
 public.task_attachment_lookup(uuid,uuid,uuid),public.task_attachment_remove(uuid,uuid,uuid) to service_role;


-- ===== SOURCE: database/tasks/06_shared_subtasks.sql =====
-- Phase 3: subtasks follow the effective task permissions.

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


-- ===== SOURCE: database/tasks/07_module_integrations.sql =====
-- Phase 4: explicit, per-user module links. No automatic CRM migration.
-- Apply to the Development project after 06_shared_subtasks.sql.

create table if not exists tasks.module_links (
 id uuid primary key default gen_random_uuid(),
 task_id uuid not null references tasks.items(id) on delete cascade,
 owner_user_id uuid not null references auth.users(id),
 module text not null check(module in ('connect','learning')),
 resource text not null check(resource in ('crm_task','crm_person','crm_opportunity','schedule_event')),
 tenant_id uuid,
 resource_id uuid not null,
 created_at timestamptz not null default now(),
 last_synced_at timestamptz,
 check ((module='connect' and resource in ('crm_task','crm_person','crm_opportunity') and tenant_id is not null)
   or (module='learning' and resource='schedule_event' and tenant_id is null)),
 unique(owner_user_id,module,resource,tenant_id,resource_id)
);
create unique index if not exists tasks_one_module_link_per_task on tasks.module_links(task_id);
create unique index if not exists tasks_module_link_unique_source on tasks.module_links(owner_user_id,module,resource,coalesce(tenant_id,'00000000-0000-0000-0000-000000000000'::uuid),resource_id);
create index if not exists tasks_module_link_lookup on tasks.module_links(module,tenant_id,resource,resource_id);
alter table tasks.module_links enable row level security;
revoke all on tasks.module_links from public,anon,authenticated;
grant select,insert,update,delete on tasks.module_links to service_role;

-- Context-linked personal tasks may not be delegated to users who lack access
-- to the original module. They must remain personal in v1.
create or replace function tasks.prevent_module_link_sharing() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.workspace_id is distinct from old.workspace_id and new.workspace_id is not null
  and exists(select 1 from tasks.module_links l where l.task_id=old.id) then
  raise exception 'Linked module tasks must remain personal' using errcode='42501';
 end if;
 return new;
end $$;
drop trigger if exists tasks_prevent_module_link_sharing on tasks.items;
create trigger tasks_prevent_module_link_sharing before update of workspace_id on tasks.items
 for each row execute function tasks.prevent_module_link_sharing();

-- A verified personal profile is required before module content can be connected.
-- Connect requires an active tenant membership. Learning requires admin status or
-- the trainer assigned to that particular schedule event.
create or replace function public.task_module_link(p_actor_id uuid,p_module text,p_resource text,p_resource_id uuid,p_tenant_id uuid default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
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
end $$;

create or replace function public.task_module_links_list(p_actor_id uuid,p_module text default null,p_tenant_id uuid default null)
returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('task_id',l.task_id,'module',l.module,'resource',l.resource,
   'resource_id',l.resource_id,'tenant_id',l.tenant_id,'title',t.title,'status',t.status,'due_at',t.due_at)
   order by t.updated_at desc),'[]'::jsonb)
 from tasks.module_links l join tasks.items t on t.id=l.task_id
 where l.owner_user_id=p_actor_id and t.archived_at is null and t.workspace_id is null
  and (p_module is null or l.module=p_module) and (p_tenant_id is null or l.tenant_id=p_tenant_id)
  and (l.module<>'connect' or exists(select 1 from connect.memberships m where m.tenant_id=l.tenant_id and m.user_id=p_actor_id and m.status='active'))
  and (l.module<>'learning' or exists(select 1 from public.profiles p where p.id=p_actor_id and p.active=true and p.role='admin')
    or exists(select 1 from public.schedule_events e join public.trainers tr on tr.id=e.trainer_id where e.id=l.resource_id and tr.profile_id=p_actor_id and tr.record_status='active'));
$$;

-- CRM tasks already use their own workflows: only explicit imported links sync,
-- and only while the importing actor still has an active CRM membership.
create or replace function tasks.sync_crm_task_status() returns trigger language plpgsql security invoker set search_path='' as $$
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
end $$;
drop trigger if exists task_module_crm_status_sync on tasks.items;
create trigger task_module_crm_status_sync after update of status on tasks.items
 for each row execute function tasks.sync_crm_task_status();

-- Legacy CRM completes independently; reflect completion only for explicitly
-- imported tasks (no automatic wholesale migration or task creation).
create or replace function tasks.sync_imported_from_crm() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.status is distinct from old.status and new.status in ('done','open') then
  update tasks.items t set status=case when new.status='done' then 'done' else 'todo' end,
   completed_at=case when new.status='done' then now() else null end,updated_at=now()
  from tasks.module_links l join connect.memberships m on m.tenant_id=l.tenant_id and m.user_id=l.owner_user_id and m.status='active'
  where l.task_id=t.id and l.module='connect' and l.resource='crm_task' and l.resource_id=new.id and l.tenant_id=new.tenant_id
   and t.archived_at is null and t.status<>case when new.status='done' then 'done' else 'todo' end;
 end if;
 return new;
end $$;
drop trigger if exists task_module_crm_source_sync on connect.tasks;
create trigger task_module_crm_source_sync after update of status on connect.tasks
 for each row execute function tasks.sync_imported_from_crm();

revoke all on function public.task_module_link(uuid,text,text,uuid,uuid),public.task_module_links_list(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.task_module_link(uuid,text,text,uuid,uuid),public.task_module_links_list(uuid,text,uuid) to service_role;


-- ===== SOURCE: database/tasks/08_saas_readiness.sql =====
-- Phase 5: task-only accounts and atomic, user-scoped imports.
-- Apply only to Development after 07_module_integrations.sql.

create table if not exists tasks.accounts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '' check(length(display_name)<=100),
 status text not null default 'active' check(status in ('active','suspended')),
 plan text not null default 'free' check(plan in ('free')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table tasks.accounts enable row level security;
revoke all on tasks.accounts from public,anon,authenticated;
grant select,insert,update on tasks.accounts to service_role;

create or replace function public.task_account_get(p_actor_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
 select (select to_jsonb(a) from tasks.accounts a where a.user_id=p_actor_id);
$$;

create or replace function public.task_account_activate(p_actor_id uuid,p_display_name text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result tasks.accounts%rowtype;
begin
 if length(btrim(p_display_name))>100 then raise exception 'Display name too long' using errcode='22023';end if;
 insert into tasks.accounts(user_id,display_name) values(p_actor_id,btrim(p_display_name))
 on conflict(user_id) do update set display_name=excluded.display_name,updated_at=now()
 where tasks.accounts.status='active'
 returning * into result;
 if result.user_id is null then raise exception 'Account is suspended' using errcode='42501';end if;
 insert into tasks.user_preferences(user_id) values(p_actor_id) on conflict do nothing;
 return to_jsonb(result);
end $$;

create or replace function public.task_bulk_import(p_actor_id uuid,p_rows jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare row_data jsonb; imported int:=0; title_text text; due_text text; date_text text; status_text text; priority_text text;
begin
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)<1 or jsonb_array_length(p_rows)>200 then
  raise exception 'Import supports 1 to 200 rows' using errcode='22023';end if;
 if (select count(*) from tasks.items where owner_user_id=p_actor_id and archived_at is null)+jsonb_array_length(p_rows)>10000 then
  raise exception 'Active task limit reached' using errcode='22023';end if;
 for row_data in select value from jsonb_array_elements(p_rows) loop
  title_text:=btrim(coalesce(row_data->>'title',''));
  status_text:=coalesce(row_data->>'status','todo');
  priority_text:=coalesce(row_data->>'priority','medium');
  due_text:=nullif(row_data->>'due_at','');
  date_text:=nullif(row_data->>'scheduled_date','');
  if length(title_text) not between 1 and 240 or length(coalesce(row_data->>'description',''))>12000
    or status_text not in ('todo','in_progress','done') or priority_text not in ('low','medium','high') then
   raise exception 'Invalid task row' using errcode='22023';end if;
  insert into tasks.items(owner_user_id,created_by_user_id,title,description,status,priority,scheduled_date,due_at,completed_at)
   values(p_actor_id,p_actor_id,title_text,coalesce(row_data->>'description',''),status_text,priority_text,
   date_text::date,due_text::timestamptz,case when status_text='done' then now() else null end);
  imported:=imported+1;
 end loop;
 return jsonb_build_object('imported',imported);
end $$;

create or replace function public.task_account_metrics(p_actor_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
  'personal_tasks',(select count(*) from tasks.items where owner_user_id=p_actor_id and workspace_id is null and archived_at is null),
  'open_tasks',(select count(*) from tasks.items where owner_user_id=p_actor_id and archived_at is null and status<>'done'),
  'workspaces',(select count(*) from tasks.workspace_members m where m.user_id=p_actor_id),
  'linked_records',(select count(*) from tasks.module_links where owner_user_id=p_actor_id),
  'account',(select to_jsonb(a) from tasks.accounts a where a.user_id=p_actor_id));
$$;

revoke all on function public.task_account_get(uuid),public.task_account_activate(uuid,text),
 public.task_bulk_import(uuid,jsonb),public.task_account_metrics(uuid) from public,anon,authenticated;
grant execute on function public.task_account_get(uuid),public.task_account_activate(uuid,text),
 public.task_bulk_import(uuid,jsonb),public.task_account_metrics(uuid) to service_role;


-- ===== SOURCE: database/tasks/09_saas_notifications.sql =====
-- Phase 5 extension: reminders and assignments for task-only accounts.
-- Keep the Portal notification path unchanged for existing role-based users.

create table tasks.notifications (
 id uuid primary key default gen_random_uuid(),
 recipient_user_id uuid not null references auth.users(id) on delete cascade,
 task_id uuid references tasks.items(id) on delete set null,
 kind text not null check(kind in ('reminder','assignment')),
 title text not null check(length(title) between 1 and 240),
 href text not null default '/tasks',
 dedupe_key text not null,
 created_at timestamptz not null default now(),
 read_at timestamptz,
 unique(recipient_user_id,dedupe_key)
);
create index tasks_notifications_unread on tasks.notifications(recipient_user_id,created_at desc) where read_at is null;
alter table tasks.notifications enable row level security;
revoke all on tasks.notifications from public,anon,authenticated;
grant select,insert,update,delete on tasks.notifications to service_role;

create function public.task_notifications_list(p_actor_id uuid,p_limit integer default 30)
returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(n) order by n.created_at desc),'[]'::jsonb)
 from (select id,kind,title,href,created_at,read_at from tasks.notifications
  where recipient_user_id=p_actor_id order by created_at desc limit least(greatest(p_limit,1),100)) n;
$$;
create function public.task_notification_read(p_actor_id uuid,p_id uuid)
returns boolean language sql security invoker set search_path='' as $$
 with changed as (update tasks.notifications set read_at=coalesce(read_at,now())
 where id=p_id and recipient_user_id=p_actor_id returning id) select exists(select 1 from changed);
$$;

-- Every user receives a private task notification. Existing Portal users still
-- receive their established portal_notifications entry from task_share.
create function tasks.notify_task_assignee() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.assignee_user_id is not null and new.assignee_user_id is distinct from old.assignee_user_id
  and exists(select 1 from tasks.workspace_members where workspace_id=new.workspace_id and user_id=new.assignee_user_id) then
  insert into tasks.notifications(recipient_user_id,task_id,kind,title,href,dedupe_key)
   values(new.assignee_user_id,new.id,'assignment','A new task was assigned to you','/tasks/assigned?task='||new.id,
    'assignment:'||new.id::text||':'||new.assignee_user_id::text)
   on conflict(recipient_user_id,dedupe_key) do update set read_at=null,created_at=now();
 end if;
 return new;
end $$;
create trigger tasks_assignee_notifications after update of assignee_user_id on tasks.items
 for each row execute function tasks.notify_task_assignee();

create or replace function public.task_reminder_process(p_limit integer default 100)
returns integer language plpgsql security invoker set search_path='' as $$
declare rec record; processed integer:=0;
begin
 for rec in select t.id,t.owner_user_id,t.title,t.reminder_at from tasks.items t
  where t.reminder_at<=now() and t.reminder_at>now()-interval '30 days' and t.status<>'done' and t.archived_at is null
  and not exists(select 1 from tasks.reminder_deliveries d where d.task_id=t.id and d.reminder_at=t.reminder_at)
  order by t.reminder_at limit least(greatest(p_limit,1),500) for update skip locked
 loop
  -- Only consume a reminder for an existing active account; avoid silently marking
  -- reminders delivered to users with neither an account nor an active profile.
  if exists(select 1 from tasks.accounts a where a.user_id=rec.owner_user_id and a.status='active')
   or exists(select 1 from public.profiles p where p.id=rec.owner_user_id and p.active=true) then
   insert into tasks.reminder_deliveries(task_id,reminder_at) values(rec.id,rec.reminder_at) on conflict do nothing;
   if found then
    insert into tasks.notifications(recipient_user_id,task_id,kind,title,href,dedupe_key)
     values(rec.owner_user_id,rec.id,'reminder','Reminder: '||left(rec.title,220),'/tasks/all?task='||rec.id,
      'reminder:'||rec.id::text||':'||extract(epoch from rec.reminder_at)::bigint)
     on conflict(recipient_user_id,dedupe_key) do nothing;
    insert into public.portal_notifications(recipient_role,recipient_profile_id,type,priority,title,message,href,dedupe_key)
     select p.role,rec.owner_user_id,'task_reminder','info','Task reminder',left(rec.title,240),'/tasks?task='||rec.id::text,
      'task:'||rec.id::text||':'||extract(epoch from rec.reminder_at)::bigint
     from public.profiles p where p.id=rec.owner_user_id and p.active=true;
    processed:=processed+1;
   end if;
  end if;
 end loop;
 return processed;
end $$;

revoke all on function public.task_notifications_list(uuid,integer),public.task_notification_read(uuid,uuid) from public,anon,authenticated;
grant execute on function public.task_notifications_list(uuid,integer),public.task_notification_read(uuid,uuid) to service_role;

COMMIT;
