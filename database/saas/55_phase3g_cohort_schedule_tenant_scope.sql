-- Phase 3G: cohort scheduling must authorize before manual mode early return.
BEGIN;
CREATE OR REPLACE FUNCTION public.generate_cohort_schedule_v2(p_cohort_id uuid, p_horizon text DEFAULT 'full'::text, p_weeks integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
 c public.cohorts%rowtype; course public.courses%rowtype;
 v_day date; v_slot jsonb; v_start time; v_end time;
 v_start_at timestamptz; v_end_at timestamptz;
 v_total integer; v_count integer:=0; v_created integer:=0;
 v_limit integer; v_key text;
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 if saas.has_organization_membership() and not saas.can_administer_selected_academy() then
  raise exception 'Selected Academy organization admin access required' using errcode='42501';
 end if;
 if p_horizon not in ('full','weeks','manual') then raise exception 'Invalid horizon'; end if;
 select * into c from public.cohorts where id=p_cohort_id for update;
 if not found then raise exception 'Cohort not found'; end if;
 if saas.has_organization_membership() and
  (not saas.can_access_academy_record('courses',c.course_id)
    or not saas.can_access_academy_record('trainers',c.trainer_id)) then
   raise exception 'Cross-organization cohort scheduling denied' using errcode='42501';
 end if;
 if p_horizon='manual' then return jsonb_build_object('created',0,'total',0); end if;
 if p_horizon='weeks' and (p_weeks is null or p_weeks not between 1 and 104)
 then raise exception 'Weeks must be between 1 and 104'; end if;
 if not found or c.status not in ('planned','active') or c.trainer_id is null or c.started_at is null
 then raise exception 'Cohort needs a trainer, start date and active/planned status'; end if;
 if c.started_at < (now() at time zone 'Asia/Kolkata')::date
 then raise exception 'Historical cohorts need reviewed forward-only scheduling'; end if;
 if jsonb_typeof(c.schedule_rules)<>'array' or jsonb_array_length(c.schedule_rules)=0
 then raise exception 'Cohort schedule is empty'; end if;
 select * into course from public.courses where id=c.course_id;
 if not found then raise exception 'Course not found'; end if;
 v_total:=course.total_sessions;
 if v_total not between 1 and 500 then raise exception 'Unsupported session count'; end if;
 perform 1 from public.trainers where id=c.trainer_id for update;
 perform set_config('robotronix.bulk_schedule_notifications','on',true);
 v_limit:=case when p_horizon='weeks' then p_weeks*7 else 1461 end;
 for v_day in select (c.started_at+x)::date from generate_series(0,v_limit-1) as x loop
  for v_slot in select value from jsonb_array_elements(c.schedule_rules) as value
   order by (value->>'startTime')::time loop
   if (v_slot->>'dayOfWeek')::integer<>extract(dow from v_day)::integer then continue; end if;
   v_start:=(v_slot->>'startTime')::time;v_end:=(v_slot->>'endTime')::time;
   if v_end<=v_start or extract(minute from v_start)::integer%30<>0
     or extract(minute from v_end)::integer%30<>0
   then raise exception 'Use supported same-day half-hour class slots'; end if;
   if exists(select 1 from public.trainer_availability_overrides o
       where o.trainer_id=c.trainer_id and o.date=v_day
         and o.override_type='unavailable' and o.start_time<v_end and o.end_time>v_start)
    then raise exception 'Trainer has leave on % %',v_day,v_start; end if;
   v_start_at:=(v_day+v_start) at time zone c.schedule_timezone;
   v_end_at:=(v_day+v_end) at time zone c.schedule_timezone;
   if v_end_at<=v_start_at then raise exception 'Invalid class time'; end if;
   v_key:='cohort:'||c.id::text||':regular:'||v_day::text||':'||v_start::text;
   if exists(select 1 from public.schedule_events where generation_key=v_key) then
    v_count:=v_count+1;
   else
    if exists(select 1 from public.schedule_events e
      where e.trainer_id=c.trainer_id and e.status not in ('cancelled','rescheduled')
      and (e.date+e.start_time) at time zone e.timezone<v_end_at
      and (e.date+e.end_time) at time zone e.timezone>v_start_at)
    then raise exception 'Trainer conflict for cohort on % %',v_day,v_start; end if;
    if exists(select 1 from public.schedule_events e
      where e.status not in ('cancelled','rescheduled')
      and (
        e.student_id in (select student_id from public.enrollments where cohort_id=c.id and status='active')
        or e.enrollment_id in (select id from public.enrollments where cohort_id=c.id and status='active')
        or e.cohort_id in (select coalesce(en2.cohort_id,'00000000-0000-0000-0000-000000000000'::uuid)
           from public.enrollments en2
           where en2.student_id in
             (select student_id from public.enrollments where cohort_id=c.id and status='active'))
      )
      and (e.date+e.start_time) at time zone e.timezone<v_end_at
      and (e.date+e.end_time) at time zone e.timezone>v_start_at)
    then raise exception 'Cohort member class conflict on % %',v_day,v_start; end if;
    insert into public.schedule_events
     (trainer_id,course_id,cohort_id,title,date,start_time,end_time,timezone,
      event_type,delivery_mode,status,occurrence_kind,generation_key)
    values(c.trainer_id,c.course_id,c.id,course.title||' · '||c.name,v_day,v_start,v_end,c.schedule_timezone,
      'class','small_group','scheduled','regular',v_key);
    v_count:=v_count+1;v_created:=v_created+1;
   end if;
   exit when v_count>=v_total;
  end loop;
  exit when v_count>=v_total;
 end loop;
 if p_horizon='full' and v_count<v_total then raise exception 'Not enough cohort slots for entire course'; end if;
 perform set_config('robotronix.bulk_schedule_notifications','off',true);
 if v_created>0 then
  insert into public.portal_notifications(recipient_role,trainer_id,type,priority,title,message,href)
  values('trainer',c.trainer_id,'cohort_schedule_generated','info',
     'Batch classes scheduled',v_created::text||' shared cohort classes were added.','/trainer/classes');
  insert into public.portal_notifications(recipient_role,student_id,trainer_id,type,priority,title,message,href)
  select 'parent',en.student_id,c.trainer_id,'cohort_schedule_generated','info',
     'Your batch schedule is ready',v_created::text||' '||course.title||' cohort classes were scheduled. View the complete timetable.','/parent/calendar'
   from public.enrollments en where en.cohort_id=c.id and en.status in ('active','on_hold');
 end if;
 return jsonb_build_object('created',v_created,'total',v_count);
end $function$
;
COMMIT;
