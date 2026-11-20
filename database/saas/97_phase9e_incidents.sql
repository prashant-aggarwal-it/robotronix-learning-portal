create table if not exists saas.platform_incidents (
 id uuid primary key default gen_random_uuid(),
 fingerprint text not null,
 title text not null,
 category text not null check(category in ('security','email','worker','api','billing','integration','other')),
 severity text not null check(severity in ('critical','warning','info')),
 status text not null default 'open' check(status in ('open','acknowledged','resolved')),
 organization_id uuid null,
 source text not null default 'manual' check(source in ('manual','monitor')),
 occurrences integer not null default 1,
 first_seen_at timestamptz not null default now(),
 last_seen_at timestamptz not null default now(),
 acknowledged_at timestamptz,
 acknowledged_by uuid,
 resolved_at timestamptz,
 resolved_by uuid
);
create unique index if not exists platform_incidents_open_fingerprint_idx on saas.platform_incidents(fingerprint) where status<>'resolved';
create index if not exists platform_incidents_recent_idx on saas.platform_incidents(last_seen_at desc);
create table if not exists saas.platform_incident_history (
 id bigint generated always as identity primary key,
 incident_id uuid not null references saas.platform_incidents(id) on delete restrict,
 actor_user_id uuid not null,
 action text not null check(action in ('created','repeated','acknowledged','resolved','reopened')),
 occurred_at timestamptz not null default now()
);
create index if not exists platform_incident_history_incident_idx on saas.platform_incident_history(incident_id,occurred_at desc);
alter table saas.platform_incidents enable row level security;
alter table saas.platform_incident_history enable row level security;
revoke all on saas.platform_incidents,saas.platform_incident_history from public,anon,authenticated;
grant select,insert,update on saas.platform_incidents to service_role;
grant select,insert on saas.platform_incident_history to service_role;
grant usage,select on sequence saas.platform_incident_history_id_seq to service_role;
create or replace function public.saas_platform_incidents_v1(p_actor uuid,p_action text,p_id uuid default null,p_fingerprint text default null,p_title text default null,p_category text default null,p_severity text default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_id uuid; v_old_status text; v_event text;
begin
 if not public.saas_is_platform_admin_v1(p_actor) then raise exception 'Not authorized' using errcode='42501'; end if;
 if p_action='list' then
  return jsonb_build_object('incidents',coalesce((select jsonb_agg(to_jsonb(i)) from
   (select id,fingerprint,title,category,severity,status,organization_id,source,occurrences,first_seen_at,last_seen_at,acknowledged_at,resolved_at from saas.platform_incidents order by last_seen_at desc limit 100) i),'[]'::jsonb),
   'history',coalesce((select jsonb_agg(to_jsonb(h)) from
   (select incident_id,action,occurred_at from saas.platform_incident_history order by occurred_at desc limit 100) h),'[]'::jsonb),
   'truncated',(select count(*)>100 from saas.platform_incidents));
 elsif p_action='create' then
  if p_title is null or length(trim(p_title)) not between 5 and 120 or p_category not in ('security','email','worker','api','billing','integration','other') or p_severity not in ('critical','warning','info')
     or p_fingerprint is null or length(p_fingerprint) not between 8 and 100 or p_fingerprint !~ '^[a-z0-9_:-]+$' then
   raise exception 'Invalid incident' using errcode='22023';
  end if;
  insert into saas.platform_incidents(fingerprint,title,category,severity)
   values(p_fingerprint,trim(p_title),p_category,p_severity)
   on conflict(fingerprint) where status<>'resolved' do update set occurrences=saas.platform_incidents.occurrences+1,last_seen_at=now()
   returning id into v_id;
  insert into saas.platform_incident_history(incident_id,actor_user_id,action) values(v_id,p_actor,'created');
  return jsonb_build_object('id',v_id);
 elsif p_action in ('acknowledge','resolve') then
  select status into v_old_status from saas.platform_incidents where id=p_id for update;
  if v_old_status is null then raise exception 'Incident not found' using errcode='22023'; end if;
  if v_old_status='resolved' then raise exception 'Incident already resolved' using errcode='22023'; end if;
  if p_action='acknowledge' and v_old_status='acknowledged' then return jsonb_build_object('id',p_id,'unchanged',true); end if;
  update saas.platform_incidents set status=case when p_action='resolve' then 'resolved' else 'acknowledged' end,
   acknowledged_at=case when p_action='acknowledge' then now() else acknowledged_at end,
   acknowledged_by=case when p_action='acknowledge' then p_actor else acknowledged_by end,
   resolved_at=case when p_action='resolve' then now() else null end,
   resolved_by=case when p_action='resolve' then p_actor else null end
   where id=p_id;
  insert into saas.platform_incident_history(incident_id,actor_user_id,action)values(p_id,p_actor,case when p_action='resolve' then 'resolved' else 'acknowledged' end);
  return jsonb_build_object('id',p_id);
 end if;
 raise exception 'Unsupported action' using errcode='22023';
end $$;
revoke all on function public.saas_platform_incidents_v1(uuid,text,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.saas_platform_incidents_v1(uuid,text,uuid,text,text,text,text) to service_role;