-- One-time patch ONLY for a fresh Supabase DB where 01_CREATE_SCHEMA.sql was
-- installed before the scheduled-duration payout rule was corrected.
-- For NEW installs, run the updated 01_CREATE_SCHEMA.sql; DO NOT run this too.
-- Does not recalculate historical records or edit finalized payouts.
-- Run in SQL Editor only after reviewing backups and current schema.
begin;
-- Accept 15-minute actual-time increments so 75 minutes can be recorded.
alter table public.schedule_events drop constraint if exists actual_duration_half_hour_check;
alter table public.schedule_events add constraint actual_duration_half_hour_check
 check(actual_duration_minutes is null or(actual_duration_minutes between 15 and 480 and actual_duration_minutes % 15=0));
create or replace function public.sync_trainer_earning(p_event_id uuid,p_force boolean default false)
returns uuid language plpgsql security definer set search_path=public as $$
declare
 e public.schedule_events%rowtype; p public.trainer_compensation_plans%rowtype; olde public.trainer_earnings%rowtype;
 class_at timestamptz; end_at timestamptz; pay_local timestamp; band text; stype text; outcome text;
 att_total int:=0; present_count int:=0; learner_count int:=0; duration_mins int:=60;
 base numeric:=0; factor numeric:=1; pct numeric:=100; bonus numeric:=0; adj numeric:=0; total numeric:=0; result_id uuid;
begin
 select * into e from public.schedule_events where id=p_event_id;
 if not found then return null; end if;
 if e.event_type not in ('class','demo') then return null; end if;
 if not (public.is_admin() or e.trainer_id=public.current_trainer_id() or current_user in ('postgres','service_role')) then raise exception 'Not authorized to generate this earning.'; end if;
 select * into p from public.trainer_compensation_plans where trainer_id=e.trainer_id and effective_from<=e.date order by effective_from desc limit 1;
 if not found then
   insert into public.trainer_compensation_plans(trainer_id,effective_from) values(e.trainer_id,e.date) returning * into p;
 end if;
 select * into olde from public.trainer_earnings where schedule_event_id=e.id;
 if found and olde.status in ('approved','paid') and not p_force then return olde.id; end if;
 if e.status not in ('conducted','cancelled') then return coalesce(olde.id,null); end if;
 class_at := (e.date + e.start_time) at time zone e.timezone;
 end_at := (e.date + e.end_time) at time zone e.timezone;
 pay_local := class_at at time zone p.timezone;
 -- Payout duration is the approved scheduled slot; actual teaching minutes affect course progress only.
 duration_mins := greatest(1,round(extract(epoch from (end_at-class_at))/60)::int);
 band := case when p.day_start<p.day_end and pay_local::time>=p.day_start and pay_local::time<p.day_end then 'day'
              when p.day_start>p.day_end and (pay_local::time>=p.day_start or pay_local::time<p.day_end) then 'day' else 'night' end;
 stype := case when e.event_type='demo' then 'demo' when e.event_type='school' then 'school' when e.event_type='workshop' then 'workshop'
               when e.cohort_id is not null or e.delivery_mode='small_group' then 'small_group' else 'one_to_one' end;
 select count(*),count(*) filter(where ca.status in ('attended','late')) into att_total,present_count from public.class_attendance ca where ca.schedule_event_id=e.id;
 if e.cohort_id is not null then select count(*) into learner_count from public.enrollments en where en.cohort_id=e.cohort_id and en.status<>'cancelled';
 else learner_count:=case when e.student_id is not null or e.enrollment_id is not null then 1 else att_total end; end if;
 if stype='demo' and learner_count=0 then learner_count:=1; end if;
 outcome := case when e.status='cancelled' then 'cancelled' when e.status='conducted' and stype<>'demo' and att_total>0 and present_count=0 then 'no_show' else 'completed' end;
 base := case when stype='one_to_one' and band='day' then p.one_to_one_day when stype='one_to_one' then p.one_to_one_night
              when stype='small_group' and band='day' then p.group_day when stype='small_group' then p.group_night
              when stype='demo' and band='day' then p.demo_day when stype='demo' then p.demo_night else 0 end;
 factor := case when stype='demo' then 1 else greatest(.25,duration_mins/60.0) end;
 pct := case when outcome='no_show' then p.no_show_percent when outcome='cancelled' then p.cancelled_percent else 100 end;
 if olde.id is not null then bonus:=case when olde.conversion_applied and stype='demo' then case when band='day' then p.demo_conversion_day else p.demo_conversion_night end else 0 end; adj:=olde.adjustment; end if;
 total:=greatest(0,round((base*factor*(pct/100.0)+bonus+adj)::numeric,2));
 insert into public.trainer_earnings(trainer_id,schedule_event_id,earning_date,session_type,pay_band,duration_minutes,learner_count,class_outcome,base_rate,duration_factor,conversion_bonus,adjustment,total_amount,conversion_applied,status,adjustment_reason,notes,approved_at,paid_at,payment_reference,updated_at)
 values(e.trainer_id,e.id,(pay_local::date),stype,band,duration_mins,learner_count,outcome,base,factor,bonus,coalesce(olde.adjustment,0),total,coalesce(olde.conversion_applied,false),case when e.status='cancelled' and p.cancelled_percent=0 then 'void' else coalesce(olde.status,'pending') end,olde.adjustment_reason,olde.notes,olde.approved_at,olde.paid_at,olde.payment_reference,now())
 on conflict(schedule_event_id) do update set trainer_id=excluded.trainer_id,earning_date=excluded.earning_date,session_type=excluded.session_type,pay_band=excluded.pay_band,duration_minutes=excluded.duration_minutes,learner_count=excluded.learner_count,class_outcome=excluded.class_outcome,base_rate=excluded.base_rate,duration_factor=excluded.duration_factor,conversion_bonus=excluded.conversion_bonus,total_amount=excluded.total_amount,status=case when public.trainer_earnings.status in ('approved','paid') and not p_force then public.trainer_earnings.status else excluded.status end,updated_at=now()
 returning id into result_id;
 return result_id;
end $$;
revoke all on function public.sync_trainer_earning(uuid,boolean) from public,anon;
grant execute on function public.sync_trainer_earning(uuid,boolean) to authenticated,service_role;
commit;
