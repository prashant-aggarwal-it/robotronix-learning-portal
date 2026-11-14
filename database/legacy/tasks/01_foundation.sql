-- Universal My Tasks Phase 1. Apply ONLY to the confirmed Development project.
-- Private schema; Next.js service layer verifies the bearer token and scopes every query.
begin;
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
commit;
