-- Phase 5: task-only accounts and atomic, user-scoped imports.
-- Apply only to Development after 07_module_integrations.sql.
begin;

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
commit;
