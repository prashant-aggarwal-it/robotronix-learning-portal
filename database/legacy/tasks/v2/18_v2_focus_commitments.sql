-- Phase 4 addition: optional weekly Area commitments (rolling seven days).
-- Development only; no automatic enforcement or punitive streaks.
begin;
create table tasks.focus_commitments(
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 area_id uuid not null,
 target_sessions smallint not null check(target_sessions between 1 and 14),
 updated_at timestamptz not null default now(),
 primary key(owner_user_id,area_id),
 constraint focus_commitment_owned_area foreign key(owner_user_id,area_id)
 references tasks.areas(owner_user_id,id) on delete cascade
);
alter table tasks.focus_commitments enable row level security;
revoke all on tasks.focus_commitments from public,anon,authenticated;
grant select,insert,update,delete on tasks.focus_commitments to service_role;

create function public.task_v2_commitment_save(p_actor_id uuid,p_area_id uuid,p_target integer)
returns jsonb language plpgsql set search_path to '' as $$
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
end $$;

create or replace function public.task_v2_focus_get(p_actor_id uuid) returns jsonb
language sql set search_path to '' as $$
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
$$;
revoke all on function public.task_v2_commitment_save(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.task_v2_commitment_save(uuid,uuid,integer) to service_role;
commit;