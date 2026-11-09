create or replace function public.portal_demo_move_slot(
 p_event_id uuid,p_trainer_id uuid,p_date date,p_start time,p_end time,p_timezone text
) returns void language plpgsql security invoker set search_path to '' as $fn$
declare v_event record;v_start timestamptz;v_end timestamptz;
begin
 select e.id,e.status,e.event_type into v_event from public.schedule_events e where e.id=p_event_id for update;
 if not found or v_event.status<>'scheduled' or v_event.event_type<>'demo' then
  raise exception 'Demo cannot be rescheduled' using errcode='22023';end if;
 if p_date is null or p_start is null or p_end is null or p_start>=p_end or
  not exists(select 1 from public.trainers where id=p_trainer_id and record_status='active') then
  raise exception 'Invalid trainer or slot' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_trainer_id::text,0));
 v_start:=(p_date+p_start) at time zone p_timezone;
 v_end:=(p_date+p_end) at time zone p_timezone;
 if v_start<now() or v_end<=v_start then raise exception 'Slot is no longer available' using errcode='22023';end if;
 if exists(select 1 from public.schedule_events e where e.trainer_id=p_trainer_id and e.id<>p_event_id
  and e.status not in ('cancelled','rescheduled') and
  (e.date+e.start_time) at time zone e.timezone<v_end and (e.date+e.end_time) at time zone e.timezone>v_start)
 then raise exception 'Trainer conflict' using errcode='23P01';end if;
 update public.schedule_events set trainer_id=p_trainer_id,date=p_date,start_time=p_start,end_time=p_end,
  timezone=p_timezone,updated_at=now() where id=p_event_id;
end $fn$;
revoke all on function public.portal_demo_move_slot(uuid,uuid,date,time,time,text) from public,anon,authenticated;
grant execute on function public.portal_demo_move_slot(uuid,uuid,date,time,time,text) to service_role;
