-- Phase 5 extension: reminders and assignments for task-only accounts.
-- Keep the Portal notification path unchanged for existing role-based users.
begin;
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
commit;
