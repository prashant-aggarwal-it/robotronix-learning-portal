-- Phase 3G: protect class and enrollment RPCs against cross-tenant target access.
BEGIN;
CREATE OR REPLACE FUNCTION public.cancel_class_v2(p_event_id uuid, p_requested_by text, p_reason text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare e public.schedule_events%rowtype;
begin
 select * into e from public.schedule_events where id=p_event_id for update;
 if saas.has_organization_membership() and not saas.can_access_academy_record('schedule_events',e.id) then
  raise exception 'Cross-organization class operation denied' using errcode='42501';
 end if;
 if not found or e.event_type<>'class' then raise exception 'Class not found'; end if;
 if e.cohort_id is not null and not public.is_admin() then raise exception 'Shared cohort changes require Admin'; end if;
 if not (public.is_admin() or (auth.uid() is not null and public.current_trainer_id()=e.trainer_id))
 then raise exception 'Not authorized to cancel this class'; end if;
 if e.status not in ('scheduled','tentative','makeup') then raise exception 'Only upcoming classes may be cancelled'; end if;
 if (e.date+e.start_time) at time zone e.timezone <=now() then raise exception 'Past or started classes need Admin review'; end if;
 if p_requested_by not in ('parent','student','trainer','admin') or nullif(trim(coalesce(p_reason,'')),'') is null
 then raise exception 'Initiator and reason are required'; end if;
 if exists(select 1 from public.class_attendance where schedule_event_id=e.id)
 or exists(select 1 from public.trainer_earnings where schedule_event_id=e.id and status in ('approved','paid'))
 then raise exception 'Class has protected attendance or payroll'; end if;
 if exists(select 1 from public.zoom_meetings where schedule_event_id=e.id and status in ('scheduled','started'))
 then raise exception 'Class has an individual Zoom meeting; use Admin Zoom reconciliation before cancellation'; end if;
 update public.schedule_events set status='cancelled',requested_by=p_requested_by,
 change_reason=p_reason,updated_at=now() where id=e.id;
 if p_requested_by='parent' then
  insert into public.portal_notifications(recipient_role,student_id,trainer_id,type,priority,title,message,href)
  values('admin',e.student_id,e.trainer_id,'cancellation_review_required','action',
    'Cancellation requires review','A parent-requested class cancellation needs a financial decision.','/admin/cancellation-reviews');
 end if;
 insert into public.portal_audit_log(actor_profile_id,entity_type,entity_id,action,before_data,after_data)
 values(auth.uid(),'schedule_event',e.id::text,'cancel_class_v2',
 jsonb_build_object('status',e.status),jsonb_build_object('status','cancelled','requested_by',p_requested_by,'reason',p_reason));
 if e.student_id is not null then
  insert into public.portal_notifications(recipient_role,student_id,trainer_id,type,priority,title,message,href)
  values('parent',e.student_id,e.trainer_id,'class_cancelled','important','Class cancelled','A class was cancelled. The schedule has been updated.','/parent'),
  ('student',e.student_id,e.trainer_id,'class_cancelled','info','Class cancelled','A class was cancelled.','/student');
 end if;
 if e.cohort_id is not null then
  insert into public.portal_notifications(recipient_role,student_id,trainer_id,type,priority,title,message,href)
  select 'parent',en.student_id,e.trainer_id,'class_cancelled','important',
  'Batch class cancelled','A shared batch class has been cancelled. Please check your timetable.','/parent'
  from public.enrollments en where en.cohort_id=e.cohort_id and en.status in ('active','on_hold');
 end if;
 return true;
end $function$
;
CREATE OR REPLACE FUNCTION public.create_makeup_class_v2(p_original_id uuid, p_date date, p_start time without time zone, p_end time without time zone, p_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare original public.schedule_events%rowtype; v_id uuid;
 v_start_at timestamptz;v_end_at timestamptz;
begin
 select * into original from public.schedule_events where id=p_original_id for update;
 if saas.has_organization_membership() and not saas.can_access_academy_record('schedule_events',original.id) then
  raise exception 'Cross-organization class operation denied' using errcode='42501';
 end if;
 if not found or original.event_type<>'class' or original.enrollment_id is null
 then raise exception 'Makeup requires an individual class with an enrollment'; end if;
 if original.status not in ('cancelled','missed')
 then raise exception 'Only cancelled or missed classes can be made up'; end if;
 if not (public.is_admin() or (auth.uid() is not null and public.current_trainer_id()=original.trainer_id))
 then raise exception 'Not authorized to create this makeup'; end if;
 if exists(select 1 from public.schedule_events where original_event_id=p_original_id and status<>'cancelled')
 then raise exception 'A replacement/makeup already exists for this class'; end if;
 if nullif(trim(coalesce(p_reason,'')),'') is null
 then raise exception 'Makeup reason is required'; end if;
 if p_date is null or p_start is null or p_end is null or p_start>=p_end
    or (extract(epoch from (p_end-p_start))::integer/60) not in (60,90,120,150)
 then raise exception 'Choose a supported class duration'; end if;
 if exists(select 1 from public.trainer_availability_overrides o
   where o.trainer_id=original.trainer_id and o.date=p_date
     and o.override_type='unavailable' and o.start_time<p_end and o.end_time>p_start)
 then raise exception 'Trainer on leave for proposed makeup'; end if;
 v_start_at:=(p_date+p_start) at time zone original.timezone;
 v_end_at:=(p_date+p_end) at time zone original.timezone;
 if v_start_at<=now() then raise exception 'Makeup must be in the future'; end if;
 perform 1 from public.trainers where id=original.trainer_id for update;
 if exists(select 1 from public.schedule_events x
   where x.trainer_id=original.trainer_id and x.status not in ('cancelled','rescheduled')
    and (x.date+x.start_time) at time zone x.timezone<v_end_at
    and (x.date+x.end_time) at time zone x.timezone>v_start_at)
 then raise exception 'Trainer unavailable for proposed makeup'; end if;
 if exists(select 1 from public.schedule_events x
   where x.status not in ('cancelled','rescheduled')
     and (x.student_id=original.student_id or x.enrollment_id in
          (select id from public.enrollments where student_id=original.student_id)
          or x.cohort_id in (select cohort_id from public.enrollments where student_id=original.student_id and cohort_id is not null))
     and (x.date+x.start_time) at time zone x.timezone<v_end_at
     and (x.date+x.end_time) at time zone x.timezone>v_start_at)
 then raise exception 'Learner unavailable for proposed makeup'; end if;
 insert into public.schedule_events
 (trainer_id,course_id,enrollment_id,student_id,title,date,start_time,end_time,timezone,event_type,
  delivery_mode,status,occurrence_kind,original_event_id,requested_by,change_reason)
 values(original.trainer_id,original.course_id,original.enrollment_id,original.student_id,original.title,
 p_date,p_start,p_end,original.timezone,'class','one_to_one','scheduled','makeup',original.id,
 case when public.is_admin() then 'admin' else 'trainer' end,p_reason)
 returning id into v_id;
 insert into public.portal_audit_log(actor_profile_id,entity_type,entity_id,action,before_data,after_data)
 values(auth.uid(),'schedule_event',v_id::text,'create_makeup_v2',
 jsonb_build_object('original_id',original.id),jsonb_build_object('reason',p_reason));
 if original.student_id is not null then
  insert into public.portal_notifications(recipient_role,student_id,trainer_id,type,priority,title,message,href)
  values('parent',original.student_id,original.trainer_id,'makeup_scheduled','important',
  'Makeup class scheduled','A makeup class has been arranged. Check the updated class timetable.','/parent'),
  ('trainer',original.student_id,original.trainer_id,'makeup_scheduled','info',
  'Makeup class scheduled','A makeup class has been arranged.','/trainer/classes');
 end if;
 return v_id;
end $function$
;
CREATE OR REPLACE FUNCTION public.pause_cohort_member_v2(p_enrollment_id uuid, p_from date, p_resume date, p_reason text, p_note text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare en public.enrollments%rowtype; v_days integer;
begin
 select * into en from public.enrollments where id=p_enrollment_id for update;
 if saas.has_organization_membership() and not saas.can_access_academy_record('enrollments',en.id) then
  raise exception 'Cross-organization enrollment operation denied' using errcode='42501';
 end if;
 if not found or en.enrollment_type<>'small_group' or en.status<>'active'
 then raise exception 'Choose an active cohort learner'; end if;
 if not (public.is_admin() or (auth.uid() is not null and public.current_trainer_id()=en.trainer_id))
 then raise exception 'Not authorized'; end if;
 if p_reason not in ('exams','medical','travel','family','other')
 then raise exception 'Valid leave reason is required'; end if;
 if p_from is null or p_resume is null or p_resume<=p_from
   or p_from<(now() at time zone en.schedule_timezone)::date
 then raise exception 'Choose valid future leave dates'; end if;
 v_days:=p_resume-p_from;
 if v_days>14 and not public.is_admin() then raise exception 'Admin approval required beyond 14 days'; end if;
 if v_days>365 then raise exception 'Leave cannot exceed one year'; end if;
 update public.enrollments set status='on_hold',hold_reason=p_reason,hold_from=p_from,
  hold_until=p_resume,hold_note=p_note,updated_at=now()
 where id=p_enrollment_id;
 insert into public.enrollment_holds(enrollment_id,student_id,reason,start_date,end_date,status,note)
 values(en.id,en.student_id,p_reason,p_from,p_resume,'active',p_note);
 insert into public.portal_audit_log(actor_profile_id,entity_type,entity_id,action,before_data,after_data)
 values(auth.uid(),'enrollment',en.id::text,'cohort_member_leave_v2',
 jsonb_build_object('status',en.status),
 jsonb_build_object('leave_from',p_from,'resume_from',p_resume,'reason',p_reason,'batch_schedule_unchanged',true));
 insert into public.portal_notifications(recipient_role,student_id,trainer_id,type,priority,title,message,href)
 values('parent',en.student_id,en.trainer_id,'cohort_leave','info','Leave recorded',
 'Your learner is excused from cohort sessions during the approved break; other classes continue.','/parent');
 return jsonb_build_object('moved',0,'shiftDays',0,'cohortUnchanged',true);
end $function$
;
CREATE OR REPLACE FUNCTION public.pause_enrollment_v2(p_enrollment_id uuid, p_from date, p_resume date, p_reason text, p_note text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
 v_en public.enrollments%rowtype;
 v_days integer; v_shift integer; v_count integer:=0;
 v_event public.schedule_events%rowtype;
 v_target_date date;
 v_from timestamptz;v_to timestamptz;
 v_is_admin boolean;
begin
 v_is_admin:=public.is_admin();
 select * into v_en from public.enrollments where id=p_enrollment_id for update;
 if saas.has_organization_membership() and not saas.can_access_academy_record('enrollments',v_en.id) then
  raise exception 'Cross-organization enrollment operation denied' using errcode='42501';
 end if;
 if not found then raise exception 'Enrollment not found'; end if;
 if not (v_is_admin or (public.current_trainer_id()=v_en.trainer_id and auth.uid() is not null))
 then raise exception 'Not authorized to pause this learner'; end if;
 if v_en.enrollment_type<>'one_to_one' then raise exception 'An individual cohort learner does not pause the batch calendar'; end if;
 if v_en.status<>'active' then raise exception 'Only active enrollments can be paused'; end if;
 if p_reason not in ('exams','medical','travel','family','other') then raise exception 'Choose a valid pause reason'; end if;
 if p_from is null or p_resume is null or p_resume<=p_from then raise exception 'Choose valid pause and resume dates'; end if;
 if p_from<(now() at time zone v_en.schedule_timezone)::date then raise exception 'Cannot backdate a pause'; end if;
 v_days:=p_resume-p_from;
 if v_days>14 and not v_is_admin then raise exception 'Pauses longer than 14 days need Admin approval'; end if;
 if v_days>365 then raise exception 'Pause cannot exceed one year'; end if;
 v_shift:=((v_days+6)/7)*7;
 -- Lock trainer to protect against concurrent V2 scheduling/reassignment.
 perform 1 from public.trainers where id=v_en.trainer_id for update;
 for v_event in select * from public.schedule_events
   where enrollment_id=p_enrollment_id and event_type='class'
     and date>=p_from and status not in ('cancelled','rescheduled','conducted')
   order by date,start_time,id for update
 loop
   if v_event.status not in ('scheduled','tentative') or v_event.occurrence_kind<>'regular'
   then raise exception 'Modified or makeup class % needs individual review',v_event.id; end if;
   if exists(select 1 from public.class_attendance where schedule_event_id=v_event.id)
      or exists(select 1 from public.trainer_earnings where schedule_event_id=v_event.id and status in ('approved','paid'))
   then raise exception 'A future class has protected attendance or payroll'; end if;
   if exists(select 1 from public.zoom_meetings
    where schedule_event_id=v_event.id and status in ('scheduled','started'))
   then raise exception 'Class % already has an individual Zoom meeting. Reconcile its Zoom meeting before moving dates',v_event.id;
   end if;
   v_target_date:=v_event.date+v_shift;
   v_from:=(v_target_date+v_event.start_time) at time zone v_event.timezone;
   v_to:=(v_target_date+v_event.end_time) at time zone v_event.timezone;
   if exists(select 1 from public.schedule_events other
    where other.enrollment_id is distinct from p_enrollment_id
      and other.trainer_id=v_en.trainer_id and other.status not in ('cancelled','rescheduled')
      and ((other.date+other.start_time) at time zone other.timezone)<v_to
      and ((other.date+other.end_time) at time zone other.timezone)>v_from)
   then raise exception 'Shifted class conflicts with another trainer booking on %',v_target_date; end if;
   if exists(select 1 from public.schedule_events other
    where other.enrollment_id is distinct from p_enrollment_id
     and other.status not in ('cancelled','rescheduled')
     and (other.student_id=v_en.student_id or other.enrollment_id in
         (select id from public.enrollments where student_id=v_en.student_id)
          or other.cohort_id in (select cohort_id from public.enrollments
              where student_id=v_en.student_id and cohort_id is not null))
     and ((other.date+other.start_time) at time zone other.timezone)<v_to
     and ((other.date+other.end_time) at time zone other.timezone)>v_from)
   then raise exception 'Shifted class conflicts with another learner booking on %',v_target_date; end if;
   if exists(select 1 from public.trainer_availability_overrides o
    where o.trainer_id=v_en.trainer_id and o.date=v_target_date
      and o.override_type='unavailable' and o.start_time<v_event.end_time and o.end_time>v_event.start_time)
   then raise exception 'Trainer is unavailable on shifted date %',v_target_date; end if;
 end loop;
 update public.schedule_events
 set date=date+v_shift,requested_by=case when v_is_admin then 'admin' else 'trainer' end,
     change_reason=coalesce(change_reason||' | ','')||'Shifted '||v_shift::text||' days for '||p_reason||' break',
     updated_at=now()
 where enrollment_id=p_enrollment_id and event_type='class' and date>=p_from
   and status in ('scheduled','tentative') and occurrence_kind='regular';
 get diagnostics v_count=row_count;
 update public.enrollments set status='on_hold',hold_reason=p_reason,hold_from=p_from,
  hold_until=p_resume,hold_note=p_note,updated_at=now()
 where id=p_enrollment_id;
 insert into public.portal_audit_log(actor_profile_id,entity_type,entity_id,action,before_data,after_data)
 values(auth.uid(),'enrollment',p_enrollment_id::text,'pause_enrollment_v2',
 jsonb_build_object('status',v_en.status,'trainer_id',v_en.trainer_id),
 jsonb_build_object('pause_from',p_from,'resume_from',p_resume,'reason',p_reason,
                    'shift_days',v_shift,'classes_moved',v_count));
 insert into public.portal_notifications(recipient_role,student_id,trainer_id,type,priority,title,message,href)
 values('parent',v_en.student_id,v_en.trainer_id,'enrollment_paused','important',
 'Classes paused','Your agreed class break has been recorded and the future schedule adjusted.','/parent'),
 ('trainer',v_en.student_id,v_en.trainer_id,'enrollment_paused','info',
 'Learner on break','A learner is on a scheduled break. Review the updated timetable.','/trainer/classes');
 return jsonb_build_object('moved',v_count,'shiftDays',v_shift,'resumeFrom',p_resume);
end $function$
;
CREATE OR REPLACE FUNCTION public.reschedule_class_v2(p_event_id uuid, p_date date, p_start time without time zone, p_end time without time zone, p_requested_by text, p_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare e public.schedule_events%rowtype; new_id uuid; v_start timestamptz; v_end timestamptz;
begin
 select * into e from public.schedule_events where id=p_event_id for update;
 if saas.has_organization_membership() and not saas.can_access_academy_record('schedule_events',e.id) then
  raise exception 'Cross-organization class operation denied' using errcode='42501';
 end if;
 if not found or e.event_type<>'class' then raise exception 'Class not found'; end if;
 if e.cohort_id is not null and not public.is_admin() then raise exception 'Shared cohort changes require Admin'; end if;
 if not (public.is_admin() or (auth.uid() is not null and public.current_trainer_id()=e.trainer_id))
 then raise exception 'Not authorized to reschedule this class'; end if;
 if e.status not in ('scheduled','tentative','makeup') then raise exception 'Class has already been changed or delivered'; end if;
 if (e.date+e.start_time) at time zone e.timezone <=now() then raise exception 'Past classes need Admin review'; end if;
 if p_requested_by not in ('parent','student','trainer','admin') or nullif(trim(coalesce(p_reason,'')),'') is null
 then raise exception 'Initiator and reason are required'; end if;
 if p_start is null or p_end is null or p_end<=p_start or
    extract(minute from p_start)::integer%30<>0 or extract(minute from p_end)::integer%30<>0 or
    (extract(epoch from (p_end-p_start))::integer/60) not in (60,90,120,150)
 then raise exception 'Choose a valid 1–2.5 hour class in 30-minute steps'; end if;
 if exists(select 1 from public.trainer_availability_overrides o
   where o.trainer_id=e.trainer_id and o.date=p_date and o.override_type='unavailable'
     and o.start_time<p_end and o.end_time>p_start)
 then raise exception 'Trainer is unavailable on this date'; end if;
 v_start:=(p_date+p_start) at time zone e.timezone;
 v_end:=(p_date+p_end) at time zone e.timezone;
 if v_start<=now() then raise exception 'Replacement must be in the future'; end if;
 if exists(select 1 from public.class_attendance where schedule_event_id=e.id)
 or exists(select 1 from public.trainer_earnings where schedule_event_id=e.id and status in ('approved','paid'))
 then raise exception 'Protected class history must remain unchanged'; end if;
 if exists(select 1 from public.zoom_meetings where schedule_event_id=e.id and status in ('scheduled','started'))
 then raise exception 'Class already has a per-session Zoom meeting; Admin must reconcile Zoom before rescheduling'; end if;
 if exists(select 1 from public.schedule_events x where x.id<>e.id and x.trainer_id=e.trainer_id
  and x.status not in ('cancelled','rescheduled')
  and ((x.date+x.start_time) at time zone x.timezone)<v_end
  and ((x.date+x.end_time) at time zone x.timezone)>v_start)
 then raise exception 'Trainer has another booking at the new time'; end if;
 if e.student_id is not null and exists(
  select 1 from public.schedule_events x where x.id<>e.id and x.status not in ('cancelled','rescheduled')
  and (x.student_id=e.student_id or x.enrollment_id in
      (select id from public.enrollments where student_id=e.student_id)
      or x.cohort_id in (select cohort_id from public.enrollments where student_id=e.student_id and cohort_id is not null))
  and ((x.date+x.start_time) at time zone x.timezone)<v_end
  and ((x.date+x.end_time) at time zone x.timezone)>v_start)
 then raise exception 'Learner has another booking at the new time'; end if;
 if e.cohort_id is not null and exists(
  select 1 from public.schedule_events x
  where x.id<>e.id and x.status not in ('cancelled','rescheduled')
    and (x.student_id in (select student_id from public.enrollments where cohort_id=e.cohort_id and status='active')
       or x.enrollment_id in (select id from public.enrollments where cohort_id=e.cohort_id and status='active'))
    and (x.date+x.start_time) at time zone x.timezone<v_end
    and (x.date+x.end_time) at time zone x.timezone>v_start)
 then raise exception 'A cohort learner has another booking at the proposed time'; end if;
 perform 1 from public.trainers where id=e.trainer_id for update;
 insert into public.schedule_events
 (trainer_id,course_id,enrollment_id,cohort_id,student_id,title,date,start_time,end_time,
 timezone,event_type,delivery_mode,status,occurrence_kind,original_event_id,requested_by,change_reason,notes)
 values(e.trainer_id,e.course_id,e.enrollment_id,e.cohort_id,e.student_id,e.title,p_date,p_start,p_end,
 e.timezone,'class',e.delivery_mode,'scheduled','rescheduled_replacement',e.id,p_requested_by,p_reason,e.notes)
 returning id into new_id;
 update public.schedule_events set status='rescheduled',rescheduled_to_id=new_id,
 requested_by=p_requested_by,change_reason=p_reason,updated_at=now() where id=e.id;
 insert into public.portal_audit_log(actor_profile_id,entity_type,entity_id,action,before_data,after_data)
 values(auth.uid(),'schedule_event',e.id::text,'reschedule_class_v2',
 jsonb_build_object('date',e.date,'start',e.start_time,'end',e.end_time),
 jsonb_build_object('date',p_date,'start',p_start,'end',p_end,'replacement',new_id,'reason',p_reason));
 if e.student_id is not null then
  insert into public.portal_notifications(recipient_role,student_id,trainer_id,type,priority,title,message,href)
  values('parent',e.student_id,e.trainer_id,'class_rescheduled','important','Class rescheduled','The class time has changed. Please check the updated schedule.','/parent'),
  ('student',e.student_id,e.trainer_id,'class_rescheduled','info','Class rescheduled','Please check your updated class time.','/student');
 end if;
 if e.cohort_id is not null then
   insert into public.portal_notifications(recipient_role,student_id,trainer_id,type,priority,title,message,href)
   select 'parent',en.student_id,e.trainer_id,'class_rescheduled','important',
      'Batch class rescheduled','Your shared batch class time has changed. Check the timetable.','/parent'
   from public.enrollments en where en.cohort_id=e.cohort_id and en.status in ('active','on_hold');
 end if;
 return new_id;
end $function$
;
CREATE OR REPLACE FUNCTION public.resolve_class_cancellation_v2(p_event_id uuid, p_decision text, p_reason text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare e public.schedule_events%rowtype;
begin
 if not public.is_admin() then raise exception 'Admin approval required'; end if;
 if p_decision not in ('approved','rejected') or nullif(trim(coalesce(p_reason,'')),'') is null
 then raise exception 'Choose approve/reject and record the reason'; end if;
 select * into e from public.schedule_events where id=p_event_id for update;
 if saas.has_organization_membership() and not saas.can_access_academy_record('schedule_events',e.id) then
  raise exception 'Cross-organization class operation denied' using errcode='42501';
 end if;
 if not found or e.status<>'cancelled' or e.finance_exception_status<>'review'
 then raise exception 'Class is not awaiting cancellation review'; end if;
 if exists(select 1 from public.trainer_earnings where schedule_event_id=e.id and status in ('approved','paid'))
 then raise exception 'Existing locked earnings require a separate payroll correction'; end if;
 update public.schedule_events set finance_exception_status=p_decision,
 finance_exception_note=trim(p_reason),updated_at=now() where id=e.id;
 if p_decision='approved' then
   -- The Admin has explicitly approved this exception. Compensation is
   -- calculated according to the existing trainer cancellation pay policy.
   perform public.sync_trainer_earning(e.id,true);
 end if;
 insert into public.portal_audit_log(actor_profile_id,entity_type,entity_id,action,before_data,after_data)
 values(auth.uid(),'schedule_event',e.id::text,'resolve_cancellation_v2',
 jsonb_build_object('finance_exception_status',e.finance_exception_status),
 jsonb_build_object('finance_exception_status',p_decision,'reason',trim(p_reason)));
 insert into public.portal_notifications(recipient_role,student_id,trainer_id,type,priority,title,message,href)
 values('trainer',e.student_id,e.trainer_id,'cancellation_review_resolved','info',
 'Cancellation review resolved','An Admin has reviewed a class cancellation and its financial treatment.','/trainer/classes');
 return true;
end $function$
;
CREATE OR REPLACE FUNCTION public.resume_enrollment_v2(p_enrollment_id uuid, p_note text DEFAULT ''::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_en public.enrollments%rowtype;
begin
 select * into v_en from public.enrollments where id=p_enrollment_id for update;
 if saas.has_organization_membership() and not saas.can_access_academy_record('enrollments',v_en.id) then
  raise exception 'Cross-organization enrollment operation denied' using errcode='42501';
 end if;
 if not found then raise exception 'Enrollment not found'; end if;
 if not (public.is_admin() or (auth.uid() is not null and public.current_trainer_id()=v_en.trainer_id))
 then raise exception 'Not authorized to resume this learner'; end if;
 if v_en.status<>'on_hold' then raise exception 'Enrollment is not paused'; end if;
 if not public.is_admin() and (now() at time zone v_en.schedule_timezone)::date<v_en.hold_until
 then raise exception 'Early resume requires Admin approval'; end if;
 update public.enrollments set status='active',hold_note=concat_ws(' | ',hold_note,'Resumed: '||coalesce(p_note,'')),updated_at=now()
  where id=p_enrollment_id;
 insert into public.portal_audit_log(actor_profile_id,entity_type,entity_id,action,before_data,after_data)
 values(auth.uid(),'enrollment',p_enrollment_id::text,'resume_enrollment_v2',
 jsonb_build_object('status',v_en.status,'hold_until',v_en.hold_until),
 jsonb_build_object('status','active','note',p_note));
 insert into public.portal_notifications(recipient_role,student_id,trainer_id,type,priority,title,message,href)
 values('parent',v_en.student_id,v_en.trainer_id,'enrollment_resumed','info',
 'Classes resumed','The learner schedule is active again.','/parent'),
 ('trainer',v_en.student_id,v_en.trainer_id,'enrollment_resumed','info',
 'Learner resumed','The learner is active again.','/trainer/classes');
 return true;
end $function$
;
COMMIT;
