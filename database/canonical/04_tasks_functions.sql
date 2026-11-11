-- FINAL My Tasks database logic, generated from the current DEV schema.
-- Exactly one latest definition per function signature; no historical patches.
-- Requires 02_tasks_schema.sql and complete public Learning Portal/Auth foundation.
BEGIN;

-- public.task_list(p_actor_id uuid, p_status text, p_limit integer, p_offset integer)
CREATE OR REPLACE FUNCTION public.task_list(p_actor_id uuid, p_status text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select coalesce(jsonb_agg(to_jsonb(t) order by t.updated_at desc),'[]'::jsonb)
 from (select * from tasks.items t where t.archived_at is null
  and (t.owner_user_id=p_actor_id and t.workspace_id is null or tasks.can_read(p_actor_id,t.id))
  and (p_status is null or t.status=p_status) order by t.updated_at desc
  limit least(greatest(p_limit,1),100) offset least(greatest(p_offset,0),100000)) t;
$function$;

-- public.task_create(p_actor_id uuid, p_data jsonb)
CREATE OR REPLACE FUNCTION public.task_create(p_actor_id uuid, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
end $function$;

-- public.task_update(p_actor_id uuid, p_id uuid, p_data jsonb)
CREATE OR REPLACE FUNCTION public.task_update(p_actor_id uuid, p_id uuid, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
end $function$;

-- public.task_archive(p_actor_id uuid, p_id uuid)
CREATE OR REPLACE FUNCTION public.task_archive(p_actor_id uuid, p_id uuid)
 RETURNS boolean
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 with changed as (update tasks.items set archived_at=now(),updated_at=now()
  where id=p_id and owner_user_id=p_actor_id and archived_at is null returning id)
 select exists(select 1 from changed);
$function$;

-- public.task_categories_list(p_actor_id uuid)
CREATE OR REPLACE FUNCTION public.task_categories_list(p_actor_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select coalesce(jsonb_agg(to_jsonb(c) order by c.name),'[]'::jsonb)
 from (select id,name,color,icon,created_at from tasks.categories
  where owner_user_id=p_actor_id and archived_at is null order by name) c;
$function$;

-- public.task_category_create(p_actor_id uuid, p_name text, p_color text, p_icon text)
CREATE OR REPLACE FUNCTION public.task_category_create(p_actor_id uuid, p_name text, p_color text, p_icon text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare result tasks.categories%rowtype;
begin
 insert into tasks.categories(owner_user_id,name,color,icon)
 values(p_actor_id,btrim(p_name),p_color,p_icon) returning * into result;
 return jsonb_build_object('id',result.id,'name',result.name,'color',result.color,'icon',result.icon,'created_at',result.created_at);
end $function$;

-- public.task_subtasks_list(p_actor_id uuid, p_task_id uuid)
CREATE OR REPLACE FUNCTION public.task_subtasks_list(p_actor_id uuid, p_task_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select case when tasks.can_read(p_actor_id,p_task_id) then coalesce((select jsonb_agg(to_jsonb(s) order by s.sort_order,s.created_at) from (
  select id,task_id,title,done,sort_order,created_at from tasks.subtasks where task_id=p_task_id) s),'[]'::jsonb) else '[]'::jsonb end;
$function$;

-- public.task_subtask_save(p_actor_id uuid, p_task_id uuid, p_id uuid, p_title text, p_done boolean)
CREATE OR REPLACE FUNCTION public.task_subtask_save(p_actor_id uuid, p_task_id uuid, p_id uuid, p_title text, p_done boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
end $function$;

-- public.task_subtask_delete(p_actor_id uuid, p_task_id uuid, p_id uuid)
CREATE OR REPLACE FUNCTION public.task_subtask_delete(p_actor_id uuid, p_task_id uuid, p_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare assignee uuid;
begin
 if not tasks.can_read(p_actor_id,p_task_id) then return false;end if;
 select assignee_user_id into assignee from tasks.items where id=p_task_id;
 if not tasks.can_edit(p_actor_id,p_task_id) and assignee is distinct from p_actor_id then return false;end if;
 delete from tasks.subtasks where id=p_id and task_id=p_task_id;
 return found;
end $function$;

-- public.task_reminder_process(p_limit integer)
CREATE OR REPLACE FUNCTION public.task_reminder_process(p_limit integer DEFAULT 100)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
end $function$;

-- public.task_preferences_get(p_actor_id uuid)
CREATE OR REPLACE FUNCTION public.task_preferences_get(p_actor_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select coalesce((select to_jsonb(p) from tasks.user_preferences p where p.user_id=p_actor_id),
 jsonb_build_object('user_id',p_actor_id,'timezone',coalesce((select timezone from public.profiles where id=p_actor_id),'Asia/Kolkata'),'week_starts_on',1,'focus_limit',3));
$function$;

-- public.task_preferences_save(p_actor_id uuid, p_timezone text, p_week_start smallint)
CREATE OR REPLACE FUNCTION public.task_preferences_save(p_actor_id uuid, p_timezone text, p_week_start smallint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare result tasks.user_preferences%rowtype;
begin
 insert into tasks.user_preferences(user_id,timezone,week_starts_on)
 values(p_actor_id,p_timezone,p_week_start)
 on conflict(user_id) do update set timezone=excluded.timezone,week_starts_on=excluded.week_starts_on,updated_at=now()
 returning * into result;
 return to_jsonb(result);
end $function$;

-- public.task_category_update(p_actor_id uuid, p_id uuid, p_name text, p_color text)
CREATE OR REPLACE FUNCTION public.task_category_update(p_actor_id uuid, p_id uuid, p_name text, p_color text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare result tasks.categories%rowtype;
begin
 update tasks.categories set name=btrim(p_name),color=p_color where owner_user_id=p_actor_id and id=p_id and archived_at is null returning * into result;
 return case when result.id is null then null else to_jsonb(result) end;
end $function$;

-- public.task_category_archive(p_actor_id uuid, p_id uuid)
CREATE OR REPLACE FUNCTION public.task_category_archive(p_actor_id uuid, p_id uuid)
 RETURNS boolean
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 with changed as (update tasks.categories set archived_at=now() where owner_user_id=p_actor_id and id=p_id and archived_at is null returning id)
 select exists(select 1 from changed);
$function$;

-- tasks.can_read(p_actor uuid, p_task uuid)
CREATE OR REPLACE FUNCTION tasks.can_read(p_actor uuid, p_task uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 select exists(select 1 from tasks.items t where t.id=p_task and t.archived_at is null and (
  (t.workspace_id is null and t.owner_user_id=p_actor)
  or (t.workspace_id is not null and exists(select 1 from tasks.workspace_members m where m.workspace_id=t.workspace_id and m.user_id=p_actor)
   and (t.owner_user_id=p_actor or t.assignee_user_id=p_actor or t.share_with_workspace
    or exists(select 1 from tasks.task_collaborators c where c.task_id=t.id and c.user_id=p_actor)))))
$function$;

-- tasks.can_edit(p_actor uuid, p_task uuid)
CREATE OR REPLACE FUNCTION tasks.can_edit(p_actor uuid, p_task uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 select exists(select 1 from tasks.items t where t.id=p_task and t.archived_at is null and (
  (t.workspace_id is null and t.owner_user_id=p_actor)
  or (t.workspace_id is not null and exists(select 1 from tasks.workspace_members m where m.workspace_id=t.workspace_id and m.user_id=p_actor)
   and (t.owner_user_id=p_actor or exists(select 1 from tasks.task_collaborators c where c.task_id=t.id and c.user_id=p_actor and c.permission='edit')))))
$function$;

-- public.task_access_check(p_actor_id uuid, p_task_id uuid)
CREATE OR REPLACE FUNCTION public.task_access_check(p_actor_id uuid, p_task_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select jsonb_build_object('read',tasks.can_read(p_actor_id,p_task_id),'edit',tasks.can_edit(p_actor_id,p_task_id),
 'owner',(select owner_user_id=p_actor_id from tasks.items where id=p_task_id));
$function$;

-- public.task_workspace_create(p_actor_id uuid, p_name text)
CREATE OR REPLACE FUNCTION public.task_workspace_create(p_actor_id uuid, p_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare w tasks.workspaces%rowtype;
begin
 insert into tasks.workspaces(name,owner_user_id) values(btrim(p_name),p_actor_id) returning * into w;
 insert into tasks.workspace_members(workspace_id,user_id,role) values(w.id,p_actor_id,'owner');
 return to_jsonb(w);
end $function$;

-- public.task_workspaces_list(p_actor_id uuid)
CREATE OR REPLACE FUNCTION public.task_workspaces_list(p_actor_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select coalesce(jsonb_agg(to_jsonb(w) order by w.name),'[]'::jsonb)
 from (select w.id,w.name,m.role,w.created_at from tasks.workspaces w join tasks.workspace_members m on m.workspace_id=w.id and m.user_id=p_actor_id where w.archived_at is null) w;
$function$;

-- public.task_workspace_members(p_actor_id uuid, p_workspace_id uuid)
CREATE OR REPLACE FUNCTION public.task_workspace_members(p_actor_id uuid, p_workspace_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select case when exists(select 1 from tasks.workspace_members where workspace_id=p_workspace_id and user_id=p_actor_id)
 then coalesce((select jsonb_agg(to_jsonb(v) order by v.role,v.full_name) from (
  select m.user_id,m.role,coalesce(p.full_name,'Member') as full_name from tasks.workspace_members m
  left join public.profiles p on p.id=m.user_id where m.workspace_id=p_workspace_id) v),'[]'::jsonb) else '[]'::jsonb end;
$function$;

-- public.task_invite_send(p_actor_id uuid, p_workspace_id uuid, p_email text, p_role text)
CREATE OR REPLACE FUNCTION public.task_invite_send(p_actor_id uuid, p_workspace_id uuid, p_email text, p_role text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare inv tasks.workspace_invitations%rowtype;
begin
 if not exists(select 1 from tasks.workspace_members where workspace_id=p_workspace_id and user_id=p_actor_id and role in ('owner','admin')) then raise exception 'Permission denied' using errcode='42501';end if;
 if p_role not in ('admin','member') or length(btrim(p_email)) not between 3 and 254 then raise exception 'Invalid invitation' using errcode='22023';end if;
 insert into tasks.workspace_invitations(workspace_id,email,role,invited_by)
 values(p_workspace_id,lower(btrim(p_email)),p_role,p_actor_id) returning * into inv;
 return jsonb_build_object('id',inv.id,'email',inv.email,'role',inv.role,'expires_at',inv.expires_at);
end $function$;

-- public.task_invitations_list(p_actor_id uuid, p_verified_email text)
CREATE OR REPLACE FUNCTION public.task_invitations_list(p_actor_id uuid, p_verified_email text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select coalesce(jsonb_agg(to_jsonb(i) order by i.created_at desc),'[]'::jsonb) from (
  select x.id,x.workspace_id,w.name as workspace_name,x.role,x.created_at,x.expires_at
  from tasks.workspace_invitations x join tasks.workspaces w on w.id=x.workspace_id
  where lower(x.email)=lower(p_verified_email) and x.accepted_at is null and x.revoked_at is null and x.expires_at>now()
    and w.archived_at is null and not exists(select 1 from tasks.workspace_members m where m.workspace_id=x.workspace_id and m.user_id=p_actor_id)) i;
$function$;

-- public.task_invite_accept(p_actor_id uuid, p_verified_email text, p_invitation_id uuid)
CREATE OR REPLACE FUNCTION public.task_invite_accept(p_actor_id uuid, p_verified_email text, p_invitation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
end $function$;

-- public.task_workspace_member_manage(p_actor_id uuid, p_workspace_id uuid, p_member_id uuid, p_action text, p_role text)
CREATE OR REPLACE FUNCTION public.task_workspace_member_manage(p_actor_id uuid, p_workspace_id uuid, p_member_id uuid, p_action text, p_role text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
end $function$;

-- public.task_workspace_task_create(p_actor_id uuid, p_workspace_id uuid, p_data jsonb)
CREATE OR REPLACE FUNCTION public.task_workspace_task_create(p_actor_id uuid, p_workspace_id uuid, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare result tasks.items%rowtype;
begin
 if not exists(select 1 from tasks.workspace_members m join tasks.workspaces w on w.id=m.workspace_id where m.workspace_id=p_workspace_id and m.user_id=p_actor_id and w.archived_at is null) then raise exception 'Not a workspace member' using errcode='42501';end if;
 insert into tasks.items(owner_user_id,created_by_user_id,workspace_id,title,description,status,priority,scheduled_date,due_at,reminder_at,recurrence,recurrence_series_id,recurrence_anchor_day,share_with_workspace)
 values(p_actor_id,p_actor_id,p_workspace_id,btrim(p_data->>'title'),coalesce(p_data->>'description',''),'todo',coalesce(p_data->>'priority','medium'),nullif(p_data->>'scheduled_date','')::date,nullif(p_data->>'due_at','')::timestamptz,nullif(p_data->>'reminder_at','')::timestamptz,coalesce(p_data->>'recurrence','none'),case when coalesce(p_data->>'recurrence','none')<>'none' then gen_random_uuid() else null end,case when coalesce(p_data->>'recurrence','none')<>'none' then extract(day from coalesce(nullif(p_data->>'scheduled_date','')::date,current_date))::smallint else null end,coalesce((p_data->>'share_with_workspace')::boolean,false)) returning * into result;
 insert into tasks.activity(task_id,actor_user_id,action) values(result.id,p_actor_id,'created');
 return to_jsonb(result);
end $function$;

-- public.task_share(p_actor_id uuid, p_task_id uuid, p_workspace_id uuid, p_assignee_id uuid, p_workspace_visible boolean)
CREATE OR REPLACE FUNCTION public.task_share(p_actor_id uuid, p_task_id uuid, p_workspace_id uuid, p_assignee_id uuid, p_workspace_visible boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
end $function$;

-- public.task_collaborator_manage(p_actor_id uuid, p_task_id uuid, p_user_id uuid, p_permission text)
CREATE OR REPLACE FUNCTION public.task_collaborator_manage(p_actor_id uuid, p_task_id uuid, p_user_id uuid, p_permission text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare w uuid;
begin
 select workspace_id into w from tasks.items where id=p_task_id and owner_user_id=p_actor_id and archived_at is null;
 if w is null or p_user_id=p_actor_id then return false;end if;
 if p_permission is null then delete from tasks.task_collaborators where task_id=p_task_id and user_id=p_user_id;return found;end if;
 if p_permission not in ('view','edit') or not exists(select 1 from tasks.workspace_members where workspace_id=w and user_id=p_user_id) then return false;end if;
 insert into tasks.task_collaborators(task_id,user_id,permission,granted_by) values(p_task_id,p_user_id,p_permission,p_actor_id)
 on conflict(task_id,user_id) do update set permission=excluded.permission,granted_by=excluded.granted_by,granted_at=now();
 return true;
end $function$;

-- public.task_collaborators_list(p_actor_id uuid, p_task_id uuid)
CREATE OR REPLACE FUNCTION public.task_collaborators_list(p_actor_id uuid, p_task_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select case when tasks.can_read(p_actor_id,p_task_id) then coalesce((select jsonb_agg(to_jsonb(v)) from (
  select c.user_id,c.permission,coalesce(p.full_name,'Member') as full_name from tasks.task_collaborators c left join public.profiles p on p.id=c.user_id where c.task_id=p_task_id) v),'[]'::jsonb) else '[]'::jsonb end;
$function$;

-- public.task_comments_list(p_actor_id uuid, p_task_id uuid)
CREATE OR REPLACE FUNCTION public.task_comments_list(p_actor_id uuid, p_task_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select case when tasks.can_read(p_actor_id,p_task_id) then coalesce((select jsonb_agg(to_jsonb(v) order by v.created_at) from (
  select c.id,c.body,c.created_at,c.edited_at,c.author_user_id,coalesce(p.full_name,'Member') as author_name
  from tasks.comments c left join public.profiles p on p.id=c.author_user_id where c.task_id=p_task_id order by c.created_at) v),'[]'::jsonb) else '[]'::jsonb end;
$function$;

-- public.task_comment_add(p_actor_id uuid, p_task_id uuid, p_body text)
CREATE OR REPLACE FUNCTION public.task_comment_add(p_actor_id uuid, p_task_id uuid, p_body text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare comment tasks.comments%rowtype;
begin
 if not tasks.can_read(p_actor_id,p_task_id) then raise exception 'Not authorized' using errcode='42501';end if;
 insert into tasks.comments(task_id,author_user_id,body) values(p_task_id,p_actor_id,btrim(p_body)) returning * into comment;
 insert into tasks.activity(task_id,actor_user_id,action) values(p_task_id,p_actor_id,'commented');
 return to_jsonb(comment);
end $function$;

-- public.task_activity_list(p_actor_id uuid, p_task_id uuid)
CREATE OR REPLACE FUNCTION public.task_activity_list(p_actor_id uuid, p_task_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select case when tasks.can_read(p_actor_id,p_task_id) then coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from (
  select id,actor_user_id,action,details,created_at from tasks.activity where task_id=p_task_id order by created_at desc limit 100) a),'[]'::jsonb) else '[]'::jsonb end;
$function$;

-- public.task_attachments_list(p_actor_id uuid, p_task_id uuid)
CREATE OR REPLACE FUNCTION public.task_attachments_list(p_actor_id uuid, p_task_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select case when tasks.can_read(p_actor_id,p_task_id) then coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from (
  select id,file_name,mime_type,byte_size,uploaded_by,created_at from tasks.attachments where task_id=p_task_id) a),'[]'::jsonb) else '[]'::jsonb end;
$function$;

-- public.task_attachment_add(p_actor_id uuid, p_task_id uuid, p_path text, p_name text, p_mime text, p_size integer)
CREATE OR REPLACE FUNCTION public.task_attachment_add(p_actor_id uuid, p_task_id uuid, p_path text, p_name text, p_mime text, p_size integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare file tasks.attachments%rowtype;
begin
 if not tasks.can_read(p_actor_id,p_task_id) then raise exception 'Not authorized' using errcode='42501';end if;
 insert into tasks.attachments(task_id,uploaded_by,storage_path,file_name,mime_type,byte_size)
 values(p_task_id,p_actor_id,p_path,p_name,p_mime,p_size) returning * into file;
 insert into tasks.activity(task_id,actor_user_id,action,details) values(p_task_id,p_actor_id,'attachment_added',jsonb_build_object('file_name',p_name));
 return jsonb_build_object('id',file.id,'file_name',file.file_name,'byte_size',file.byte_size);
end $function$;

-- public.task_attachment_lookup(p_actor_id uuid, p_task_id uuid, p_attachment_id uuid)
CREATE OR REPLACE FUNCTION public.task_attachment_lookup(p_actor_id uuid, p_task_id uuid, p_attachment_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select case when tasks.can_read(p_actor_id,p_task_id) then (select to_jsonb(a) from (
  select id,storage_path,file_name,mime_type,byte_size,uploaded_by from tasks.attachments where id=p_attachment_id and task_id=p_task_id) a) else null end;
$function$;

-- public.task_attachment_remove(p_actor_id uuid, p_task_id uuid, p_attachment_id uuid)
CREATE OR REPLACE FUNCTION public.task_attachment_remove(p_actor_id uuid, p_task_id uuid, p_attachment_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare path text;
begin
 if not tasks.can_read(p_actor_id,p_task_id) then return null;end if;
 delete from tasks.attachments where id=p_attachment_id and task_id=p_task_id and (uploaded_by=p_actor_id or exists(select 1 from tasks.items where id=p_task_id and owner_user_id=p_actor_id)) returning storage_path into path;
 if path is not null then insert into tasks.activity(task_id,actor_user_id,action) values(p_task_id,p_actor_id,'attachment_removed');end if;
 return path;
end $function$;

-- tasks.prevent_module_link_sharing()
CREATE OR REPLACE FUNCTION tasks.prevent_module_link_sharing()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if new.workspace_id is distinct from old.workspace_id and new.workspace_id is not null
  and exists(select 1 from tasks.module_links l where l.task_id=old.id) then
  raise exception 'Linked module tasks must remain personal' using errcode='42501';
 end if;
 return new;
end $function$;

-- public.task_module_link(p_actor_id uuid, p_module text, p_resource text, p_resource_id uuid, p_tenant_id uuid)
CREATE OR REPLACE FUNCTION public.task_module_link(p_actor_id uuid, p_module text, p_resource text, p_resource_id uuid, p_tenant_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
end $function$;

-- public.task_module_links_list(p_actor_id uuid, p_module text, p_tenant_id uuid)
CREATE OR REPLACE FUNCTION public.task_module_links_list(p_actor_id uuid, p_module text DEFAULT NULL::text, p_tenant_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 select coalesce(jsonb_agg(jsonb_build_object('task_id',l.task_id,'module',l.module,'resource',l.resource,
   'resource_id',l.resource_id,'tenant_id',l.tenant_id,'title',t.title,'status',t.status,'due_at',t.due_at)
   order by t.updated_at desc),'[]'::jsonb)
 from tasks.module_links l join tasks.items t on t.id=l.task_id
 where l.owner_user_id=p_actor_id and t.archived_at is null and t.workspace_id is null
  and (p_module is null or l.module=p_module) and (p_tenant_id is null or l.tenant_id=p_tenant_id)
  and (l.module<>'connect' or exists(select 1 from connect.memberships m where m.tenant_id=l.tenant_id and m.user_id=p_actor_id and m.status='active'))
  and (l.module<>'learning' or exists(select 1 from public.profiles p where p.id=p_actor_id and p.active=true and p.role='admin')
    or exists(select 1 from public.schedule_events e join public.trainers tr on tr.id=e.trainer_id where e.id=l.resource_id and tr.profile_id=p_actor_id and tr.record_status='active'));
$function$;

-- tasks.sync_crm_task_status()
CREATE OR REPLACE FUNCTION tasks.sync_crm_task_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
end $function$;

-- tasks.sync_imported_from_crm()
CREATE OR REPLACE FUNCTION tasks.sync_imported_from_crm()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if new.status is distinct from old.status and new.status in ('done','open') then
  update tasks.items t set status=case when new.status='done' then 'done' else 'todo' end,
   completed_at=case when new.status='done' then now() else null end,updated_at=now()
  from tasks.module_links l join connect.memberships m on m.tenant_id=l.tenant_id and m.user_id=l.owner_user_id and m.status='active'
  where l.task_id=t.id and l.module='connect' and l.resource='crm_task' and l.resource_id=new.id and l.tenant_id=new.tenant_id
   and t.archived_at is null and t.status<>case when new.status='done' then 'done' else 'todo' end;
 end if;
 return new;
end $function$;

-- public.task_account_get(p_actor_id uuid)
CREATE OR REPLACE FUNCTION public.task_account_get(p_actor_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 select (select to_jsonb(a) from tasks.accounts a where a.user_id=p_actor_id);
$function$;

-- public.task_account_activate(p_actor_id uuid, p_display_name text)
CREATE OR REPLACE FUNCTION public.task_account_activate(p_actor_id uuid, p_display_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
end $function$;

-- public.task_bulk_import(p_actor_id uuid, p_rows jsonb)
CREATE OR REPLACE FUNCTION public.task_bulk_import(p_actor_id uuid, p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
end $function$;

-- public.task_account_metrics(p_actor_id uuid)
CREATE OR REPLACE FUNCTION public.task_account_metrics(p_actor_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 select jsonb_build_object(
  'personal_tasks',(select count(*) from tasks.items where owner_user_id=p_actor_id and workspace_id is null and archived_at is null),
  'open_tasks',(select count(*) from tasks.items where owner_user_id=p_actor_id and archived_at is null and status<>'done'),
  'workspaces',(select count(*) from tasks.workspace_members m where m.user_id=p_actor_id),
  'linked_records',(select count(*) from tasks.module_links where owner_user_id=p_actor_id),
  'account',(select to_jsonb(a) from tasks.accounts a where a.user_id=p_actor_id));
$function$;

-- public.task_notifications_list(p_actor_id uuid, p_limit integer)
CREATE OR REPLACE FUNCTION public.task_notifications_list(p_actor_id uuid, p_limit integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 select coalesce(jsonb_agg(to_jsonb(n) order by n.created_at desc),'[]'::jsonb)
 from (select id,kind,title,href,created_at,read_at from tasks.notifications
  where recipient_user_id=p_actor_id order by created_at desc limit least(greatest(p_limit,1),100)) n;
$function$;

-- public.task_notification_read(p_actor_id uuid, p_id uuid)
CREATE OR REPLACE FUNCTION public.task_notification_read(p_actor_id uuid, p_id uuid)
 RETURNS boolean
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 with changed as (update tasks.notifications set read_at=coalesce(read_at,now())
 where id=p_id and recipient_user_id=p_actor_id returning id) select exists(select 1 from changed);
$function$;

-- tasks.notify_task_assignee()
CREATE OR REPLACE FUNCTION tasks.notify_task_assignee()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if new.assignee_user_id is not null and new.assignee_user_id is distinct from old.assignee_user_id
  and exists(select 1 from tasks.workspace_members where workspace_id=new.workspace_id and user_id=new.assignee_user_id) then
  insert into tasks.notifications(recipient_user_id,task_id,kind,title,href,dedupe_key)
   values(new.assignee_user_id,new.id,'assignment','A new task was assigned to you','/tasks/assigned?task='||new.id,
    'assignment:'||new.id::text||':'||new.assignee_user_id::text)
   on conflict(recipient_user_id,dedupe_key) do update set read_at=null,created_at=now();
 end if;
 return new;
end $function$;

-- public.task_v2_areas_list(p_actor_id uuid)
CREATE OR REPLACE FUNCTION public.task_v2_areas_list(p_actor_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select coalesce(jsonb_agg(to_jsonb(a) order by a.sort_order,a.name),'[]'::jsonb)
 from tasks.areas a where a.owner_user_id=p_actor_id and a.archived_at is null;
$function$;

-- public.task_v2_area_save(p_actor_id uuid, p_data jsonb)
CREATE OR REPLACE FUNCTION public.task_v2_area_save(p_actor_id uuid, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
end $function$;

-- public.task_v2_projects_list(p_actor_id uuid)
CREATE OR REPLACE FUNCTION public.task_v2_projects_list(p_actor_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select coalesce(jsonb_agg(to_jsonb(p) order by p.sort_order,p.name),'[]'::jsonb)
 from tasks.projects p where p.owner_user_id=p_actor_id and p.archived_at is null;
$function$;

-- public.task_v2_project_save(p_actor_id uuid, p_data jsonb)
CREATE OR REPLACE FUNCTION public.task_v2_project_save(p_actor_id uuid, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
end $function$;

-- public.task_v2_patch(p_actor_id uuid, p_task_id uuid, p_data jsonb)
CREATE OR REPLACE FUNCTION public.task_v2_patch(p_actor_id uuid, p_task_id uuid, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
end $function$;

-- public.task_v2_capture(p_actor_id uuid, p_data jsonb)
CREATE OR REPLACE FUNCTION public.task_v2_capture(p_actor_id uuid, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare created jsonb; extras jsonb;
begin
 if p_actor_id is null then raise exception 'Invalid account'; end if;
 -- The server verifies the bearer token and account before calling this
 -- service_role-only RPC. Do not query auth.users from service_role.
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
 update tasks.items t set board_rank=(
   select coalesce(max(i.board_rank),0)+1024 from tasks.items i
   where i.owner_user_id=p_actor_id and i.status=t.status and i.archived_at is null and i.id<>t.id
 ) where t.id=(created->>'id')::uuid returning to_jsonb(t) into created;
 return created;
end $function$;

-- public.task_v2_board_move(p_actor_id uuid, p_task_id uuid, p_status text, p_group_by text, p_group_id uuid, p_position integer)
CREATE OR REPLACE FUNCTION public.task_v2_board_move(p_actor_id uuid, p_task_id uuid, p_status text, p_group_by text DEFAULT 'status'::text, p_group_id uuid DEFAULT NULL::uuid, p_position integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
end $function$;

-- public.task_v2_detail_save(p_actor_id uuid, p_task_id uuid, p_data jsonb)
CREATE OR REPLACE FUNCTION public.task_v2_detail_save(p_actor_id uuid, p_task_id uuid, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
end $function$;

-- public.task_v2_board_list(p_actor_id uuid, p_limit integer, p_offset integer)
CREATE OR REPLACE FUNCTION public.task_v2_board_list(p_actor_id uuid, p_limit integer DEFAULT 250, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
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
$function$;

-- public.task_v2_focus_get(p_actor_id uuid)
CREATE OR REPLACE FUNCTION public.task_v2_focus_get(p_actor_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
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
$function$;

-- public.task_v2_focus_action(p_actor_id uuid, p_action text, p_data jsonb)
CREATE OR REPLACE FUNCTION public.task_v2_focus_action(p_actor_id uuid, p_action text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
end $function$;

-- public.task_v2_idea_action(p_actor_id uuid, p_action text, p_data jsonb)
CREATE OR REPLACE FUNCTION public.task_v2_idea_action(p_actor_id uuid, p_action text, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
end $function$;

-- public.task_v2_focus_settings_save(p_actor_id uuid, p_limit integer, p_minutes integer, p_switch boolean)
CREATE OR REPLACE FUNCTION public.task_v2_focus_settings_save(p_actor_id uuid, p_limit integer, p_minutes integer, p_switch boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare r tasks.focus_settings%rowtype;
begin
 if p_limit not between 1 and 10 or p_minutes not between 30 and 600 or p_switch is null then raise exception 'Invalid focus settings';end if;
 insert into tasks.focus_settings(owner_user_id,active_project_limit,daily_focus_minutes,switch_prompt_enabled)
 values(p_actor_id,p_limit,p_minutes,p_switch)
 on conflict(owner_user_id) do update set active_project_limit=excluded.active_project_limit,
 daily_focus_minutes=excluded.daily_focus_minutes,switch_prompt_enabled=excluded.switch_prompt_enabled,updated_at=now()
 returning * into r;
 return to_jsonb(r);
end $function$;

-- public.task_v2_commitment_save(p_actor_id uuid, p_area_id uuid, p_target integer)
CREATE OR REPLACE FUNCTION public.task_v2_commitment_save(p_actor_id uuid, p_area_id uuid, p_target integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
end $function$;

-- public.task_v2_plan_move(p_actor_id uuid, p_task_ids uuid[], p_action text, p_date date)
CREATE OR REPLACE FUNCTION public.task_v2_plan_move(p_actor_id uuid, p_task_ids uuid[], p_action text, p_date date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
end $function$;

-- public.task_v2_matrix_set(p_actor_id uuid, p_task_id uuid, p_important boolean, p_urgent boolean)
CREATE OR REPLACE FUNCTION public.task_v2_matrix_set(p_actor_id uuid, p_task_id uuid, p_important boolean, p_urgent boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare result jsonb;
begin
 if p_important is null or p_urgent is null then raise exception 'Both decisions are required';end if;
 update tasks.items t set important=p_important,urgent=p_urgent,updated_at=now()
 where t.owner_user_id=p_actor_id and t.id=p_task_id and t.archived_at is null and t.status<>'done'
 returning to_jsonb(t) into result;
 return result;
end $function$;

-- tasks.v2_inherit_recurring_context()
CREATE OR REPLACE FUNCTION tasks.v2_inherit_recurring_context()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
end $function$;

-- Restrict private module RPCs to trusted server credentials.
DO $task_rpc_acl$ DECLARE r record; BEGIN FOR r IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='tasks' OR (n.nspname='public' AND p.proname LIKE 'task_%') LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',r.oid::regprocedure); EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',r.oid::regprocedure); END LOOP; END $task_rpc_acl$;
COMMIT;
