-- Robotronix PRODUCTION INSTALL BUNDLE: 02 Tasks V2 dashboard, board, focus, planner, recurrence.
-- Run once AFTER 01_tasks_foundation.sql. Fresh tasks installation only.
-- Fixes service_role 'permission denied for table auth.users' in task_v2_capture.
-- Server verifies bearer token and active user before invoking service-only RPC.
BEGIN;
DO $guard$ BEGIN IF to_regclass('tasks.items') IS NULL THEN RAISE EXCEPTION 'Tasks foundation missing'; END IF; IF to_regclass('tasks.areas') IS NOT NULL THEN RAISE EXCEPTION 'Tasks V2 already exists; refusing replay'; END IF; END $guard$;

-- ===== SOURCE: database/tasks/10_v2_foundation.sql =====
-- Universal My Tasks V2 / Phase 1: additive private data model.
-- Apply only to Development: fflejkqcspivnhsmkdtn. No existing records are migrated or deleted.

create table tasks.areas (
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (char_length(btrim(name)) between 1 and 80),
 color text not null default 'blue' check (color in ('slate','blue','green','amber','red','purple')),
 icon text not null default 'folder' check (char_length(icon) between 1 and 40),
 sort_order integer not null default 0,
 archived_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(owner_user_id,id)
);
create unique index task_v2_area_active_name on tasks.areas (owner_user_id,lower(name)) where archived_at is null;
create index task_v2_area_owner_sort on tasks.areas (owner_user_id,sort_order) where archived_at is null;

create table tasks.projects (
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 area_id uuid,
 name text not null check (char_length(btrim(name)) between 1 and 160),
 description text not null default '' check(char_length(description)<=4000),
 status text not null default 'active' check (status in ('active','paused','completed')),
 target_date date,
 sort_order integer not null default 0,
 archived_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(owner_user_id,id),
 constraint task_v2_project_area_owner foreign key(owner_user_id,area_id)
   references tasks.areas(owner_user_id,id) on delete restrict
);
create index task_v2_project_owner_status on tasks.projects(owner_user_id,status,sort_order) where archived_at is null;

alter table tasks.items
 add column area_id uuid,
 add column project_id uuid,
 add column board_rank numeric(14,4) not null default 0,
 add column important boolean not null default false,
 add column estimated_minutes integer,
 add column done_definition text not null default '',
 add column resume_note text not null default '',
 add column waiting_for text not null default '',
 add column followup_date date,
 add constraint task_v2_area_owner foreign key(owner_user_id,area_id)
  references tasks.areas(owner_user_id,id) on delete restrict,
 add constraint task_v2_project_owner foreign key(owner_user_id,project_id)
  references tasks.projects(owner_user_id,id) on delete restrict,
 add constraint task_v2_estimate_check check(estimated_minutes between 1 and 1440),
 add constraint task_v2_done_definition_check check(char_length(done_definition)<=2000),
 add constraint task_v2_resume_note_check check(char_length(resume_note)<=4000),
 add constraint task_v2_waiting_for_check check(char_length(waiting_for)<=500);

alter table tasks.items drop constraint items_status_check;
alter table tasks.items add constraint items_status_check check(status in ('todo','in_progress','waiting','done'));
create index task_v2_items_area on tasks.items(owner_user_id,area_id,status,board_rank) where archived_at is null;
create index task_v2_items_project on tasks.items(owner_user_id,project_id,status,board_rank) where archived_at is null;
create index task_v2_items_followup on tasks.items(owner_user_id,followup_date) where status='waiting' and archived_at is null;

alter table tasks.areas enable row level security;
alter table tasks.projects enable row level security;
revoke all on tasks.areas, tasks.projects from public,anon,authenticated;
grant select,insert,update,delete on tasks.areas, tasks.projects to service_role;

create function public.task_v2_areas_list(p_actor_id uuid) returns jsonb
language sql set search_path to '' as $$
 select coalesce(jsonb_agg(to_jsonb(a) order by a.sort_order,a.name),'[]'::jsonb)
 from tasks.areas a where a.owner_user_id=p_actor_id and a.archived_at is null;
$$;

create function public.task_v2_area_save(p_actor_id uuid,p_data jsonb) returns jsonb
language plpgsql set search_path to '' as $$
declare v tasks.areas%rowtype; target_id uuid; v_name text; v_color text; v_icon text; v_order integer;
begin
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Invalid area'; end if;
 if exists(select 1 from jsonb_object_keys(p_data) k where k not in ('id','name','color','icon','sort_order','archived')) then raise exception 'Unsupported area field'; end if;
 target_id:=nullif(p_data->>'id','')::uuid;
 v_name:=btrim(p_data->>'name');
 if target_id is null and (v_name is null or char_length(v_name) not between 1 and 80) then raise exception 'Area name required';end if;
 if target_id is not null then
  select * into v from tasks.areas where id=target_id and owner_user_id=p_actor_id and archived_at is null for update;
  if v.id is null then return null;end if;
 end if;
 v_name:=coalesce(v_name,v.name);
 if char_length(v_name) not between 1 and 80 then raise exception 'Invalid area name';end if;
 v_color:=coalesce(p_data->>'color',v.color,'blue');
 if v_color not in ('slate','blue','green','amber','red','purple') then raise exception 'Invalid area color';end if;
 v_icon:=coalesce(p_data->>'icon',v.icon,'folder');
 if char_length(v_icon) not between 1 and 40 then raise exception 'Invalid area icon';end if;
 v_order:=coalesce((p_data->>'sort_order')::integer,v.sort_order,0);
 if target_id is null then
  insert into tasks.areas(owner_user_id,name,color,icon,sort_order) values(p_actor_id,v_name,v_color,v_icon,v_order) returning * into v;
 else
  update tasks.areas set name=v_name,color=v_color,icon=v_icon,sort_order=v_order,
   archived_at=case when p_data->>'archived'='true' then now() else archived_at end,updated_at=now()
   where id=target_id returning * into v;
 end if;
 return to_jsonb(v);
end $$;

create function public.task_v2_projects_list(p_actor_id uuid) returns jsonb
language sql set search_path to '' as $$
 select coalesce(jsonb_agg(to_jsonb(p) order by p.sort_order,p.name),'[]'::jsonb)
 from tasks.projects p where p.owner_user_id=p_actor_id and p.archived_at is null;
$$;

create function public.task_v2_project_save(p_actor_id uuid,p_data jsonb) returns jsonb
language plpgsql set search_path to '' as $$
declare v tasks.projects%rowtype; target_id uuid; v_area uuid; v_name text; v_status text;
begin
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Invalid project';end if;
 if exists(select 1 from jsonb_object_keys(p_data) k where k not in ('id','area_id','name','description','status','target_date','sort_order','archived')) then raise exception 'Unsupported project field';end if;
 target_id:=nullif(p_data->>'id','')::uuid;
 if target_id is not null then
  select * into v from tasks.projects where id=target_id and owner_user_id=p_actor_id and archived_at is null for update;
  if v.id is null then return null;end if;
 end if;
 v_name:=coalesce(btrim(p_data->>'name'),v.name);
 if v_name is null or char_length(v_name) not between 1 and 160 then raise exception 'Invalid project name';end if;
 v_area:=case when p_data ? 'area_id' then nullif(p_data->>'area_id','')::uuid else v.area_id end;
 if v_area is not null and not exists(select 1 from tasks.areas a where a.id=v_area and a.owner_user_id=p_actor_id and a.archived_at is null) then
  raise exception 'Area not accessible';
 end if;
 v_status:=coalesce(p_data->>'status',v.status,'active');
 if v_status not in ('active','paused','completed') then raise exception 'Invalid project status';end if;
 if target_id is null then
  insert into tasks.projects(owner_user_id,area_id,name,description,status,target_date,sort_order)
  values(p_actor_id,v_area,v_name,coalesce(p_data->>'description',''),v_status,nullif(p_data->>'target_date','')::date,coalesce((p_data->>'sort_order')::integer,0)) returning * into v;
 else
  update tasks.projects set area_id=v_area,name=v_name,description=coalesce(p_data->>'description',v.description),
   status=v_status,target_date=case when p_data ? 'target_date' then nullif(p_data->>'target_date','')::date else v.target_date end,
   sort_order=coalesce((p_data->>'sort_order')::integer,v.sort_order),
   archived_at=case when p_data->>'archived'='true' then now() else archived_at end,updated_at=now()
   where id=target_id returning * into v;
 end if;
 return to_jsonb(v);
end $$;

-- V2-only metadata patch, leaves legacy task CRUD and CRM integrations untouched.
-- Ordinary status transitions continue through public.task_update, preserving recurrence.
-- The special Waiting transition is permitted only for tasks without module links.
create function public.task_v2_patch(p_actor_id uuid,p_task_id uuid,p_data jsonb) returns jsonb
language plpgsql set search_path to '' as $$
declare v tasks.items%rowtype; v_area uuid; v_project uuid; v_status text;
begin
 if p_data is null or jsonb_typeof(p_data)<>'object' or p_data='{}'::jsonb then raise exception 'Invalid task patch';end if;
 if exists(select 1 from jsonb_object_keys(p_data) k where k not in
  ('area_id','project_id','board_rank','important','estimated_minutes','done_definition','resume_note','waiting_for','followup_date','status')) then
  raise exception 'Unsupported task field';
 end if;
 select * into v from tasks.items where id=p_task_id and owner_user_id=p_actor_id and archived_at is null for update;
 if v.id is null then return null;end if;
 v_area:=case when p_data ? 'area_id' then nullif(p_data->>'area_id','')::uuid else v.area_id end;
 v_project:=case when p_data ? 'project_id' then nullif(p_data->>'project_id','')::uuid else v.project_id end;
 if v_area is not null and not exists(select 1 from tasks.areas where id=v_area and owner_user_id=p_actor_id and archived_at is null) then raise exception 'Invalid area';end if;
 if v_project is not null and not exists(select 1 from tasks.projects where id=v_project and owner_user_id=p_actor_id and archived_at is null and (area_id is null or v_area is null or area_id=v_area)) then raise exception 'Project does not match area';end if;
 v_status:=coalesce(p_data->>'status',v.status);
 if p_data ? 'status' and v_status<>'waiting' then raise exception 'Use original task update for normal status transitions';end if;
 if v_status='waiting' and v.status<>'waiting' and exists(select 1 from tasks.module_links where task_id=v.id) then raise exception 'Linked tasks cannot enter Waiting';end if;
 if v_status='waiting' and v.status='done' then raise exception 'Reopen task before moving to Waiting';end if;
 update tasks.items t set
  area_id=v_area,project_id=v_project,
  board_rank=case when p_data ? 'board_rank' then (p_data->>'board_rank')::numeric else t.board_rank end,
  important=case when p_data ? 'important' then (p_data->>'important')::boolean else t.important end,
  estimated_minutes=case when p_data ? 'estimated_minutes' then nullif(p_data->>'estimated_minutes','')::integer else t.estimated_minutes end,
  done_definition=case when p_data ? 'done_definition' then coalesce(p_data->>'done_definition','') else t.done_definition end,
  resume_note=case when p_data ? 'resume_note' then coalesce(p_data->>'resume_note','') else t.resume_note end,
  waiting_for=case when p_data ? 'waiting_for' then coalesce(p_data->>'waiting_for','') else t.waiting_for end,
  followup_date=case when p_data ? 'followup_date' then nullif(p_data->>'followup_date','')::date else t.followup_date end,
  status=v_status,updated_at=now()
 where t.id=p_task_id returning * into v;
 if p_data ? 'status' and v.status='waiting' then
  insert into tasks.activity(task_id,actor_user_id,action,details)
  values(v.id,p_actor_id,'status_changed',jsonb_build_object('to','waiting'));
 end if;
 return to_jsonb(v);
end $$;

revoke all on function public.task_v2_areas_list(uuid),public.task_v2_area_save(uuid,jsonb),
 public.task_v2_projects_list(uuid),public.task_v2_project_save(uuid,jsonb),
 public.task_v2_patch(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.task_v2_areas_list(uuid),public.task_v2_area_save(uuid,jsonb),
 public.task_v2_projects_list(uuid),public.task_v2_project_save(uuid,jsonb),
 public.task_v2_patch(uuid,uuid,jsonb) to service_role;


-- ===== SOURCE: database/tasks/11_v2_capture.sql =====
-- My Tasks V2 Phase 2: atomic fast capture with optional area/project context.
-- Development project only. Existing task APIs and records are unchanged.

create function public.task_v2_capture(p_actor_id uuid,p_data jsonb) returns jsonb
language plpgsql set search_path to '' as $$
declare created jsonb; extras jsonb;
begin
 if p_actor_id is null then raise exception 'Invalid account'; end if;
 if p_data is null or jsonb_typeof(p_data)<>'object'
   or exists(select 1 from jsonb_object_keys(p_data) k where k not in
     ('title','description','priority','scheduled_date','due_at','category_id',
      'area_id','project_id','important','estimated_minutes'))
 then raise exception 'Invalid quick capture payload'; end if;
 if char_length(btrim(coalesce(p_data->>'title',''))) not between 1 and 240 then raise exception 'Task title required'; end if;
 perform pg_advisory_xact_lock(hashtextextended('tasks-v2-board:'||p_actor_id::text,0));
 created:=public.task_create(p_actor_id, p_data - 'area_id' - 'project_id' - 'important' - 'estimated_minutes');
 extras:=p_data - 'title' - 'description' - 'priority' - 'scheduled_date' - 'due_at' - 'category_id';
 if extras<>'{}'::jsonb then
   created:=public.task_v2_patch(p_actor_id,(created->>'id')::uuid,extras);
   if created is null then raise exception 'Unable to apply V2 task details'; end if;
 end if;
 -- Keep the relative creation order deterministic, even within one transaction.
 update tasks.items t set board_rank=(
   select coalesce(max(i.board_rank),0)+1024 from tasks.items i
   where i.owner_user_id=p_actor_id and i.status=t.status and i.archived_at is null and i.id<>t.id
 ) where t.id=(created->>'id')::uuid returning to_jsonb(t) into created;
 return created;
end $$;
revoke all on function public.task_v2_capture(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.task_v2_capture(uuid,jsonb) to service_role;


-- ===== SOURCE: database/tasks/12_v2_board_and_details.sql =====
-- My Tasks 2.0 Phase 3 — transactional board moves and a single safe detail update.
-- Only apply to Development project fflejkqcspivnhsmkdtn.

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
  and (p_group_by<>'status' or t.status=p_status) and t.id<>p_task_id
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


-- ===== SOURCE: database/tasks/13_v2_detail_save_correction.sql =====
-- Corrects the V2 detail-save JSONB field projection. Development only.

create or replace function public.task_v2_detail_save(
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


-- ===== SOURCE: database/tasks/14_v2_board_snapshot.sql =====
-- My Tasks 2.0 Phase 3: board cards with checklist progress in one paginated query.
-- Development only. Existing task_list and task APIs remain unchanged.

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


-- ===== SOURCE: database/tasks/15_v2_group_board_order_fix.sql =====
-- Fix: Area/Project board columns contain multiple statuses; reorder the entire group.
-- Development only.

create or replace function public.task_v2_board_move(
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
  and (p_group_by<>'status' or t.status=p_status) and t.id<>p_task_id
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


-- ===== SOURCE: database/tasks/16_v2_capture_order_fix.sql =====
-- Phase 3 correction: stable ordering of newly captured tasks; Development only.

create or replace function public.task_v2_capture(p_actor_id uuid,p_data jsonb) returns jsonb
language plpgsql set search_path to '' as $$
declare created jsonb; extras jsonb;
begin
 if p_actor_id is null then raise exception 'Invalid account'; end if;
 if p_data is null or jsonb_typeof(p_data)<>'object'
   or exists(select 1 from jsonb_object_keys(p_data) k where k not in
     ('title','description','priority','scheduled_date','due_at','category_id',
      'area_id','project_id','important','estimated_minutes'))
 then raise exception 'Invalid quick capture payload'; end if;
 if char_length(btrim(coalesce(p_data->>'title',''))) not between 1 and 240 then raise exception 'Task title required'; end if;
 perform pg_advisory_xact_lock(hashtextextended('tasks-v2-board:'||p_actor_id::text,0));
 created:=public.task_create(p_actor_id, p_data - 'area_id' - 'project_id' - 'important' - 'estimated_minutes');
 extras:=p_data - 'title' - 'description' - 'priority' - 'scheduled_date' - 'due_at' - 'category_id';
 if extras<>'{}'::jsonb then
   created:=public.task_v2_patch(p_actor_id,(created->>'id')::uuid,extras);
   if created is null then raise exception 'Unable to apply V2 task details'; end if;
 end if;
 -- Keep the relative creation order deterministic, even within one transaction.
 update tasks.items t set board_rank=(
   select coalesce(max(i.board_rank),0)+1024 from tasks.items i
   where i.owner_user_id=p_actor_id and i.status=t.status and i.archived_at is null and i.id<>t.id
 ) where t.id=(created->>'id')::uuid returning to_jsonb(t) into created;
 return created;
end $$;


-- ===== SOURCE: database/tasks/17_v2_focus_balance.sql =====
-- My Tasks 2.0 / Phase 4: Focus Balance, timeboxing, finish decisions and idea parking.
-- Development project fflejkqcspivnhsmkdtn ONLY. No existing Tasks/CRM data modified.

-- Required composite owner FK target for session and idea isolation.
alter table tasks.items add constraint task_v2_item_owner_id_unique unique(owner_user_id,id);
create table tasks.focus_sessions(
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 task_id uuid not null,
 mode text not null default 'timebox' check(mode in('timebox','pomodoro','stopwatch','five_minutes')),
 state text not null default 'running' check(state in('running','paused','ended')),
 planned_minutes integer not null check(planned_minutes between 5 and 240),
 elapsed_seconds integer not null default 0 check(elapsed_seconds between 0 and 604800),
 started_at timestamptz not null default now(),
 resumed_at timestamptz not null default now(),
 ended_at timestamptz,
 outcome text check(outcome in ('completed','parked','stopped')),
 extension_count smallint not null default 0 check(extension_count between 0 and 50),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint focus_task_owner foreign key(owner_user_id,task_id) references tasks.items(owner_user_id,id) on delete cascade,
 constraint focus_end_consistency check((state='ended')=(ended_at is not null))
);
create unique index focus_one_active_session on tasks.focus_sessions(owner_user_id) where state in('running','paused');
create index focus_owner_history on tasks.focus_sessions(owner_user_id,created_at desc);
create index focus_task_history on tasks.focus_sessions(task_id,started_at desc);

create table tasks.parked_ideas(
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 source_task_id uuid,
 title text not null check(char_length(btrim(title)) between 1 and 300),
 state text not null default 'inbox' check(state in('inbox','converted','dismissed')),
 converted_task_id uuid,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint parked_source_owner foreign key(owner_user_id,source_task_id) references tasks.items(owner_user_id,id) on delete set null (source_task_id),
 constraint parked_converted_owner foreign key(owner_user_id,converted_task_id) references tasks.items(owner_user_id,id) on delete set null (converted_task_id)
);
create index parked_owner_inbox on tasks.parked_ideas(owner_user_id,created_at desc) where state='inbox';

create table tasks.focus_settings(
 owner_user_id uuid primary key references auth.users(id) on delete cascade,
 active_project_limit smallint not null default 2 check(active_project_limit between 1 and 10),
 daily_focus_minutes smallint not null default 180 check(daily_focus_minutes between 30 and 600),
 switch_prompt_enabled boolean not null default true,
 updated_at timestamptz not null default now()
);

alter table tasks.focus_sessions enable row level security;
alter table tasks.parked_ideas enable row level security;
alter table tasks.focus_settings enable row level security;
revoke all on tasks.focus_sessions,tasks.parked_ideas,tasks.focus_settings from public,anon,authenticated;
grant select,insert,update,delete on tasks.focus_sessions,tasks.parked_ideas,tasks.focus_settings to service_role;

create function public.task_v2_focus_get(p_actor_id uuid) returns jsonb
language sql set search_path to '' as $$
 select jsonb_build_object(
  'active',(select to_jsonb(s) from tasks.focus_sessions s where s.owner_user_id=p_actor_id and s.state in('running','paused') order by s.created_at desc limit 1),
  'settings',coalesce((select to_jsonb(x) from tasks.focus_settings x where x.owner_user_id=p_actor_id),
   '{"active_project_limit":2,"daily_focus_minutes":180,"switch_prompt_enabled":true}'::jsonb),
  'ideas',coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at desc) from
   (select * from tasks.parked_ideas where owner_user_id=p_actor_id and state='inbox' order by created_at desc limit 100) i),'[]'::jsonb),
  'history',coalesce((select jsonb_agg(to_jsonb(h) order by h.created_at desc) from
   (select * from tasks.focus_sessions where owner_user_id=p_actor_id and state='ended' order by created_at desc limit 30) h),'[]'::jsonb)
 );
$$;

create function public.task_v2_focus_action(
 p_actor_id uuid,p_action text,p_data jsonb default '{}'::jsonb
) returns jsonb language plpgsql set search_path to '' as $$
declare s tasks.focus_sessions%rowtype; task_record tasks.items%rowtype;
 v_duration integer; v_task_id uuid; v_id uuid; v_seconds integer; v_note text; v_outcome text;
begin
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Invalid focus action';end if;
 if p_action not in('start','pause','resume','extend','finish') then raise exception 'Unknown focus action';end if;
 perform pg_advisory_xact_lock(hashtextextended('tasks-v2-focus:'||p_actor_id::text,0));
 if p_action='start' then
  if exists(select 1 from tasks.focus_sessions where owner_user_id=p_actor_id and state in('running','paused')) then
   raise exception 'Finish or pause your existing session first';
  end if;
  if exists(select 1 from jsonb_object_keys(p_data) k where k not in ('task_id','mode','minutes')) then raise exception 'Unsupported focus field';end if;
  v_task_id:=nullif(p_data->>'task_id','')::uuid;
  select * into task_record from tasks.items where id=v_task_id and owner_user_id=p_actor_id and archived_at is null;
  if task_record.id is null or task_record.status='done' then raise exception 'Choose an open task you own';end if;
  if coalesce(p_data->>'mode','timebox') not in ('timebox','pomodoro','stopwatch','five_minutes') then raise exception 'Invalid focus mode';end if;
  v_duration:=coalesce((p_data->>'minutes')::integer,25);
  if v_duration not between 5 and 240 then raise exception 'Invalid focus duration';end if;
  insert into tasks.focus_sessions(owner_user_id,task_id,mode,planned_minutes)
  values(p_actor_id,v_task_id,coalesce(p_data->>'mode','timebox'),v_duration) returning * into s;
 else
  if exists(select 1 from jsonb_object_keys(p_data) k where k not in ('session_id','minutes','resume_note','outcome')) then raise exception 'Unsupported focus field';end if;
  v_id:=nullif(p_data->>'session_id','')::uuid;
  select * into s from tasks.focus_sessions where owner_user_id=p_actor_id and id=v_id and state in('running','paused') for update;
  if s.id is null then raise exception 'Focus session is unavailable';end if;
  v_seconds:=least(604800,s.elapsed_seconds+
   case when s.state='running' then greatest(0,extract(epoch from (now()-s.resumed_at))::integer) else 0 end);
  if p_action='pause' then
   if s.state<>'running' then raise exception 'Session is not running';end if;
   update tasks.focus_sessions set state='paused',elapsed_seconds=v_seconds,updated_at=now() where id=s.id returning * into s;
  elsif p_action='resume' then
   if s.state<>'paused' then raise exception 'Session is not paused';end if;
   update tasks.focus_sessions set state='running',resumed_at=now(),updated_at=now() where id=s.id returning * into s;
  elsif p_action='extend' then
   v_duration:=coalesce((p_data->>'minutes')::integer,15);
   if v_duration not between 5 and 60 or s.planned_minutes+v_duration>240 then raise exception 'Extension exceeds limit';end if;
   update tasks.focus_sessions set planned_minutes=planned_minutes+v_duration,extension_count=extension_count+1,
    elapsed_seconds=v_seconds,resumed_at=case when state='running' then now() else resumed_at end,
    updated_at=now() where id=s.id returning * into s;
  elsif p_action='finish' then
   v_outcome:=p_data->>'outcome';
   if v_outcome not in ('completed','parked','stopped') then raise exception 'Choose a finish outcome';end if;
   v_note:=coalesce(p_data->>'resume_note','');
   if char_length(v_note)>4000 then raise exception 'Resume note is too long';end if;
   if v_outcome='parked' then
    if char_length(btrim(v_note))<1 then raise exception 'Add a short note before parking your task';end if;
    update tasks.items set resume_note=v_note,updated_at=now() where id=s.task_id and owner_user_id=p_actor_id;
   elsif v_outcome='completed' then
    perform public.task_update(p_actor_id,s.task_id,'{"status":"done"}'::jsonb);
   end if;
   update tasks.focus_sessions set state='ended',outcome=v_outcome,elapsed_seconds=v_seconds,
    ended_at=now(),updated_at=now() where id=s.id returning * into s;
  end if;
 end if;
 return to_jsonb(s);
end $$;

create function public.task_v2_idea_action(
 p_actor_id uuid,p_action text,p_data jsonb
) returns jsonb language plpgsql set search_path to '' as $$
declare idea tasks.parked_ideas%rowtype; v_source uuid; v_id uuid; created jsonb;
begin
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Invalid idea request';end if;
 if p_action='capture' then
  if exists(select 1 from jsonb_object_keys(p_data) k where k not in ('title','source_task_id')) then raise exception 'Unsupported idea field';end if;
  if char_length(btrim(coalesce(p_data->>'title',''))) not between 1 and 300 then raise exception 'Idea title must contain 1-300 characters';end if;
  v_source:=nullif(p_data->>'source_task_id','')::uuid;
  if v_source is not null and not exists(select 1 from tasks.items where id=v_source and owner_user_id=p_actor_id and archived_at is null)
   then raise exception 'Task not accessible';end if;
  insert into tasks.parked_ideas(owner_user_id,source_task_id,title) values(p_actor_id,v_source,btrim(p_data->>'title')) returning * into idea;
 elsif p_action in ('dismiss','convert') then
  if exists(select 1 from jsonb_object_keys(p_data) k where k<>'idea_id') then raise exception 'Unsupported idea field';end if;
  v_id:=nullif(p_data->>'idea_id','')::uuid;
  select * into idea from tasks.parked_ideas where id=v_id and owner_user_id=p_actor_id and state='inbox' for update;
  if idea.id is null then return null;end if;
  if p_action='convert' then
   created:=public.task_v2_capture(p_actor_id,jsonb_build_object('title',left(idea.title,240)));
   update tasks.parked_ideas set state='converted',converted_task_id=(created->>'id')::uuid,updated_at=now() where id=idea.id returning * into idea;
  else
   update tasks.parked_ideas set state='dismissed',updated_at=now() where id=idea.id returning * into idea;
  end if;
 else raise exception 'Unknown idea action';
 end if;
 return to_jsonb(idea);
end $$;

create function public.task_v2_focus_settings_save(
 p_actor_id uuid,p_limit integer,p_minutes integer,p_switch boolean
) returns jsonb language plpgsql set search_path to '' as $$
declare r tasks.focus_settings%rowtype;
begin
 if p_limit not between 1 and 10 or p_minutes not between 30 and 600 or p_switch is null then raise exception 'Invalid focus settings';end if;
 insert into tasks.focus_settings(owner_user_id,active_project_limit,daily_focus_minutes,switch_prompt_enabled)
 values(p_actor_id,p_limit,p_minutes,p_switch)
 on conflict(owner_user_id) do update set active_project_limit=excluded.active_project_limit,
 daily_focus_minutes=excluded.daily_focus_minutes,switch_prompt_enabled=excluded.switch_prompt_enabled,updated_at=now()
 returning * into r;
 return to_jsonb(r);
end $$;

revoke all on function public.task_v2_focus_get(uuid),public.task_v2_focus_action(uuid,text,jsonb),
 public.task_v2_idea_action(uuid,text,jsonb),public.task_v2_focus_settings_save(uuid,integer,integer,boolean) from public,anon,authenticated;
grant execute on function public.task_v2_focus_get(uuid),public.task_v2_focus_action(uuid,text,jsonb),
 public.task_v2_idea_action(uuid,text,jsonb),public.task_v2_focus_settings_save(uuid,integer,integer,boolean) to service_role;


-- ===== SOURCE: database/tasks/18_v2_focus_commitments.sql =====
-- Phase 4 addition: optional weekly Area commitments (rolling seven days).
-- Development only; no automatic enforcement or punitive streaks.

create table tasks.focus_commitments(
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 area_id uuid not null,
 target_sessions smallint not null check(target_sessions between 1 and 14),
 updated_at timestamptz not null default now(),
 primary key(owner_user_id,area_id),
 constraint focus_commitment_owned_area foreign key(owner_user_id,area_id)
 references tasks.areas(owner_user_id,id) on delete cascade
);
alter table tasks.focus_commitments enable row level security;
revoke all on tasks.focus_commitments from public,anon,authenticated;
grant select,insert,update,delete on tasks.focus_commitments to service_role;

create function public.task_v2_commitment_save(p_actor_id uuid,p_area_id uuid,p_target integer)
returns jsonb language plpgsql set search_path to '' as $$
declare r tasks.focus_commitments%rowtype;
begin
 if p_area_id is null or p_target not between 0 and 14 then raise exception 'Invalid commitment';end if;
 if not exists(select 1 from tasks.areas where owner_user_id=p_actor_id and id=p_area_id and archived_at is null)
 then raise exception 'Area not accessible';end if;
 if p_target=0 then
  delete from tasks.focus_commitments where owner_user_id=p_actor_id and area_id=p_area_id;
  return jsonb_build_object('area_id',p_area_id,'target_sessions',0);
 end if;
 insert into tasks.focus_commitments(owner_user_id,area_id,target_sessions)
 values(p_actor_id,p_area_id,p_target)
 on conflict(owner_user_id,area_id) do update set target_sessions=excluded.target_sessions,updated_at=now()
 returning * into r;
 return to_jsonb(r);
end $$;

create or replace function public.task_v2_focus_get(p_actor_id uuid) returns jsonb
language sql set search_path to '' as $$
 select jsonb_build_object(
  'active',(select to_jsonb(s) from tasks.focus_sessions s where s.owner_user_id=p_actor_id and s.state in('running','paused') order by s.created_at desc limit 1),
  'settings',coalesce((select to_jsonb(x) from tasks.focus_settings x where x.owner_user_id=p_actor_id),
   '{"active_project_limit":2,"daily_focus_minutes":180,"switch_prompt_enabled":true}'::jsonb),
  'ideas',coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at desc) from
   (select * from tasks.parked_ideas where owner_user_id=p_actor_id and state='inbox' order by created_at desc limit 100) i),'[]'::jsonb),
  'history',coalesce((select jsonb_agg(to_jsonb(h) order by h.created_at desc) from
   (select * from tasks.focus_sessions where owner_user_id=p_actor_id and state='ended' order by created_at desc limit 100) h),'[]'::jsonb),
  'commitments',coalesce((
    select jsonb_agg(jsonb_build_object(
     'area_id',c.area_id,'target_sessions',c.target_sessions,
     'completed_sessions',(select count(*)::integer from tasks.focus_sessions s
       join tasks.items t on t.id=s.task_id
       where s.owner_user_id=p_actor_id and s.state='ended'
        and t.area_id=c.area_id and s.started_at>=now()-interval '7 days')
    ) order by a.sort_order,a.name)
    from tasks.focus_commitments c join tasks.areas a on a.id=c.area_id
    where c.owner_user_id=p_actor_id and a.archived_at is null
   ),'[]'::jsonb)
 );
$$;
revoke all on function public.task_v2_commitment_save(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.task_v2_commitment_save(uuid,uuid,integer) to service_role;


-- ===== SOURCE: database/tasks/19_v2_parked_idea_fk_fix.sql =====
-- Correct composite FK deletion actions for idea references; Development only.

alter table tasks.parked_ideas drop constraint parked_source_owner;
alter table tasks.parked_ideas add constraint parked_source_owner foreign key(owner_user_id,source_task_id)
 references tasks.items(owner_user_id,id) on delete set null (source_task_id);
alter table tasks.parked_ideas drop constraint parked_converted_owner;
alter table tasks.parked_ideas add constraint parked_converted_owner foreign key(owner_user_id,converted_task_id)
 references tasks.items(owner_user_id,id) on delete set null (converted_task_id);


-- ===== SOURCE: database/tasks/20_v2_week_planner.sql =====
-- Tasks V2 Phase 5: explicit planned date, Someday, and gentle overdue recovery.
-- Additive: preserves due_at, reminders, recurrence, status, CRM links and classic APIs.

alter table tasks.items add column if not exists someday boolean not null default false;
alter table tasks.items add column if not exists reschedule_count integer not null default 0;
alter table tasks.items add constraint task_v2_reschedule_count_bounds check(reschedule_count between 0 and 1000000);
create index if not exists task_v2_items_plan on tasks.items(owner_user_id,scheduled_date,someday) where archived_at is null and status<>'done';

create function public.task_v2_plan_move(p_actor_id uuid,p_task_ids uuid[],p_action text,p_date date default null)
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

revoke all on function public.task_v2_plan_move(uuid,uuid[],text,date) from public,anon,authenticated;
grant execute on function public.task_v2_plan_move(uuid,uuid[],text,date) to service_role;


-- ===== SOURCE: database/tasks/21_v2_priority_matrix.sql =====
-- Phase 5: importance and urgency are independent decisions for optional matrix.

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


-- ===== SOURCE: database/tasks/22_v2_recurrence_reminders.sql =====
-- Phase 5: allow recurring tasks and reminders via shared V2 detail drawer.
-- Corrects the V2 detail-save JSONB field projection. Development only.

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
 extra:=p_data - 'title' - 'description' - 'priority' - 'scheduled_date' - 'due_at' - 'status' - 'reminder_at' - 'recurrence';
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


-- ===== SOURCE: database/tasks/23_v2_recurrence_partition_fix.sql =====
-- Phase 5 post-apply fix: correct V2/legacy field partition. Development only.
-- Corrects the V2 detail-save JSONB field projection. Development only.

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
 extra:=p_data - 'title' - 'description' - 'priority' - 'scheduled_date' - 'due_at' - 'status' - 'reminder_at' - 'recurrence';
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


-- ===== SOURCE: database/tasks/24_v2_recurrence_context.sql =====
-- Phase 5 compatibility: keep V2 task context in future recurring occurrences.
-- Runs only on INSERT with a pre-existing completed task in the same recurrence series.
-- No legacy task_update rewrite; no change to original task, CRM links or reminder timing.

create function tasks.v2_inherit_recurring_context()
returns trigger language plpgsql set search_path to '' as $$
declare prior tasks.items%rowtype;
begin
 if new.recurrence_series_id is null or new.recurrence='none' then return new;end if;
 select * into prior from tasks.items t
 where t.owner_user_id=new.owner_user_id
   and t.recurrence_series_id=new.recurrence_series_id
   and t.status='done'
 order by t.completed_at desc nulls last,t.created_at desc,t.id desc
 limit 1;
 if prior.id is null then return new;end if;
 new.area_id:=coalesce(new.area_id,prior.area_id);
 new.project_id:=coalesce(new.project_id,prior.project_id);
 new.important:=prior.important;
 new.urgent:=prior.urgent;
 new.estimated_minutes:=prior.estimated_minutes;
 new.done_definition:=prior.done_definition;
 new.board_rank:=(
  select coalesce(max(i.board_rank),0)+1024 from tasks.items i
  where i.owner_user_id=new.owner_user_id and i.status='todo' and i.archived_at is null
 );
 -- Resume notes are specific to the previous work session, not the new occurrence.
 new.resume_note:='';
 new.someday:=false;
 new.reschedule_count:=0;
 return new;
end $$;
create trigger tasks_v2_inherit_recurring_context
before insert on tasks.items for each row
execute function tasks.v2_inherit_recurring_context();


-- ===== SOURCE: database/tasks/25_v2_someday_focus_reset.sql =====
-- Phase 5 post-apply correction: Someday removes current Top 3 focus. Development only.

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

COMMIT;
