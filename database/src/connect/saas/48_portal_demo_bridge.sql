-- Phase B: optional, tenant-scoped mapping to the Portal demo domain.
-- No cross-product FK: Connect and Portal can move to separate databases later.
create table if not exists connect.portal_demo_integrations (
 tenant_id uuid primary key references connect.tenants(id) on delete restrict,
 status text not null default 'active' check(status in ('active','disabled')),
 installed_by uuid not null references auth.users(id),
 installed_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists connect.portal_demo_links (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references connect.tenants(id) on delete restrict,
 request_id uuid not null,
 payload_hash text not null,
 opportunity_id uuid not null,
 person_id uuid not null,
 portal_session_id uuid,
 portal_schedule_event_id uuid,
 portal_participant_id uuid,
 status text not null default 'requested' check(status in ('requested','provisioning','scheduled','cancelled','failed')),
 version integer not null default 1 check(version>0),
 failure_code text,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key(tenant_id,opportunity_id) references connect.opportunities(tenant_id,id) on delete restrict,
 foreign key(tenant_id,person_id) references connect.people(tenant_id,id) on delete restrict,
 unique(tenant_id,request_id),unique(tenant_id,portal_session_id)
);
create index if not exists portal_demo_links_tenant_opportunity_idx
 on connect.portal_demo_links(tenant_id,opportunity_id,created_at desc);
alter table connect.portal_demo_integrations enable row level security;
alter table connect.portal_demo_links enable row level security;
revoke all on connect.portal_demo_integrations,connect.portal_demo_links from public,anon,authenticated;
grant select,insert,update on connect.portal_demo_integrations,connect.portal_demo_links to service_role;

-- A database-serialized slot reservation prevents simultaneous conflicting bookings.
-- Existing Portal schedule entries remain the authoritative availability source.
create or replace function public.portal_demo_reserve_slot(
 p_trainer_id uuid,p_title text,p_date date,p_start time,p_end time,p_timezone text,p_mode text
) returns uuid language plpgsql security invoker set search_path to '' as $fn$
declare v_id uuid;v_start timestamptz;v_end timestamptz;
begin
 if p_trainer_id is null or p_title is null or length(btrim(p_title)) not between 1 and 160
   or p_date is null or p_start is null or p_end is null or p_start>=p_end
   or p_mode not in ('one_to_one','small_group') then
  raise exception 'Invalid demo slot' using errcode='22023';
 end if;
 if not exists(select 1 from public.trainers where id=p_trainer_id) then
  raise exception 'Trainer is unavailable' using errcode='22023';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_trainer_id::text,0));
 v_start:=(p_date+p_start) at time zone p_timezone;
 v_end:=(p_date+p_end) at time zone p_timezone;
 if v_start < now() or v_end<=v_start then raise exception 'Demo slot is no longer available' using errcode='22023';end if;
 if exists (
  select 1 from public.schedule_events e
  where e.trainer_id=p_trainer_id and e.status not in ('cancelled','rescheduled')
    and (e.date+e.start_time) at time zone e.timezone < v_end
    and (e.date+e.end_time) at time zone e.timezone > v_start
 ) then raise exception 'Demo slot is already booked' using errcode='23P01';end if;
 insert into public.schedule_events(trainer_id,title,date,start_time,end_time,timezone,event_type,delivery_mode,status,notes)
 values(p_trainer_id,p_title,p_date,p_start,p_end,p_timezone,'demo',p_mode,'scheduled','Connect CRM demo booking')
 returning id into v_id;
 return v_id;
end $fn$;
revoke all on function public.portal_demo_reserve_slot(uuid,text,date,time,time,text,text) from public,anon,authenticated;
grant execute on function public.portal_demo_reserve_slot(uuid,text,date,time,time,text,text) to service_role;

