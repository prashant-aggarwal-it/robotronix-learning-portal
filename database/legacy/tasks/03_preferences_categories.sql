-- Phase 2 refinements. Apply once after 02_personal_workspace.sql.
begin;
create function public.task_preferences_get(p_actor_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select coalesce((select to_jsonb(p) from tasks.user_preferences p where p.user_id=p_actor_id),
 jsonb_build_object('user_id',p_actor_id,'timezone',coalesce((select timezone from public.profiles where id=p_actor_id),'Asia/Kolkata'),'week_starts_on',1,'focus_limit',3));
$$;
create function public.task_preferences_save(p_actor_id uuid,p_timezone text,p_week_start smallint)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result tasks.user_preferences%rowtype;
begin
 insert into tasks.user_preferences(user_id,timezone,week_starts_on)
 values(p_actor_id,p_timezone,p_week_start)
 on conflict(user_id) do update set timezone=excluded.timezone,week_starts_on=excluded.week_starts_on,updated_at=now()
 returning * into result;
 return to_jsonb(result);
end $$;
create function public.task_category_update(p_actor_id uuid,p_id uuid,p_name text,p_color text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result tasks.categories%rowtype;
begin
 update tasks.categories set name=btrim(p_name),color=p_color where owner_user_id=p_actor_id and id=p_id and archived_at is null returning * into result;
 return case when result.id is null then null else to_jsonb(result) end;
end $$;
create function public.task_category_archive(p_actor_id uuid,p_id uuid)
returns boolean language sql security invoker set search_path='' as $$
 with changed as (update tasks.categories set archived_at=now() where owner_user_id=p_actor_id and id=p_id and archived_at is null returning id)
 select exists(select 1 from changed);
$$;
revoke all on function public.task_preferences_get(uuid),public.task_preferences_save(uuid,text,smallint),public.task_category_update(uuid,uuid,text,text),public.task_category_archive(uuid,uuid) from public,anon,authenticated;
grant execute on function public.task_preferences_get(uuid),public.task_preferences_save(uuid,text,smallint),public.task_category_update(uuid,uuid,text,text),public.task_category_archive(uuid,uuid) to service_role;
commit;
