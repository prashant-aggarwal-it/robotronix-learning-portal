-- Phase 3: private-by-default workspaces, invitations, assignments, comments, activity, attachments.
-- Apply once to Development, after 03_preferences_categories.sql.
begin;
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
commit;
