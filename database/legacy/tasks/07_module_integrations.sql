-- Phase 4: explicit, per-user module links. No automatic CRM migration.
-- Apply to the Development project after 06_shared_subtasks.sql.
begin;
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
commit;
