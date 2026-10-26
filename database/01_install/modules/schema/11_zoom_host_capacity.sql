-- Zoom Classroom V2: reserve connected host capacity for online classes at booking time.
-- Canonical fresh-install feature module. Never apply the fresh installer to an existing DB.
begin;
create extension if not exists btree_gist;
create table if not exists public.zoom_class_host_reservations(
 schedule_event_id uuid primary key references public.schedule_events(id) on delete cascade,
 host_account_id uuid references public.zoom_host_accounts(id) on delete restrict,
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 allocation_status text not null check(allocation_status in ('reserved','unallocated')),
 updated_at timestamptz not null default now(),
 check(ends_at>starts_at),
 check((allocation_status='reserved')=(host_account_id is not null))
);
create index if not exists zoom_class_host_reservation_time_idx
 on public.zoom_class_host_reservations(starts_at,ends_at);
alter table public.zoom_class_host_reservations
 add constraint zoom_class_host_reservation_no_overlap
 exclude using gist(
  host_account_id with =,
  tstzrange(starts_at,ends_at,'[)') with &&
 ) where(allocation_status='reserved');
alter table public.zoom_class_host_reservations enable row level security;
revoke all on public.zoom_class_host_reservations from anon,authenticated;
grant select,insert,update,delete on public.zoom_class_host_reservations to service_role;

create or replace function public.reserve_zoom_host_for_class(p_event_id uuid)
returns text language plpgsql security definer set search_path=public,pg_temp
as $$
declare
 ev public.schedule_events%rowtype;
 v_start timestamptz;v_end timestamptz;v_host uuid;v_old uuid;
 v_channel text;
begin
 select * into ev from public.schedule_events where id=p_event_id;
 if not found then
  delete from public.zoom_class_host_reservations where schedule_event_id=p_event_id;
  return 'not_found';
 end if;
 if ev.event_type<>'class' or ev.status not in ('scheduled','tentative','makeup') then
  delete from public.zoom_class_host_reservations where schedule_event_id=p_event_id;
  return 'not_eligible';
 end if;
 if ev.enrollment_id is not null then
  select delivery_channel into v_channel from public.enrollments where id=ev.enrollment_id;
 elsif ev.cohort_id is not null then
  select delivery_channel into v_channel from public.cohorts where id=ev.cohort_id;
 else
  v_channel:=ev.delivery_mode;
 end if;
 if v_channel='offline' or ev.delivery_mode='offline' then
  delete from public.zoom_class_host_reservations where schedule_event_id=p_event_id;
  return 'offline';
 end if;
 v_start:=(ev.date+ev.start_time) at time zone coalesce(nullif(ev.timezone,''),'Asia/Kolkata');
 v_end:=(ev.date+ev.end_time) at time zone coalesce(nullif(ev.timezone,''),'Asia/Kolkata');
 if v_end<=v_start then raise exception 'Invalid class window for Zoom reservation'; end if;
 -- Serialize all concurrent host allocations, including updates and bulk course creation.
 -- Each reservation includes a five-minute host turnover buffer after its class.
 perform pg_advisory_xact_lock(3519,7);
 select host_account_id into v_old from public.zoom_class_host_reservations where schedule_event_id=p_event_id;
 select h.id into v_host
 from public.zoom_host_accounts h
 where h.status='connected' and h.enabled=true
   and not exists (
    select 1 from public.zoom_class_host_reservations r
    where r.host_account_id=h.id and r.schedule_event_id<>p_event_id
      and r.allocation_status='reserved'
      and tstzrange(r.starts_at,r.ends_at,'[)') && tstzrange(v_start,v_end,'[)')
   )
   and not exists (
    select 1 from public.zoom_meetings m
    where m.host_account_id=h.id and m.schedule_event_id is distinct from p_event_id
      and m.status in ('scheduled','started')
      and m.scheduled_start is not null and m.duration_minutes>0
      and tstzrange(m.scheduled_start,m.scheduled_start+m.duration_minutes*interval '1 minute','[)')
        && tstzrange(v_start,v_end,'[)')
   )
 order by case when h.id=v_old then 0 else 1 end,h.priority,h.connected_at,h.id limit 1;
 insert into public.zoom_class_host_reservations(schedule_event_id,host_account_id,starts_at,ends_at,allocation_status,updated_at)
 values(p_event_id,v_host,v_start,v_end+interval '5 minutes',case when v_host is null then 'unallocated' else 'reserved' end,now())
 on conflict(schedule_event_id) do update set
  host_account_id=excluded.host_account_id,starts_at=excluded.starts_at,ends_at=excluded.ends_at,
  allocation_status=excluded.allocation_status,updated_at=now();
 return case when v_host is null then 'unallocated' else 'reserved' end;
end $$;
revoke all on function public.reserve_zoom_host_for_class(uuid) from public,anon,authenticated;
grant execute on function public.reserve_zoom_host_for_class(uuid) to service_role;

create or replace function public.refresh_zoom_class_reservation_trigger()
returns trigger language plpgsql security definer set search_path=public,pg_temp
as $$
begin
 perform public.reserve_zoom_host_for_class(new.id);
 return new;
end $$;
revoke all on function public.refresh_zoom_class_reservation_trigger() from public,anon,authenticated;
drop trigger if exists zoom_class_reservation_sync_trg on public.schedule_events;
create trigger zoom_class_reservation_sync_trg
 after insert or update of date,start_time,end_time,timezone,event_type,status,enrollment_id,cohort_id,delivery_mode
 on public.schedule_events for each row execute function public.refresh_zoom_class_reservation_trigger();

-- Prevent a Zoom API response arriving after a cancellation or reschedule from
-- leaving an incorrect meeting row. The caller can delete an orphan remote room
-- and let JIT reconciliation retry against the new event state.
create or replace function public.guard_zoom_class_meeting_window()
returns trigger language plpgsql security definer set search_path=public,pg_temp
as $
declare ev public.schedule_events%rowtype;v_start timestamptz;v_end timestamptz;
begin
 if new.purpose<>'class' or new.schedule_event_id is null or new.status<>'scheduled' then
  return new;
 end if;
 select * into ev from public.schedule_events where id=new.schedule_event_id;
 if not found or ev.event_type<>'class' or ev.status not in ('scheduled','tentative','makeup') then
  raise exception 'Linked Zoom classroom is no longer scheduled';
 end if;
 v_start:=(ev.date+ev.start_time) at time zone coalesce(nullif(ev.timezone,''),'Asia/Kolkata');
 v_end:=(ev.date+ev.end_time) at time zone coalesce(nullif(ev.timezone,''),'Asia/Kolkata');
 if new.scheduled_start is distinct from v_start or
    new.duration_minutes is distinct from round(extract(epoch from (v_end-v_start))/60)::integer then
  raise exception 'Zoom classroom schedule changed during provisioning';
 end if;
 return new;
end $;
revoke all on function public.guard_zoom_class_meeting_window() from public,anon,authenticated;
drop trigger if exists zoom_class_meeting_window_guard_trg on public.zoom_meetings;
create trigger zoom_class_meeting_window_guard_trg
 before insert or update of host_account_id,scheduled_start,duration_minutes,status
 on public.zoom_meetings for each row execute function public.guard_zoom_class_meeting_window();
commit;
notify pgrst, 'reload schema';
