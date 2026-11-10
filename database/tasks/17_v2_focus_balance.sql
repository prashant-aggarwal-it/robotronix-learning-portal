-- My Tasks 2.0 / Phase 4: Focus Balance, timeboxing, finish decisions and idea parking.
-- Development project fflejkqcspivnhsmkdtn ONLY. No existing Tasks/CRM data modified.
begin;
create table tasks.focus_sessions(
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 task_id uuid not null,
 mode text not null default 'timebox' check(mode in('timebox','pomodoro','stopwatch','five_minutes')),
 state text not null default 'running' check(state in('running','paused','ended')),
 planned_minutes integer not null check(planned_minutes between 5 and 240),
 elapsed_seconds integer not null default 0 check(elapsed_seconds between 0 and 604800),
 started_at timestamptz not null default now(),
 resumed_at timestamptz not null default now(),
 ended_at timestamptz,
 outcome text check(outcome in ('completed','parked','stopped')),
 extension_count smallint not null default 0 check(extension_count between 0 and 50),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint focus_task_owner foreign key(owner_user_id,task_id) references tasks.items(owner_user_id,id) on delete cascade,
 constraint focus_end_consistency check((state='ended')=(ended_at is not null))
);
create unique index focus_one_active_session on tasks.focus_sessions(owner_user_id) where state in('running','paused');
create index focus_owner_history on tasks.focus_sessions(owner_user_id,created_at desc);
create index focus_task_history on tasks.focus_sessions(task_id,started_at desc);

create table tasks.parked_ideas(
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 source_task_id uuid,
 title text not null check(char_length(btrim(title)) between 1 and 300),
 state text not null default 'inbox' check(state in('inbox','converted','dismissed')),
 converted_task_id uuid,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint parked_source_owner foreign key(owner_user_id,source_task_id) references tasks.items(owner_user_id,id) on delete set null,
 constraint parked_converted_owner foreign key(owner_user_id,converted_task_id) references tasks.items(owner_user_id,id) on delete set null
);
create index parked_owner_inbox on tasks.parked_ideas(owner_user_id,created_at desc) where state='inbox';

create table tasks.focus_settings(
 owner_user_id uuid primary key references auth.users(id) on delete cascade,
 active_project_limit smallint not null default 2 check(active_project_limit between 1 and 10),
 daily_focus_minutes smallint not null default 180 check(daily_focus_minutes between 30 and 600),
 switch_prompt_enabled boolean not null default true,
 updated_at timestamptz not null default now()
);

alter table tasks.focus_sessions enable row level security;
alter table tasks.parked_ideas enable row level security;
alter table tasks.focus_settings enable row level security;
revoke all on tasks.focus_sessions,tasks.parked_ideas,tasks.focus_settings from public,anon,authenticated;
grant select,insert,update,delete on tasks.focus_sessions,tasks.parked_ideas,tasks.focus_settings to service_role;

create function public.task_v2_focus_get(p_actor_id uuid) returns jsonb
language sql set search_path to '' as $$
 select jsonb_build_object(
  'active',(select to_jsonb(s) from tasks.focus_sessions s where s.owner_user_id=p_actor_id and s.state in('running','paused') order by s.created_at desc limit 1),
  'settings',coalesce((select to_jsonb(x) from tasks.focus_settings x where x.owner_user_id=p_actor_id),
   '{"active_project_limit":2,"daily_focus_minutes":180,"switch_prompt_enabled":true}'::jsonb),
  'ideas',coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at desc) from
   (select * from tasks.parked_ideas where owner_user_id=p_actor_id and state='inbox' order by created_at desc limit 100) i),'[]'::jsonb),
  'history',coalesce((select jsonb_agg(to_jsonb(h) order by h.created_at desc) from
   (select * from tasks.focus_sessions where owner_user_id=p_actor_id and state='ended' order by created_at desc limit 30) h),'[]'::jsonb)
 );
$$;

create function public.task_v2_focus_action(
 p_actor_id uuid,p_action text,p_data jsonb default '{}'::jsonb
) returns jsonb language plpgsql set search_path to '' as $$
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
end $$;

create function public.task_v2_idea_action(
 p_actor_id uuid,p_action text,p_data jsonb
) returns jsonb language plpgsql set search_path to '' as $$
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
end $$;

create function public.task_v2_focus_settings_save(
 p_actor_id uuid,p_limit integer,p_minutes integer,p_switch boolean
) returns jsonb language plpgsql set search_path to '' as $$
declare r tasks.focus_settings%rowtype;
begin
 if p_limit not between 1 and 10 or p_minutes not between 30 and 600 or p_switch is null then raise exception 'Invalid focus settings';end if;
 insert into tasks.focus_settings(owner_user_id,active_project_limit,daily_focus_minutes,switch_prompt_enabled)
 values(p_actor_id,p_limit,p_minutes,p_switch)
 on conflict(owner_user_id) do update set active_project_limit=excluded.active_project_limit,
 daily_focus_minutes=excluded.daily_focus_minutes,switch_prompt_enabled=excluded.switch_prompt_enabled,updated_at=now()
 returning * into r;
 return to_jsonb(r);
end $$;

revoke all on function public.task_v2_focus_get(uuid),public.task_v2_focus_action(uuid,text,jsonb),
 public.task_v2_idea_action(uuid,text,jsonb),public.task_v2_focus_settings_save(uuid,integer,integer,boolean) from public,anon,authenticated;
grant execute on function public.task_v2_focus_get(uuid),public.task_v2_focus_action(uuid,text,jsonb),
 public.task_v2_idea_action(uuid,text,jsonb),public.task_v2_focus_settings_save(uuid,integer,integer,boolean) to service_role;
commit;
