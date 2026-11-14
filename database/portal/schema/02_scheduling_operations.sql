-- ============================================================
-- Operations additions
-- ============================================================
-- Operations and workflow controls

-- Outcome-led course catalogue metadata and flexible Maker Lab tracking.
alter table public.courses add column if not exists public_name text;
alter table public.courses add column if not exists internal_name text;
alter table public.courses add column if not exists outcome_subtitle text not null default '';
update public.courses set public_name=coalesce(public_name,title), internal_name=coalesce(internal_name,nullif(short_title,''),title);
alter table public.courses alter column public_name set not null;
alter table public.courses alter column internal_name set not null;
alter table public.courses drop constraint if exists courses_total_sessions_check;
alter table public.courses add constraint courses_total_sessions_check check(total_sessions >= 0);

-- Delivery channel / offline Maker Lab tracking.
alter table public.cohorts add column if not exists delivery_channel text not null default 'online';
alter table public.cohorts add column if not exists center_location text not null default '';
alter table public.cohorts add column if not exists schedule_mode text not null default 'recurring';
alter table public.cohorts drop constraint if exists cohorts_delivery_channel_check;
alter table public.cohorts add constraint cohorts_delivery_channel_check check(delivery_channel in ('online','offline','hybrid'));
alter table public.cohorts drop constraint if exists cohorts_schedule_mode_check;
alter table public.cohorts add constraint cohorts_schedule_mode_check check(schedule_mode in ('recurring','flexible','ad_hoc'));
alter table public.enrollments add column if not exists delivery_channel text not null default 'online';
alter table public.enrollments add column if not exists center_location text not null default '';
alter table public.enrollments add column if not exists schedule_mode text not null default 'recurring';
alter table public.enrollments drop constraint if exists enrollments_delivery_channel_check;
alter table public.enrollments add constraint enrollments_delivery_channel_check check(delivery_channel in ('online','offline','hybrid'));
alter table public.enrollments drop constraint if exists enrollments_schedule_mode_check;
alter table public.enrollments add constraint enrollments_schedule_mode_check check(schedule_mode in ('recurring','flexible','ad_hoc'));

-- Actual occurrence history / reschedule linkage.
alter table public.schedule_events add column if not exists occurrence_kind text not null default 'regular';
alter table public.schedule_events add column if not exists original_event_id uuid references public.schedule_events(id) on delete set null;
alter table public.schedule_events add column if not exists requested_by text;
alter table public.schedule_events add column if not exists change_reason text;
alter table public.schedule_events add column if not exists session_topic text;
alter table public.schedule_events add column if not exists project_worked_on text;
alter table public.schedule_events add column if not exists skills_worked text[] not null default '{}';
alter table public.schedule_events drop constraint if exists schedule_events_occurrence_kind_check;
alter table public.schedule_events add constraint schedule_events_occurrence_kind_check check(occurrence_kind in ('regular','rescheduled_replacement','makeup','ad_hoc','extra'));
alter table public.schedule_events drop constraint if exists schedule_events_requested_by_check;
alter table public.schedule_events add constraint schedule_events_requested_by_check check(requested_by is null or requested_by in ('parent','student','trainer','admin'));
alter table public.schedule_events drop constraint if exists schedule_events_status_check;
alter table public.schedule_events add constraint schedule_events_status_check check(status in ('scheduled','tentative','conducted','cancelled','rescheduled','blocked','missed','makeup'));
alter table public.schedule_events drop constraint if exists schedule_events_delivery_mode_check;
alter table public.schedule_events add constraint schedule_events_delivery_mode_check check(delivery_mode in ('one_to_one','small_group','school','online','offline','hybrid'));

-- Restricted trainer payout/compliance record. No Aadhaar is collected.
create table if not exists public.trainer_finance (
 id uuid primary key default gen_random_uuid(),
 trainer_id uuid not null unique references public.trainers(id) on delete restrict,
 account_holder_name text not null default '', bank_name text not null default '', account_number text not null default '',
 ifsc text not null default '', upi_id text not null default '',
 preferred_payout_method text not null default 'bank' check(preferred_payout_method in ('bank','upi','other')),
 payment_model text not null default 'per_class' check(payment_model in ('per_class','hourly','monthly','retainer','other')),
 payment_rate numeric(12,2), pan text not null default '',
 compliance_status text not null default 'pending' check(compliance_status in ('pending','verified','needs_update')),
 notes text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.trainer_finance enable row level security;
drop policy if exists trainer_finance_admin_select on public.trainer_finance;
create policy trainer_finance_admin_select on public.trainer_finance for select using(public.is_admin());
drop policy if exists trainer_finance_admin_insert on public.trainer_finance;
create policy trainer_finance_admin_insert on public.trainer_finance for insert with check(public.is_admin());
drop policy if exists trainer_finance_admin_update on public.trainer_finance;
create policy trainer_finance_admin_update on public.trainer_finance for update using(public.is_admin()) with check(public.is_admin());
drop policy if exists trainer_finance_admin_delete on public.trainer_finance;
create policy trainer_finance_admin_delete on public.trainer_finance for delete using(public.is_admin());

-- Configurable in-app reminder policies.
create table if not exists public.reminder_policies (
 id text primary key,
 event_type text not null check(event_type in ('class','attendance_pending')),
 recipient_role text not null check(recipient_role in ('trainer','parent','student','admin')),
 minutes_before int, minutes_after int, enabled boolean not null default true,
 updated_at timestamptz not null default now(),
 check((event_type='class' and minutes_before is not null and minutes_before >= 0) or (event_type='attendance_pending' and minutes_after is not null and minutes_after >= 0))
);
insert into public.reminder_policies(id,event_type,recipient_role,minutes_before,minutes_after,enabled) values
 ('rem-trainer-30','class','trainer',30,null,true),
 ('rem-trainer-10','class','trainer',10,null,true),
 ('rem-parent-30','class','parent',30,null,true),
 ('rem-student-15','class','student',15,null,true),
 ('rem-trainer-update-30','attendance_pending','trainer',null,30,true)
on conflict(id) do nothing;
alter table public.reminder_policies enable row level security;
drop policy if exists reminder_policies_admin_all on public.reminder_policies;
create policy reminder_policies_admin_all on public.reminder_policies for all using(public.is_admin()) with check(public.is_admin());

-- Notification dedupe lets a scheduled job safely run repeatedly.
alter table public.portal_notifications add column if not exists dedupe_key text;
create unique index if not exists portal_notifications_dedupe_uidx on public.portal_notifications(dedupe_key) where dedupe_key is not null;

-- Produce class reminders from the actual dated occurrence. PostgreSQL AT TIME ZONE uses the IANA timezone database,
-- so DST and non-hour offsets are resolved per class date rather than hard-coded.
create or replace function public.process_class_reminders()
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 p record; e record; sid uuid; class_at timestamptz; end_at timestamptz; target_at timestamptz; inserted_count int:=0; rc int:=0;
begin
 for p in select * from public.reminder_policies where enabled loop
  for e in select se.* from public.schedule_events se where se.event_type='class' and se.status='scheduled' loop
   class_at := (e.date + e.start_time) at time zone e.timezone;
   end_at := (e.date + e.end_time) at time zone e.timezone;
   if p.event_type='class' then target_at:=class_at-make_interval(mins=>p.minutes_before);
   else target_at:=end_at+make_interval(mins=>p.minutes_after); end if;
   -- 10 minute catch-up window makes a 5-minute scheduler resilient to brief delay.
   if now() < target_at or now() >= target_at + interval '10 minutes' then continue; end if;
   if p.event_type='attendance_pending' and exists(select 1 from public.class_attendance ca where ca.schedule_event_id=e.id) then continue; end if;
   if p.recipient_role='trainer' then
    insert into public.portal_notifications(recipient_role,trainer_id,student_id,type,priority,title,message,href,dedupe_key)
    values('trainer',e.trainer_id,e.student_id,case when p.event_type='class' then 'class_reminder' else 'attendance_update_pending' end,
      case when p.event_type='class' then 'info' else 'action' end,
      case when p.event_type='class' then 'Upcoming class' else 'Class update pending' end,
      case when p.event_type='class' then e.title||' starts in '||p.minutes_before||' minutes.' else e.title||' ended '||p.minutes_after||' minutes ago. Please record attendance and learning updates.' end,
      '/trainer/classes',e.id::text||':'||p.id)
    on conflict(dedupe_key) where dedupe_key is not null do nothing;
    get diagnostics rc = row_count; inserted_count := inserted_count + rc;
   elsif p.recipient_role in ('parent','student') and p.event_type='class' then
    for sid in
      select distinct x.student_id from (
        select e.student_id as student_id where e.student_id is not null
        union all
        select en.student_id from public.enrollments en where e.cohort_id is not null and en.cohort_id=e.cohort_id and en.status='active'
      ) x where x.student_id is not null
    loop
      insert into public.portal_notifications(recipient_role,student_id,trainer_id,type,priority,title,message,href,dedupe_key)
      values(p.recipient_role,sid,e.trainer_id,'class_reminder','info','Class reminder',
        'Your Robotronix™ class starts in '||p.minutes_before||' minutes.',case when p.recipient_role='parent' then '/parent' else '/student' end,
        e.id::text||':'||p.id||':'||sid::text)
      on conflict(dedupe_key) where dedupe_key is not null do nothing;
      get diagnostics rc = row_count; inserted_count := inserted_count + rc;
    end loop;
   end if;
  end loop;
 end loop;
 return jsonb_build_object('ok',true,'processed_at',now(),'inserted',inserted_count);
end $$;
revoke all on function public.process_class_reminders() from public, anon, authenticated;
grant execute on function public.process_class_reminders() to service_role;

-- Safe-delete protection at DB level. Core/history records should be archived/deactivated rather than destroyed.
create or replace function public.guard_course_delete() returns trigger language plpgsql as $$begin
 if exists(select 1 from public.enrollments where course_id=old.id) or exists(select 1 from public.cohorts where course_id=old.id) or exists(select 1 from public.schedule_events where course_id=old.id) or exists(select 1 from public.trainer_courses where course_id=old.id) or exists(select 1 from public.learner_projects where course_id=old.id) then raise exception 'Course/program has operational or historical references. Archive it instead.'; end if; return old; end$$;
drop trigger if exists guard_course_delete_trg on public.courses;create trigger guard_course_delete_trg before delete on public.courses for each row execute function public.guard_course_delete();

create or replace function public.guard_trainer_delete() returns trigger language plpgsql as $$begin
 if exists(select 1 from public.enrollments where trainer_id=old.id) or exists(select 1 from public.cohorts where trainer_id=old.id) or exists(select 1 from public.schedule_events where trainer_id=old.id) or exists(select 1 from public.trainer_feedback where trainer_id=old.id) or exists(select 1 from public.learning_observations where trainer_id=old.id) or exists(select 1 from public.trainer_finance where trainer_id=old.id) then raise exception 'Trainer has operational or historical references. Deactivate/offboard instead.'; end if; return old; end$$;
drop trigger if exists guard_trainer_delete_trg on public.trainers;create trigger guard_trainer_delete_trg before delete on public.trainers for each row execute function public.guard_trainer_delete();

create or replace function public.guard_student_delete() returns trigger language plpgsql as $$begin
 if exists(select 1 from public.enrollments where student_id=old.id) or exists(select 1 from public.schedule_events where student_id=old.id) or exists(select 1 from public.class_attendance where student_id=old.id) or exists(select 1 from public.learner_projects where student_id=old.id) or exists(select 1 from public.trainer_feedback where student_id=old.id) then raise exception 'Learner has history. Archive the learner instead.'; end if; return old; end$$;
drop trigger if exists guard_student_delete_trg on public.students;create trigger guard_student_delete_trg before delete on public.students for each row execute function public.guard_student_delete();

create or replace function public.guard_enrollment_delete() returns trigger language plpgsql as $$begin
 if exists(select 1 from public.schedule_events where enrollment_id=old.id) or exists(select 1 from public.class_attendance where enrollment_id=old.id) or exists(select 1 from public.learning_observations where enrollment_id=old.id) or exists(select 1 from public.trainer_feedback where enrollment_id=old.id) or exists(select 1 from public.learner_projects where enrollment_id=old.id) or exists(select 1 from public.enrollment_holds where enrollment_id=old.id) then raise exception 'Enrollment has learning/history records. Complete, cancel or archive it instead.'; end if; return old; end$$;
drop trigger if exists guard_enrollment_delete_trg on public.enrollments;create trigger guard_enrollment_delete_trg before delete on public.enrollments for each row execute function public.guard_enrollment_delete();

create or replace function public.guard_cohort_delete() returns trigger language plpgsql as $$begin
 if exists(select 1 from public.enrollments where cohort_id=old.id) or exists(select 1 from public.schedule_events where cohort_id=old.id) then raise exception 'Cohort has learner/class history. Archive or complete it instead.'; end if; return old; end$$;
drop trigger if exists guard_cohort_delete_trg on public.cohorts;create trigger guard_cohort_delete_trg before delete on public.cohorts for each row execute function public.guard_cohort_delete();

create or replace function public.guard_schedule_delete() returns trigger language plpgsql as $$begin
 if exists(select 1 from public.class_attendance where schedule_event_id=old.id) or exists(select 1 from public.learning_observations where schedule_event_id=old.id) then raise exception 'Class has attendance/progress history. Cancel/reschedule it instead of deleting.'; end if; return old; end$$;
drop trigger if exists guard_schedule_delete_trg on public.schedule_events;create trigger guard_schedule_delete_trg before delete on public.schedule_events for each row execute function public.guard_schedule_delete();

-- Minimal audit trail for consequential operational/finance changes.
create table if not exists public.portal_audit_log(
 id bigint generated always as identity primary key, actor_profile_id uuid, entity_type text not null, entity_id text not null,
 action text not null, before_data jsonb, after_data jsonb, created_at timestamptz not null default now()
);
alter table public.portal_audit_log enable row level security;
drop policy if exists audit_admin_select on public.portal_audit_log;create policy audit_admin_select on public.portal_audit_log for select using(public.is_admin());
create or replace function public.audit_core_change()
returns trigger language plpgsql security definer set search_path=public as $$
declare
 row_data jsonb;
 eid text;
begin
 row_data:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 eid:=coalesce(
   row_data->>'id',
   case when row_data ? 'parent_id' and row_data ? 'student_id' then (row_data->>'parent_id')||':'||(row_data->>'student_id') end,
   case when row_data ? 'trainer_id' and row_data ? 'course_id' then (row_data->>'trainer_id')||':'||(row_data->>'course_id') end,
   case when row_data ? 'target_type' and row_data ? 'target_id' then (row_data->>'target_type')||':'||(row_data->>'target_id') end,
   row_data->>'student_id', row_data->>'enrollment_id', row_data->>'schedule_event_id',
   row_data->>'trainer_id', row_data->>'course_id', row_data->>'target_id', md5(row_data::text)
 );
 insert into public.portal_audit_log(actor_profile_id,entity_type,entity_id,action,before_data,after_data)
 values(auth.uid(),tg_table_name,eid,tg_op,case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end);
 if tg_op='DELETE' then return old; else return new; end if;
end$$;
do $$declare t text;begin foreach t in array array['courses','trainers','students','student_guardians','parent_students','enrollments','cohorts','onboarding_submissions','schedule_events','class_attendance','learning_observations','learning_observation_internal_notes','trainer_feedback','learner_projects','enrollment_holds','trainer_availability','trainer_availability_overrides','trainer_finance','trainer_compensation_plans','trainer_earnings','trainer_payouts','student_fee_packages','student_fee_payments','correction_requests'] loop if to_regclass('public.'||t) is not null then execute format('drop trigger if exists audit_%I on public.%I',t,t);execute format('create trigger audit_%I after insert or update or delete on public.%I for each row execute function public.audit_core_change()',t,t);end if;end loop;end$$;

-- Trainer Payroll / Class Earnings — class delivery is the source of truth.

create table if not exists public.trainer_compensation_plans(
 id uuid primary key default gen_random_uuid(),
 trainer_id uuid not null references public.trainers(id) on delete restrict,
 timezone text not null default 'Asia/Kolkata',
 day_start time not null default '08:00', day_end time not null default '22:00',
 one_to_one_day numeric(12,2) not null default 300, one_to_one_night numeric(12,2) not null default 400,
 group_day numeric(12,2) not null default 350, group_night numeric(12,2) not null default 450,
 demo_day numeric(12,2) not null default 80, demo_night numeric(12,2) not null default 100,
 demo_conversion_day numeric(12,2) not null default 50, demo_conversion_night numeric(12,2) not null default 100,
 no_show_percent numeric(5,2) not null default 0 check(no_show_percent between 0 and 100),
 cancelled_percent numeric(5,2) not null default 0 check(cancelled_percent between 0 and 100),
 effective_from date not null default current_date,
 notes text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(trainer_id,effective_from)
);

create table if not exists public.trainer_earnings(
 id uuid primary key default gen_random_uuid(),
 trainer_id uuid not null references public.trainers(id) on delete restrict,
 schedule_event_id uuid not null unique references public.schedule_events(id) on delete restrict,
 earning_date date not null,
 session_type text not null check(session_type in ('one_to_one','small_group','demo','school','workshop','other')),
 pay_band text not null check(pay_band in ('day','night')),
 duration_minutes int not null default 60 check(duration_minutes > 0), learner_count int not null default 1 check(learner_count >= 0),
 class_outcome text not null check(class_outcome in ('completed','no_show','cancelled')),
 base_rate numeric(12,2) not null default 0, duration_factor numeric(8,4) not null default 1,
 conversion_bonus numeric(12,2) not null default 0, adjustment numeric(12,2) not null default 0,
 total_amount numeric(12,2) not null default 0, conversion_applied boolean not null default false,
 status text not null default 'pending' check(status in ('pending','approved','paid','void')),
 adjustment_reason text, notes text, approved_at timestamptz, paid_at timestamptz, payment_reference text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists trainer_earnings_trainer_date_idx on public.trainer_earnings(trainer_id,earning_date desc);

create table if not exists public.trainer_payouts(
 id uuid primary key default gen_random_uuid(), trainer_id uuid not null references public.trainers(id) on delete restrict,
 period_month text not null check(period_month ~ '^[0-9]{4}-[0-9]{2}$'),
 gross_amount numeric(12,2) not null default 0, adjustment_amount numeric(12,2) not null default 0, payable_amount numeric(12,2) not null default 0,
 status text not null default 'draft' check(status in ('draft','approved','paid')),
 approved_at timestamptz, paid_at timestamptz, payment_reference text, notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(trainer_id,period_month)
);

alter table public.trainer_compensation_plans enable row level security;
alter table public.trainer_earnings enable row level security;
alter table public.trainer_payouts enable row level security;

drop policy if exists trainer_comp_plans_admin_all on public.trainer_compensation_plans;
create policy trainer_comp_plans_admin_all on public.trainer_compensation_plans for all using(public.is_admin()) with check(public.is_admin());
drop policy if exists trainer_comp_plans_trainer_select on public.trainer_compensation_plans;
create policy trainer_comp_plans_trainer_select on public.trainer_compensation_plans for select using(trainer_id=public.current_trainer_id());

drop policy if exists trainer_earnings_admin_all on public.trainer_earnings;
create policy trainer_earnings_admin_all on public.trainer_earnings for all using(public.is_admin()) with check(public.is_admin());
drop policy if exists trainer_earnings_trainer_select on public.trainer_earnings;
create policy trainer_earnings_trainer_select on public.trainer_earnings for select using(trainer_id=public.current_trainer_id());

drop policy if exists trainer_payouts_admin_all on public.trainer_payouts;
create policy trainer_payouts_admin_all on public.trainer_payouts for all using(public.is_admin()) with check(public.is_admin());
drop policy if exists trainer_payouts_trainer_select on public.trainer_payouts;
create policy trainer_payouts_trainer_select on public.trainer_payouts for select using(trainer_id=public.current_trainer_id());

-- Defaults only if no plan exists. Admin can change each trainer independently.
insert into public.trainer_compensation_plans(trainer_id,effective_from)
select t.id,current_date from public.trainers t
where not exists(select 1 from public.trainer_compensation_plans p where p.trainer_id=t.id)
on conflict do nothing;

-- Scheduling V2: review-first financial policy for class cancellations.
alter table public.schedule_events add column if not exists finance_exception_status text not null default 'none';
alter table public.schedule_events add column if not exists finance_exception_note text;
alter table public.schedule_events drop constraint if exists schedule_events_finance_exception_status_check;
alter table public.schedule_events add constraint schedule_events_finance_exception_status_check
 check(finance_exception_status in ('none','review','approved','rejected'));

create or replace function public.mark_class_cancellation_for_review_v2()
returns trigger language plpgsql set search_path=public as $$
begin
 if new.event_type='class' and new.status='cancelled'
    and (tg_op='INSERT' or old.status is distinct from new.status) then
   new.finance_exception_status:=case when new.requested_by='parent' then 'review' else 'none' end;
 end if;
 return new;
end $$;
drop trigger if exists mark_class_cancellation_for_review_v2 on public.schedule_events;
create trigger mark_class_cancellation_for_review_v2 before insert or update of status on public.schedule_events
 for each row execute function public.mark_class_cancellation_for_review_v2();

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
 if e.status='cancelled' and coalesce(e.finance_exception_status,'none')<>'approved' then
   if olde.id is not null and olde.status not in ('approved','paid') then
     update public.trainer_earnings set status='void',total_amount=0,updated_at=now() where id=olde.id;
   end if;
   return olde.id;
 end if;
 if e.status not in ('conducted','cancelled') then return coalesce(olde.id,null); end if;
 class_at := (e.date + e.start_time) at time zone e.timezone;
 end_at := (e.date + e.end_time) at time zone e.timezone;
 pay_local := class_at at time zone p.timezone;
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
 factor := case when stype='demo' then 1 else duration_mins/60.0 end;
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

create or replace function public.trg_sync_trainer_earning() returns trigger language plpgsql security definer set search_path=public as $$begin
 if new.event_type in ('class','demo') and new.status in ('conducted','cancelled') then perform public.sync_trainer_earning(new.id,false); end if; return new; end$$;
drop trigger if exists sync_trainer_earning_on_event on public.schedule_events;
create trigger sync_trainer_earning_on_event after insert or update of status,date,start_time,end_time,timezone,trainer_id,delivery_mode,event_type on public.schedule_events for each row execute function public.trg_sync_trainer_earning();

create or replace function public.trg_sync_trainer_earning_from_attendance() returns trigger language plpgsql security definer set search_path=public as $$declare eid uuid;begin if tg_op='DELETE' then eid:=old.schedule_event_id; else eid:=new.schedule_event_id; end if;if exists(select 1 from public.schedule_events where id=eid and status='conducted') then perform public.sync_trainer_earning(eid,false);end if;if tg_op='DELETE' then return old; else return new; end if;end$$;
drop trigger if exists sync_trainer_earning_on_attendance on public.class_attendance;
create trigger sync_trainer_earning_on_attendance after insert or update or delete on public.class_attendance for each row execute function public.trg_sync_trainer_earning_from_attendance();

-- Include payroll records in delete protection and audit history.
create or replace function public.guard_trainer_delete() returns trigger language plpgsql as $$begin
 if exists(select 1 from public.enrollments where trainer_id=old.id) or exists(select 1 from public.cohorts where trainer_id=old.id) or exists(select 1 from public.schedule_events where trainer_id=old.id) or exists(select 1 from public.trainer_feedback where trainer_id=old.id) or exists(select 1 from public.learning_observations where trainer_id=old.id) or exists(select 1 from public.trainer_finance where trainer_id=old.id) or exists(select 1 from public.trainer_compensation_plans where trainer_id=old.id) or exists(select 1 from public.trainer_earnings where trainer_id=old.id) or exists(select 1 from public.trainer_payouts where trainer_id=old.id) then raise exception 'Trainer has operational, finance or historical references. Deactivate/offboard instead.'; end if; return old; end$$;

create or replace function public.guard_schedule_delete() returns trigger language plpgsql as $$begin
 if exists(select 1 from public.class_attendance where schedule_event_id=old.id) or exists(select 1 from public.learning_observations where schedule_event_id=old.id) or exists(select 1 from public.trainer_earnings where schedule_event_id=old.id) then raise exception 'Class has attendance, learning or payroll history. Cancel/reschedule it instead of deleting.'; end if; return old; end$$;

-- Update manual earning changes server-side so bonus/adjustment total stays correct.
create or replace function public.recalc_trainer_earning_manual() returns trigger language plpgsql as $$declare p public.trainer_compensation_plans%rowtype;begin
 if new.status='paid' and old.status='paid' then return new; end if;
 select * into p from public.trainer_compensation_plans where trainer_id=new.trainer_id and effective_from<=new.earning_date order by effective_from desc limit 1;
 new.conversion_bonus:=case when new.conversion_applied and new.session_type='demo' then case when new.pay_band='day' then p.demo_conversion_day else p.demo_conversion_night end else 0 end;
 new.total_amount:=greatest(0,round((new.base_rate*new.duration_factor*(case when new.class_outcome='no_show' then p.no_show_percent when new.class_outcome='cancelled' then p.cancelled_percent else 100 end)/100.0+new.conversion_bonus+new.adjustment)::numeric,2));
 new.updated_at:=now();return new;end$$;
drop trigger if exists recalc_trainer_earning_manual_trg on public.trainer_earnings;
create trigger recalc_trainer_earning_manual_trg before update of conversion_applied,adjustment,adjustment_reason on public.trainer_earnings for each row execute function public.recalc_trainer_earning_manual();

-- Audit payroll changes.
do $$declare t text;begin foreach t in array array['trainer_compensation_plans','trainer_earnings','trainer_payouts'] loop execute format('drop trigger if exists audit_%I on public.%I',t,t);execute format('create trigger audit_%I after insert or update or delete on public.%I for each row execute function public.audit_core_change()',t,t);end loop;end$$;

-- Final audit coverage for finance and operations tables.
do $$declare t text;begin foreach t in array array['profiles','parents','courses','trainers','trainer_courses','students','student_guardians','parent_students','enrollments','cohorts','onboarding_submissions','schedule_events','class_attendance','learning_observations','learning_observation_internal_notes','trainer_feedback','learner_projects','enrollment_holds','trainer_availability','trainer_availability_overrides','trainer_finance','trainer_compensation_plans','trainer_earnings','trainer_payouts','student_fee_packages','student_fee_payments','correction_requests'] loop if to_regclass('public.'||t) is not null then execute format('drop trigger if exists audit_%I on public.%I',t,t);execute format('create trigger audit_%I after insert or update or delete on public.%I for each row execute function public.audit_core_change()',t,t);end if;end loop;end$$;
revoke insert,update,delete on public.portal_audit_log from anon,authenticated;
-- Portal access controls. Never expose service-role credentials in client bundles.
alter table public.trainers add column if not exists country text not null default 'India';
alter table public.trainers add column if not exists state text not null default '';
alter table public.trainers add column if not exists timezone text not null default 'Asia/Kolkata';

create table if not exists public.portal_access_requests (
 target_type text not null check(target_type in ('trainer','student')),
 target_id uuid not null,
 login_email text not null,
 status text not null check(status in ('invited','linked','disabled')),
 invited_at timestamptz,
 updated_at timestamptz not null default now(),
 last_actor_id uuid references public.profiles(id) on delete set null,
 primary key(target_type,target_id)
);
alter table public.portal_access_requests enable row level security;
-- Only admins may read these records from ordinary clients; write operations are server-only using service role.
drop policy if exists portal_access_requests_admin_read on public.portal_access_requests;
create policy portal_access_requests_admin_read on public.portal_access_requests for select using(public.is_admin());
-- Block disabled users in role-derived RLS checks as well as in the UI's RoleGuard.
create or replace function public.current_role() returns text language sql stable security definer set search_path=public as $$
 select role from public.profiles where id=auth.uid() and active=true
$$;
create or replace function public.current_parent_id() returns uuid language sql stable security definer set search_path=public as $$
 select pa.id from public.parents pa join public.profiles p on p.id=pa.profile_id where pa.profile_id=auth.uid() and p.active=true
$$;
create or replace function public.current_trainer_id() returns uuid language sql stable security definer set search_path=public as $$
 select t.id from public.trainers t join public.profiles p on p.id=t.profile_id where t.profile_id=auth.uid() and p.active=true
$$;
-- Operations simplification and delivery-center model.

alter table public.courses add column if not exists default_cohort_capacity integer not null default 4;
alter table public.courses add column if not exists minimum_cohort_size integer not null default 2;
alter table public.cohorts add column if not exists minimum_start_size integer not null default 2;
alter table public.cohorts alter column capacity set default 4;

-- Reusable offline/partner delivery locations. Existing enrollments/cohorts continue to keep center_location text.
create table if not exists public.delivery_centers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  center_type text not null default 'Other',
  area text,
  city text not null default '',
  state text,
  country text not null default 'India',
  address text not null default '',
  contact_person text,
  contact_number text,
  capacity integer,
  notes text,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint delivery_centers_capacity_positive check (capacity is null or capacity > 0)
);

alter table public.delivery_centers enable row level security;
drop policy if exists delivery_centers_admin_all on public.delivery_centers;
create policy delivery_centers_admin_all on public.delivery_centers for all using(public.is_admin()) with check(public.is_admin());

create index if not exists delivery_centers_name_idx on public.delivery_centers(lower(name));
create index if not exists delivery_centers_city_idx on public.delivery_centers(lower(city));


-- ============================================================
-- Non-recursive Student / Enrollment RLS
-- ============================================================
-- Robotronix Learning Portal — Production V1
-- Student / Enrollment relationship-aware RLS
-- Fixes: ERROR: infinite recursion detected in policy for relation "students"
--
-- Safe for the existing Production V1 database.
-- Run once in Supabase SQL Editor.

begin;

-- These helpers run as the function owner and therefore can inspect relationship
-- tables without recursively re-entering their RLS policies.
create or replace function public.is_own_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.students s
    where s.id = p_student_id
      and s.profile_id = auth.uid()
  )
$$;

create or replace function public.is_parent_of_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.parent_students ps
    join public.parents p on p.id = ps.parent_id
    where ps.student_id = p_student_id
      and p.profile_id = auth.uid()
  )
$$;

create or replace function public.is_trainer_of_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.enrollments e
    join public.trainers t on t.id = e.trainer_id
    where e.student_id = p_student_id
      and t.profile_id = auth.uid()
  )
$$;

create or replace function public.can_read_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select
    public.is_admin()
    or public.is_own_student(p_student_id)
    or public.is_parent_of_student(p_student_id)
    or public.is_trainer_of_student(p_student_id)
$$;

-- Replace the recursive students SELECT policy.
drop policy if exists students_select on public.students;
create policy students_select
on public.students
for select
using (
  public.can_read_student(id)
);

-- Replace the recursive enrollments SELECT policy.
drop policy if exists enrollments_select on public.enrollments;
create policy enrollments_select
on public.enrollments
for select
using (
  public.is_admin()
  or trainer_id = public.current_trainer_id()
  or public.is_own_student(student_id)
  or public.is_parent_of_student(student_id)
);

-- Also rewrite the most common student-linked policies so they use the same
-- non-recursive helper and cannot recreate the students <-> enrollments loop.
drop policy if exists attendance_select on public.class_attendance;
create policy attendance_select
on public.class_attendance
for select
using (
  public.can_read_student(student_id)
);

drop policy if exists learning_observations_select on public.learning_observations;
create policy learning_observations_select
on public.learning_observations
for select
using (
  public.can_read_student(student_id)
);

drop policy if exists trainer_feedback_select on public.trainer_feedback;
create policy trainer_feedback_select
on public.trainer_feedback
for select
using (
  public.can_read_student(student_id)
);

drop policy if exists learner_projects_select on public.learner_projects;
create policy learner_projects_select
on public.learner_projects
for select
using (
  public.can_read_student(student_id)
);

drop policy if exists enrollment_holds_select on public.enrollment_holds;
create policy enrollment_holds_select
on public.enrollment_holds
for select
using (
  public.can_read_student(student_id)
);

drop policy if exists session_records_select on public.session_records;
create policy session_records_select
on public.session_records
for select
using (
  public.can_read_student(student_id)
);

-- Schedule events can be linked directly to a student or indirectly to an enrollment.
drop policy if exists schedule_select on public.schedule_events;
create policy schedule_select
on public.schedule_events
for select
using (
  public.is_admin()
  or trainer_id = public.current_trainer_id()
  or (student_id is not null and public.can_read_student(student_id))
  or (
    enrollment_id is not null
    and exists(
      select 1
      from public.enrollments e
      where e.id = schedule_events.enrollment_id
        and (
          e.trainer_id = public.current_trainer_id()
          or public.is_own_student(e.student_id)
          or public.is_parent_of_student(e.student_id)
        )
    )
  )
);

commit;


