-- Phase 3G: restrict privileged scheduling and trainer reassignment to the selected SaaS Academy tenant.
BEGIN;
CREATE OR REPLACE FUNCTION public.generate_enrollment_schedule_v2(p_enrollment_id uuid, p_horizon text DEFAULT 'full'::text, p_weeks integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
 v_en public.enrollments%rowtype;
 v_course public.courses%rowtype;
 v_day date;
 v_slot jsonb;
 v_start time;
 v_end time;
 v_start_at timestamptz;
 v_end_at timestamptz;
 v_n integer:=0;
 v_created integer:=0;
 v_total integer;
 v_limit integer;
 v_key text;
 v_type text;
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 if saas.has_organization_membership() and not saas.can_administer_selected_academy() then
  raise exception 'Selected Academy organization admin access required' using errcode='42501';
 end if;
 if p_horizon not in ('full','weeks','manual') then raise exception 'Invalid scheduling horizon'; end if;
 if p_horizon='manual' then return jsonb_build_object('created',0,'mode','manual'); end if;
 if p_horizon='weeks' and (p_weeks is null or p_weeks<1 or p_weeks>104)
 then raise exception 'Weeks must be between 1 and 104'; end if;
 select * into v_en from public.enrollments where id=p_enrollment_id for update;
 if not found then raise exception 'Enrollment not found'; end if;
 if saas.has_organization_membership() and
  (not saas.can_access_academy_record('enrollments',v_en.id)
    or not saas.can_access_academy_record('students',v_en.student_id)
    or not saas.can_access_academy_record('courses',v_en.course_id)
    or not saas.can_access_academy_record('trainers',v_en.trainer_id)) then
  raise exception 'Cross-organization enrollment operation denied' using errcode='42501';
 end if;
 if v_en.status <> 'active' then raise exception 'Only active enrollments can be scheduled'; end if;
 if v_en.enrollment_type <> 'one_to_one' then
   raise exception 'Group sessions must be generated at cohort level, not once per learner';
 end if;
 -- No artificial historical bookings for ongoing or migrated programs.
 -- Existing advanced enrollments need a separately reviewed forward-only plan.
 if v_en.started_at < (now() at time zone 'Asia/Kolkata')::date or
    coalesce(v_en.sessions_completed,0)>0 or coalesce(v_en.opening_completed_sessions,0)>0
 then raise exception 'Ongoing or historical enrollments require reviewed future-only scheduling'; end if;
 select * into v_course from public.courses where id=v_en.course_id;
 if not found then raise exception 'Course not found'; end if;
 v_total:=coalesce(v_en.planned_sessions,v_course.total_sessions);
 if v_total<1 or v_total>500 then raise exception 'Invalid planned class count'; end if;
 if jsonb_typeof(v_en.schedule_rules)<>'array' or jsonb_array_length(v_en.schedule_rules)=0
 then raise exception 'Weekly class slots are required'; end if;
 -- Lock the trainer while building the class plan to serialize generator runs
 -- across enrollments for the same trainer.
 perform 1 from public.trainers where id=v_en.trainer_id for update;
 perform set_config('robotronix.bulk_schedule_notifications','on',true);
 v_limit:=case when p_horizon='weeks' then p_weeks*7 else 1461 end;
 for v_day in select (v_en.started_at+n)::date from generate_series(0,v_limit-1) as n loop
  for v_slot in select value from jsonb_array_elements(v_en.schedule_rules) as value
     order by (value->>'startTime')::time loop
   if (v_slot->>'dayOfWeek')::integer <> extract(dow from v_day)::integer then continue; end if;
   v_start:=(v_slot->>'startTime')::time;
   v_end:=(v_slot->>'endTime')::time;
   if v_end<=v_start or extract(minute from v_start)::integer%30<>0 or
      extract(minute from v_end)::integer%30<>0 then
    raise exception 'Generated session must use supported same-day 30-minute intervals';
   end if;
   if not exists(select 1 from public.trainer_availability a
    where a.trainer_id=v_en.trainer_id and a.enabled
      and a.day_of_week=extract(dow from v_day)::integer
      and a.start_time<=v_start and a.end_time>=v_end)
   and not exists(select 1 from public.trainer_availability_overrides o
      where o.trainer_id=v_en.trainer_id and o.date=v_day and o.override_type='available'
      and o.start_time<=v_start and o.end_time>=v_end)
   and not v_en.schedule_override_confirmed
   then raise exception 'Trainer weekly availability does not cover % %',v_day,v_start; end if;
   if exists(select 1 from public.trainer_availability_overrides o
      where o.trainer_id=v_en.trainer_id and o.date=v_day
      and o.override_type='unavailable' and o.start_time<v_end and o.end_time>v_start)
   then raise exception 'Trainer unavailable on % %',v_day,v_start; end if;
   v_start_at:=(v_day+v_start) at time zone v_en.schedule_timezone;
   v_end_at:=(v_day+v_end) at time zone v_en.schedule_timezone;
   if v_end_at<=v_start_at then raise exception 'Invalid timezone-adjusted slot'; end if;
   v_key:='enrollment:'||v_en.id::text||':regular:'||v_day::text||':'||v_start::text;
   -- Preserve already-modified/cancelled events under their original unique key.
   if exists(select 1 from public.schedule_events where generation_key=v_key) then
      v_n:=v_n+1;
   else
     if exists (
      select 1 from public.schedule_events e
       where e.status not in ('cancelled','rescheduled') and e.trainer_id=v_en.trainer_id
         and (e.date+e.start_time) at time zone e.timezone < v_end_at
         and (e.date+e.end_time) at time zone e.timezone > v_start_at
     ) then raise exception 'Trainer conflict for % %',v_day,v_start; end if;
     if exists (
      select 1 from public.schedule_events e
       where e.status not in ('cancelled','rescheduled')
         and (e.student_id=v_en.student_id or e.enrollment_id in
               (select id from public.enrollments where student_id=v_en.student_id)
              or e.cohort_id in
               (select cohort_id from public.enrollments where student_id=v_en.student_id and cohort_id is not null))
         and (e.date+e.start_time) at time zone e.timezone < v_end_at
         and (e.date+e.end_time) at time zone e.timezone > v_start_at
     ) then raise exception 'Learner conflict for % %',v_day,v_start; end if;
     insert into public.schedule_events
      (trainer_id,course_id,enrollment_id,student_id,title,date,start_time,end_time,
       timezone,event_type,delivery_mode,status,occurrence_kind,generation_key)
     values(v_en.trainer_id,v_en.course_id,v_en.id,v_en.student_id,
       v_course.title,v_day,v_start,v_end,v_en.schedule_timezone,
       'class','one_to_one','scheduled','regular',v_key);
     v_created:=v_created+1;
     v_n:=v_n+1;
   end if;
   exit when v_n>=v_total;
  end loop;
  exit when v_n>=v_total;
 end loop;
 if p_horizon='full' and v_n<v_total then
  raise exception 'Unable to generate all % classes; only % fit',v_total,v_n;
 end if;
 perform set_config('robotronix.bulk_schedule_notifications','off',true);
 if v_created>0 then
  insert into public.portal_notifications(recipient_role,student_id,trainer_id,type,priority,title,message,href)
  values('parent',v_en.student_id,v_en.trainer_id,'course_schedule_generated','info',
    'Your class schedule is ready',v_created::text||' '||v_course.title||' class dates were booked. View the complete timetable.','/parent/calendar'),
   ('trainer',v_en.student_id,v_en.trainer_id,'course_schedule_generated','info',
    'Course classes scheduled',v_created::text||' future classes added to your timetable.','/trainer/classes');
 end if;
 return jsonb_build_object('created',v_created,'total',v_n,'mode',p_horizon);
end $function$
;
CREATE OR REPLACE FUNCTION public.reassign_cohort_trainer_v2(p_cohort_id uuid, p_new_trainer_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
 c public.cohorts%rowtype; v_count integer:=0;
 ev public.schedule_events%rowtype;
begin
 if not public.is_admin() then raise exception 'Admin required'; end if;
 if saas.has_organization_membership() and not saas.can_administer_selected_academy() then
  raise exception 'Selected Academy organization admin access required' using errcode='42501';
 end if;
 if nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'Reason required'; end if;
 select * into c from public.cohorts where id=p_cohort_id for update;
 if not found or c.status not in ('planned','active') or c.trainer_id is null
 then raise exception 'Cohort is not eligible for reassignment'; end if;
 if saas.has_organization_membership() and
  (not saas.can_access_academy_record('courses',c.course_id)
    or not saas.can_access_academy_record('trainers',c.trainer_id)
    or not saas.can_access_academy_record('trainers',p_new_trainer_id)) then
  raise exception 'Cross-organization cohort reassignment denied' using errcode='42501';
 end if;
 if c.trainer_id=p_new_trainer_id then return jsonb_build_object('updated',0); end if;
 if not exists(select 1 from public.trainers t join public.trainer_courses tc on tc.trainer_id=t.id
    where t.id=p_new_trainer_id and t.record_status='active' and tc.course_id=c.course_id)
 then raise exception 'Replacement trainer is not active/approved for this course'; end if;
 perform 1 from public.trainers where id in (c.trainer_id,p_new_trainer_id) order by id for update;
 for ev in select * from public.schedule_events where cohort_id=c.id
   and event_type='class' and date>=current_date
   and status not in ('cancelled','rescheduled','conducted')
   order by date,start_time,id for update
 loop
   if ev.status not in ('scheduled','tentative','makeup')
   then raise exception 'A future class requires manual review'; end if;
   if exists(select 1 from public.trainer_earnings where schedule_event_id=ev.id and status in ('approved','paid'))
   then raise exception 'Class has locked payroll'; end if;
   if exists(select 1 from public.zoom_meetings where schedule_event_id=ev.id and status in ('scheduled','started'))
   then raise exception 'Existing individual Zoom meeting needs reconciliation before trainer transfer'; end if;
   if exists(select 1 from public.schedule_events e where e.id<>ev.id
    and e.trainer_id=p_new_trainer_id and e.status not in ('cancelled','rescheduled')
    and (e.date+e.start_time) at time zone e.timezone<
        (ev.date+ev.end_time) at time zone ev.timezone
    and (e.date+e.end_time) at time zone e.timezone>
        (ev.date+ev.start_time) at time zone ev.timezone)
   then raise exception 'Replacement trainer has a conflict on %',ev.date; end if;
 end loop;
 update public.schedule_events set trainer_id=p_new_trainer_id,requested_by='admin',
    change_reason=concat_ws(' | ',nullif(change_reason,''),'Cohort trainer changed: '||trim(p_reason)),
    updated_at=now()
 where cohort_id=c.id and event_type='class' and date>=current_date
   and status in ('scheduled','tentative','makeup');
 get diagnostics v_count=row_count;
 update public.cohorts set trainer_id=p_new_trainer_id,updated_at=now() where id=c.id;
 update public.enrollments set trainer_id=p_new_trainer_id,updated_at=now()
 where cohort_id=c.id and status in ('active','on_hold');
 insert into public.portal_audit_log(actor_profile_id,entity_type,entity_id,action,before_data,after_data)
 values(auth.uid(),'cohort',c.id::text,'cohort_trainer_reassigned_v2',
 jsonb_build_object('trainer_id',c.trainer_id),
 jsonb_build_object('trainer_id',p_new_trainer_id,'classes_updated',v_count,'reason',p_reason));
 insert into public.portal_notifications(recipient_role,student_id,trainer_id,type,priority,title,message,href)
 select 'parent',en.student_id,p_new_trainer_id,'cohort_trainer_reassigned','important',
  'Batch trainer updated','The batch has a new trainer. See your upcoming class schedule.','/parent'
 from public.enrollments en where en.cohort_id=c.id and en.status in ('active','on_hold');
 insert into public.portal_notifications(recipient_role,trainer_id,type,priority,title,message,href)
 values('trainer',p_new_trainer_id,'cohort_trainer_reassigned','action',
 'New batch assigned','A cohort and its upcoming sessions are now assigned to you.','/trainer/classes');
 return jsonb_build_object('updated',v_count);
end $function$
;
CREATE OR REPLACE FUNCTION public.reassign_enrollment_trainer_v2(p_enrollment_id uuid, p_new_trainer_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
 v_en public.enrollments%rowtype; v_count integer:=0;
 v_event record;
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 if saas.has_organization_membership() and not saas.can_administer_selected_academy() then
  raise exception 'Selected Academy organization admin access required' using errcode='42501';
 end if;
 if nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'Reason required'; end if;
 select * into v_en from public.enrollments where id=p_enrollment_id for update;
 if not found or v_en.status not in ('active','on_hold') or v_en.enrollment_type<>'one_to_one'
 then raise exception 'Only active or paused 1-to-1 enrollments may be reassigned'; end if;
 if v_en.trainer_id=p_new_trainer_id then return jsonb_build_object('updated',0,'unchanged',true); end if;
 if not exists(select 1 from public.trainers where id=p_new_trainer_id and record_status='active') then
  raise exception 'Replacement trainer is not active';
 end if;
 if not exists(select 1 from public.trainer_courses where trainer_id=p_new_trainer_id and course_id=v_en.course_id)
 then raise exception 'Replacement trainer is not assigned to this course'; end if;
 -- Serialize with generator/reassignment operations across trainers.
 perform 1 from public.trainers where id in (v_en.trainer_id,p_new_trainer_id) order by id for update;
 for v_event in
  select id,date,start_time,end_time,timezone,status,occurrence_kind
  from public.schedule_events
  where enrollment_id=p_enrollment_id and event_type='class'
    and date>=current_date and status not in ('cancelled','rescheduled','conducted')
  order by date,start_time,id
 loop
  if v_event.status not in ('scheduled','tentative','makeup') then
   raise exception 'Future session % needs manual review before reassignment',v_event.id;
  end if;
  if exists(select 1 from public.zoom_meetings zm where zm.schedule_event_id=v_event.id and zm.status in ('scheduled','started'))
  then raise exception 'Future class has a provisioned Zoom meeting; reconcile it before reassignment'; end if;
  if exists(select 1 from public.trainer_earnings t where t.schedule_event_id=v_event.id and t.status in ('approved','paid')) then
    raise exception 'A future class has locked payroll'; end if;
  if exists(select 1 from public.schedule_events e
   where e.trainer_id=p_new_trainer_id and e.id<>v_event.id
     and e.status not in ('cancelled','rescheduled')
     and ((e.date+e.start_time) at time zone e.timezone) <
           ((v_event.date+v_event.end_time) at time zone v_event.timezone)
     and ((e.date+e.end_time) at time zone e.timezone) >
           ((v_event.date+v_event.start_time) at time zone v_event.timezone)
  ) then raise exception 'Replacement trainer has a conflict on % at %',v_event.date,v_event.start_time; end if;
  if exists(select 1 from public.trainer_availability_overrides o
    where o.trainer_id=p_new_trainer_id and o.date=v_event.date
      and o.override_type='unavailable' and o.start_time<v_event.end_time and o.end_time>v_event.start_time)
  then raise exception 'Replacement trainer is unavailable on %',v_event.date; end if;
 end loop;
 update public.schedule_events
 set trainer_id=p_new_trainer_id,requested_by='admin',
     change_reason=coalesce(change_reason||' | ','')||'Trainer reassignment: '||trim(p_reason),
     updated_at=now()
 where enrollment_id=p_enrollment_id and event_type='class' and date>=current_date
   and status in ('scheduled','tentative','makeup');
 get diagnostics v_count=row_count;
 update public.enrollments set trainer_id=p_new_trainer_id,updated_at=now() where id=p_enrollment_id;
 insert into public.portal_audit_log(actor_profile_id,entity_type,entity_id,action,before_data,after_data)
 values(auth.uid(),'enrollment',p_enrollment_id::text,'reassign_trainer_v2',
 jsonb_build_object('trainer_id',v_en.trainer_id),
 jsonb_build_object('trainer_id',p_new_trainer_id,'future_classes_updated',v_count,'reason',trim(p_reason)));
 insert into public.portal_notifications(recipient_role,student_id,trainer_id,type,priority,title,message,href)
 values ('parent',v_en.student_id,p_new_trainer_id,'trainer_reassigned','important',
 'Your class trainer has changed','Your upcoming classes now have a replacement trainer. View the updated schedule.','/parent'),
 ('trainer',v_en.student_id,p_new_trainer_id,'trainer_reassigned','action',
 'New learner assigned','A learner and their future classes have been assigned to you.','/trainer/classes');
 return jsonb_build_object('updated',v_count,'newTrainerId',p_new_trainer_id);
end $function$
;
COMMIT;
