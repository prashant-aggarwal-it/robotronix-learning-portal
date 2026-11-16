-- Phase 3 service-only commands. Depends on 04_collaboration_foundation.sql.
begin;
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
commit;
