-- Universal My Tasks V2 / Phase 1: additive private data model.
-- Apply only to Development: fflejkqcspivnhsmkdtn. No existing records are migrated or deleted.
begin;

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
commit;