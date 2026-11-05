-- Phase 3B — simple tenant-scoped workflow automation and in-app reminders.
-- All functions are server-only (service_role), all tables are private with RLS.
begin;
create table connect.automation_settings (
 tenant_id uuid primary key references connect.tenants(id) on delete restrict,
 assignment_enabled boolean not null default true,
 initial_followup_enabled boolean not null default true,
 followup_delay_hours integer not null default 24 check(followup_delay_hours between 1 and 168),
 reminders_enabled boolean not null default true,
 reminder_advance_minutes integer not null default 30 check(reminder_advance_minutes between 5 and 1440),
 updated_at timestamptz not null default now()
);
create table connect.staff_notifications (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references connect.tenants(id) on delete restrict,
 member_id uuid not null,
 task_id uuid not null,
 kind text not null check(kind in ('upcoming','overdue')),
 title text not null,
 created_at timestamptz not null default now(),
 read_at timestamptz,
 foreign key(tenant_id,member_id) references connect.memberships(tenant_id,id) on delete restrict,
 foreign key(tenant_id,task_id) references connect.tasks(tenant_id,id) on delete restrict,
 unique(tenant_id,task_id,member_id,kind)
);
create index connect_staff_notifications_inbox_idx on connect.staff_notifications(tenant_id,member_id,created_at desc);
alter table connect.automation_settings enable row level security;
alter table connect.staff_notifications enable row level security;
revoke all on connect.automation_settings,connect.staff_notifications from public,anon,authenticated;
grant select,insert,update,delete on connect.automation_settings,connect.staff_notifications to service_role;

create or replace function connect.automate_new_opportunity()
returns trigger language plpgsql security invoker set search_path=''
as $fn$
declare v_policy connect.automation_settings%rowtype;v_assignee uuid;
begin
 select * into v_policy from connect.automation_settings where tenant_id=new.tenant_id;
 if not found then
  insert into connect.automation_settings(tenant_id) values(new.tenant_id)
  on conflict(tenant_id) do nothing;
  select * into v_policy from connect.automation_settings where tenant_id=new.tenant_id;
 end if;
 if v_policy.assignment_enabled and new.owner_membership_id is null then
  -- Prefer active counsellors; distribute according to current open workload.
  select m.id into v_assignee
  from connect.memberships m
  left join lateral (
   select count(*) as workload from connect.opportunities o
   join connect.pipeline_stages st on st.tenant_id=o.tenant_id and st.id=o.stage_id
   where o.tenant_id=new.tenant_id and o.owner_membership_id=m.id and st.outcome='open'
  ) wl on true
  where m.tenant_id=new.tenant_id and m.status='active'
   and m.role in ('counsellor','manager','admin','owner')
  order by case when m.role='counsellor' then 0 when m.role='manager' then 1
    when m.role='admin' then 2 else 3 end,wl.workload,m.id
  limit 1;
  if v_assignee is not null then
   update connect.opportunities set owner_membership_id=v_assignee
   where tenant_id=new.tenant_id and id=new.id;
  end if;
 end if;
 if v_policy.initial_followup_enabled then
  insert into connect.tasks(tenant_id,opportunity_id,person_id,assignee_membership_id,title,due_at)
  values(new.tenant_id,new.id,new.contact_id,
   coalesce(new.owner_membership_id,v_assignee),
   'Follow up on new admission',now()+pg_catalog.make_interval(hours=>v_policy.followup_delay_hours));
 end if;
 return new;
end $fn$;
create trigger connect_opportunity_automation
after insert on connect.opportunities for each row execute function connect.automate_new_opportunity();

create or replace function public.connect_automation_settings(
 p_actor_id uuid,p_tenant_id uuid,p_update jsonb default null
) returns jsonb language plpgsql security invoker set search_path=''
as $fn$
declare v_role text;v_settings connect.automation_settings%rowtype;
begin
 select m.role into v_role from connect.memberships m
 join connect.tenants t on t.id=m.tenant_id
 where m.tenant_id=p_tenant_id and m.user_id=p_actor_id and m.status='active'
  and t.status in ('trial','active');
 if v_role is null then raise exception 'Workspace access denied' using errcode='42501';end if;
 if p_update is not null then
  if v_role not in ('owner','admin') then raise exception 'Only owners and admins may configure automation' using errcode='42501';end if;
  if jsonb_typeof(p_update)<>'object' or p_update ?| array['tenant_id','tenantId'] then
   raise exception 'Invalid automation policy' using errcode='22023';end if;
  if exists(select 1 from pg_catalog.jsonb_object_keys(p_update) as k
     where k not in ('assignmentEnabled','initialFollowupEnabled','followupDelayHours',
       'remindersEnabled','reminderAdvanceMinutes')) then
   raise exception 'Unknown automation option' using errcode='22023';end if;
 end if;
 insert into connect.automation_settings(tenant_id) values(p_tenant_id)
 on conflict(tenant_id) do nothing;
 if p_update is not null then
  update connect.automation_settings set
   assignment_enabled=coalesce((p_update->>'assignmentEnabled')::boolean,assignment_enabled),
   initial_followup_enabled=coalesce((p_update->>'initialFollowupEnabled')::boolean,initial_followup_enabled),
   followup_delay_hours=coalesce((p_update->>'followupDelayHours')::int,followup_delay_hours),
   reminders_enabled=coalesce((p_update->>'remindersEnabled')::boolean,reminders_enabled),
   reminder_advance_minutes=coalesce((p_update->>'reminderAdvanceMinutes')::int,reminder_advance_minutes),
   updated_at=now()
  where tenant_id=p_tenant_id;
 end if;
 select * into v_settings from connect.automation_settings where tenant_id=p_tenant_id;
 return jsonb_build_object('assignmentEnabled',v_settings.assignment_enabled,
  'initialFollowupEnabled',v_settings.initial_followup_enabled,
  'followupDelayHours',v_settings.followup_delay_hours,
  'remindersEnabled',v_settings.reminders_enabled,
  'reminderAdvanceMinutes',v_settings.reminder_advance_minutes);
end $fn$;

create or replace function public.connect_staff_inbox(
 p_actor_id uuid,p_tenant_id uuid,p_action text default 'list',p_notification_id uuid default null
) returns jsonb language plpgsql security invoker set search_path=''
as $fn$
declare v_member uuid;v_data jsonb;
begin
 select m.id into v_member from connect.memberships m
 join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active'
  and t.status in ('trial','active');
 if v_member is null then raise exception 'Workspace access denied' using errcode='42501';end if;
 if p_action='read' then
  if p_notification_id is null then raise exception 'Notification id required' using errcode='22023';end if;
  update connect.staff_notifications set read_at=coalesce(read_at,now())
  where id=p_notification_id and tenant_id=p_tenant_id and member_id=v_member;
 elsif p_action<>'list' then raise exception 'Unsupported notification action' using errcode='22023';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'title',n.title,
  'taskId',n.task_id,'kind',n.kind,'createdAt',n.created_at,'readAt',n.read_at)
 order by n.created_at desc),'[]'::jsonb)
 into v_data
 from (select * from connect.staff_notifications where tenant_id=p_tenant_id
  and member_id=v_member order by created_at desc limit 100) n;
 return v_data;
end $fn$;

create or replace function public.connect_conversation_history(
 p_actor_id uuid,p_tenant_id uuid,p_person_id uuid default null,
 p_limit integer default 40
) returns jsonb language plpgsql stable security invoker set search_path=''
as $fn$
declare v_member uuid;v_result jsonb;
begin
 select m.id into v_member from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active'
  and t.status in ('trial','active');
 if v_member is null then raise exception 'Workspace access denied' using errcode='42501';end if;
 if p_person_id is not null and not exists(select 1 from connect.people
    where tenant_id=p_tenant_id and id=p_person_id) then
  raise exception 'Contact unavailable' using errcode='42501';end if;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.occurred_at,q.id),'[]'::jsonb) into v_result
 from (select m.id,m.conversation_id,c.person_id,p.full_name as person_name,
  a.provider,a.display_name as channel_name,m.direction,m.body,m.delivery_status,m.occurred_at
  from connect.messages m
  join connect.conversations c on c.tenant_id=m.tenant_id and c.id=m.conversation_id
  join connect.channel_accounts a on a.tenant_id=c.tenant_id and a.id=c.channel_account_id
  left join connect.people p on p.tenant_id=c.tenant_id and p.id=c.person_id
  where m.tenant_id=p_tenant_id and (p_person_id is null or c.person_id=p_person_id)
  order by m.occurred_at desc,m.id desc limit least(100,greatest(1,coalesce(p_limit,40)))
 ) q;
 return v_result;
end $fn$;

-- Called by a trusted scheduler, never directly by users.
-- Only in-app alerts; no outbound messaging without verified consent and provider config.
create or replace function public.connect_run_reminders(p_batch_size integer default 250)
returns jsonb language plpgsql volatile security invoker set search_path=''
as $fn$
declare v_created integer;
begin
 with candidate as (
  select t.tenant_id,t.id,t.assignee_membership_id,t.title,
   case when t.due_at<=now() then 'overdue' else 'upcoming' end as kind
  from connect.tasks t
  join connect.memberships m on m.tenant_id=t.tenant_id
    and m.id=t.assignee_membership_id and m.status='active'
  join connect.tenants tn on tn.id=t.tenant_id and tn.status in ('trial','active')
  join connect.automation_settings p on p.tenant_id=t.tenant_id and p.reminders_enabled
  where t.status='open' and t.due_at is not null
    and t.due_at<=now()+pg_catalog.make_interval(mins=>p.reminder_advance_minutes)
    and t.due_at>=now()-interval '30 days'
  order by t.due_at,t.id
  limit least(1000,greatest(1,coalesce(p_batch_size,250)))
 )
 insert into connect.staff_notifications(tenant_id,task_id,member_id,title,kind)
 select tenant_id,id,assignee_membership_id,
  case when kind='overdue' then 'Overdue follow-up: ' else 'Follow-up due soon: ' end||left(title,190),kind
 from candidate
 on conflict(tenant_id,task_id,member_id,kind) do nothing;
 get diagnostics v_created=row_count;
 return jsonb_build_object('created',v_created,'delivery','in_app_only');
end $fn$;

revoke all on function public.connect_automation_settings(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.connect_staff_inbox(uuid,uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.connect_conversation_history(uuid,uuid,uuid,integer) from public,anon,authenticated;
revoke all on function public.connect_run_reminders(integer) from public,anon,authenticated;
grant execute on function public.connect_automation_settings(uuid,uuid,jsonb) to service_role;
grant execute on function public.connect_staff_inbox(uuid,uuid,text,uuid) to service_role;
grant execute on function public.connect_conversation_history(uuid,uuid,uuid,integer) to service_role;
grant execute on function public.connect_run_reminders(integer) to service_role;
revoke all on function connect.automate_new_opportunity() from public,anon,authenticated;
grant execute on function connect.automate_new_opportunity() to service_role;
commit;
