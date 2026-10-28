-- ============================================================================
-- FINAL RELEASE CONSOLIDATION: actual instructional duration and earnings
-- ============================================================================
-- Planned vs verified actual instructional duration.
alter table if exists public.schedule_events add column if not exists actual_duration_minutes integer;
alter table if exists public.schedule_events drop constraint if exists actual_duration_half_hour_check;
alter table if exists public.schedule_events add constraint actual_duration_half_hour_check check(actual_duration_minutes is null or(actual_duration_minutes between 15 and 480 and actual_duration_minutes % 15=0));
comment on column public.schedule_events.actual_duration_minutes is 'Verified actual teaching minutes in 15-minute increments, used for learner course consumption; scheduled slot duration remains payroll basis.';

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

-- Sync earnings when an approved actual duration is recorded. Approved/paid entries remain locked by existing function.
drop trigger if exists sync_trainer_earning_on_event on public.schedule_events;
create trigger sync_trainer_earning_on_event after insert or update of status,date,start_time,end_time,timezone,trainer_id,delivery_mode,event_type,actual_duration_minutes on public.schedule_events for each row execute function public.trg_sync_trainer_earning();

-- Server-side safety for genuinely NEW enrollments. Historical records remain unchanged on edit.
create or replace function public.enforce_new_enrollment_start_date()
returns trigger language plpgsql as $$
begin
 -- Native/new enrollments cannot be backdated. Existing active learners that
 -- are being migrated into the portal may retain their true historical start date.
 if coalesce(new.migration_type, 'native') <> 'active_existing'
    and new.started_at < (now() at time zone 'Asia/Kolkata')::date then
  raise exception 'Enrollment start date cannot be earlier than today (IST).';
 end if;
 return new;
end $$;
drop trigger if exists validate_new_enrollment_start_date on public.enrollments;
create trigger validate_new_enrollment_start_date before insert on public.enrollments
for each row execute function public.enforce_new_enrollment_start_date();

-- ============================================================================
-- FINAL RELEASE CONSOLIDATION: protected operations / correction requests
-- ============================================================================
-- Robotronix Learning Portal — Production V1
-- Fixes /admin/audit 404s caused by missing correction_requests and restores
-- the protected-operation guards that belong in the Production V1 baseline.
--
-- Safe for the existing Production V1 Supabase database.
-- Run once in Supabase SQL Editor.

begin;

-- ============================================================
-- 1) CORRECTION REQUESTS
-- ============================================================

create table if not exists public.correction_requests(
  id uuid primary key default gen_random_uuid(),
  requested_by_profile_id uuid references public.profiles(id) on delete set null default auth.uid(),
  requested_by_role text not null check(requested_by_role in ('student','parent','trainer','admin')),
  entity_type text not null,
  entity_id text not null,
  reason text not null check(length(trim(reason)) > 0),
  requested_changes text not null check(length(trim(requested_changes)) > 0),
  status text not null default 'open' check(status in ('open','approved','rejected','completed')),
  admin_note text,
  resolved_at timestamptz,
  resolved_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists correction_requests_entity_idx
  on public.correction_requests(entity_type,entity_id,created_at desc);

create index if not exists correction_requests_status_idx
  on public.correction_requests(status,created_at desc);

alter table public.correction_requests enable row level security;

drop policy if exists correction_requests_admin_all on public.correction_requests;
create policy correction_requests_admin_all
on public.correction_requests
for all
using(public.is_admin())
with check(public.is_admin());

drop policy if exists correction_requests_own_select on public.correction_requests;
create policy correction_requests_own_select
on public.correction_requests
for select
using(requested_by_profile_id = auth.uid());

drop policy if exists correction_requests_trainer_insert on public.correction_requests;
create policy correction_requests_trainer_insert
on public.correction_requests
for insert
with check(
  requested_by_profile_id = auth.uid()
  and requested_by_role = public.current_role()
  and (
    public.current_role() = 'admin'
    or (
      public.current_role() = 'trainer'
      and entity_type = 'schedule_event'
      and exists(
        select 1
        from public.schedule_events se
        where se.id::text = entity_id
          and se.trainer_id = public.current_trainer_id()
      )
    )
  )
);

create or replace function public.resolve_correction_request_fields()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if tg_op = 'UPDATE' then
    new.updated_at := now();

    if new.status is distinct from old.status and new.status <> 'open' then
      new.resolved_at := coalesce(new.resolved_at, now());
      new.resolved_by_profile_id :=
        coalesce(new.resolved_by_profile_id, auth.uid());
    end if;
  end if;

  return new;
end
$$;

drop trigger if exists correction_request_fields_trg
on public.correction_requests;

create trigger correction_request_fields_trg
before update on public.correction_requests
for each row execute function public.resolve_correction_request_fields();

-- Use the composite-key-safe audit function defined above.
drop trigger if exists audit_correction_requests
on public.correction_requests;

create trigger audit_correction_requests
after insert or update or delete on public.correction_requests
for each row execute function public.audit_core_change();

-- ============================================================
-- 2) PAID PAYROLL PROTECTION
-- ============================================================

create or replace function public.guard_paid_trainer_earning()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if old.status = 'paid' then
    raise exception
      'Paid earning records are locked. Create a correction and separate adjustment.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end
$$;

drop trigger if exists guard_paid_trainer_earning_trg
on public.trainer_earnings;

create trigger guard_paid_trainer_earning_trg
before update or delete on public.trainer_earnings
for each row execute function public.guard_paid_trainer_earning();

create or replace function public.guard_paid_trainer_payout()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if old.status = 'paid' then
    raise exception
      'Paid payouts are locked. Record a new correction or adjustment.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end
$$;

drop trigger if exists guard_paid_trainer_payout_trg
on public.trainer_payouts;

create trigger guard_paid_trainer_payout_trg
before update or delete on public.trainer_payouts
for each row execute function public.guard_paid_trainer_payout();

-- ============================================================
-- 3) CLASS / ATTENDANCE SOURCE PROTECTION
-- ============================================================

create or replace function public.guard_paid_class_source()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if exists(
    select 1
    from public.trainer_earnings te
    where te.schedule_event_id = old.id
      and te.status = 'paid'
  ) then
    raise exception 'This class is linked to paid payroll and is locked.';
  end if;

  if public.current_role() = 'trainer'
     and tg_op = 'UPDATE'
     and (
       new.trainer_id is distinct from old.trainer_id
       or new.course_id is distinct from old.course_id
       or new.enrollment_id is distinct from old.enrollment_id
       or new.cohort_id is distinct from old.cohort_id
       or new.student_id is distinct from old.student_id
       or new.date is distinct from old.date
       or new.start_time is distinct from old.start_time
       or new.end_time is distinct from old.end_time
       or new.timezone is distinct from old.timezone
       or new.delivery_mode is distinct from old.delivery_mode
       or new.occurrence_kind is distinct from old.occurrence_kind
       or new.original_event_id is distinct from old.original_event_id
       or new.rescheduled_to_id is distinct from old.rescheduled_to_id
     )
  then
    raise exception
      'Trainer cannot edit schedule, assignment or relationship fields. Submit a correction request.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end
$$;

drop trigger if exists guard_paid_class_source_trg
on public.schedule_events;

create trigger guard_paid_class_source_trg
before update or delete on public.schedule_events
for each row execute function public.guard_paid_class_source();

create or replace function public.guard_paid_attendance_source()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  event_id uuid;
begin
  event_id :=
    case
      when tg_op = 'DELETE' then old.schedule_event_id
      else new.schedule_event_id
    end;

  if exists(
    select 1
    from public.trainer_earnings te
    where te.schedule_event_id = event_id
      and te.status = 'paid'
  ) then
    raise exception 'Attendance is linked to paid payroll and is locked.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end
$$;

drop trigger if exists guard_paid_attendance_source_trg
on public.class_attendance;

create trigger guard_paid_attendance_source_trg
before insert or update or delete on public.class_attendance
for each row execute function public.guard_paid_attendance_source();

commit;

-- ============================================================================
-- FINAL RELEASE CONSOLIDATION: student finance schema
-- ============================================================================
-- Robotronix Learning Portal — Production V1
-- Student Finance schema
--
-- Fixes /admin/finance 404s:
--   student_fee_packages
--   student_fee_payments
--
-- The application already depends on these tables, but they were accidentally
-- omitted from the consolidated Production V1 baseline.
--
-- Safe for the current Production V1 database.

begin;

create extension if not exists btree_gist;

create table if not exists public.student_fee_packages (
  id uuid primary key,
  enrollment_id uuid not null references public.enrollments(id) on delete restrict,
  name text not null check(length(trim(name)) > 0),
  scheme text not null check(scheme in ('Monthly','2 Months','Full Course','Custom')),
  currency text not null check(currency in ('INR','USD','AED','GBP','EUR')),
  amount numeric(12,2) not null check(amount > 0),
  sessions integer not null check(sessions > 0),
  start_date date not null,
  end_date date not null check(end_date >= start_date),
  installments jsonb not null,
  source text not null default 'portal' check(source in ('portal','migration')),
  notes text not null default '',
  created_at timestamptz not null default now()
);

-- Add the no-overlap package rule only if it does not already exist.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.student_fee_packages'::regclass
      and contype = 'x'
  ) then
    alter table public.student_fee_packages
      add constraint student_fee_packages_enrollment_period_excl
      exclude using gist (
        enrollment_id with =,
        daterange(start_date,end_date,'[]') with &&
      );
  end if;
end
$$;

create table if not exists public.student_fee_payments (
  id uuid primary key,
  package_id uuid not null references public.student_fee_packages(id) on delete restrict,
  amount numeric(12,2) not null check(amount > 0),
  payment_date date not null,
  method text not null,
  reference text not null check(length(trim(reference)) > 0),
  kind text not null check(kind in ('payment','refund')),
  source text not null default 'portal' check(source in ('portal','migration')),
  created_at timestamptz not null default now(),
  unique(package_id, reference)
);

-- Official internal receipt identifiers for manual and verified provider payments.
alter table public.student_fee_payments add column if not exists receipt_number text unique;
alter table public.student_fee_payments add column if not exists collector_name text not null default '';
alter table public.student_fee_payments add column if not exists collection_location text not null default '';
alter table public.student_fee_payments add column if not exists recorded_by uuid default auth.uid();
create sequence if not exists public.student_fee_receipt_sequence;
create or replace function public.assign_student_fee_receipt_number()
returns trigger language plpgsql security definer set search_path=public as $receipt$
begin
 if new.kind='payment' and new.receipt_number is null and new.family_receipt_id is null then
  new.receipt_number:='RTX-R-'||to_char(current_date,'YYYY')||'-'||lpad(nextval('public.student_fee_receipt_sequence')::text,6,'0');
 end if;
 return new;
end $receipt$;
revoke all on function public.assign_student_fee_receipt_number() from public,anon,authenticated;
drop trigger if exists assign_student_fee_receipt_number_trg on public.student_fee_payments;
create trigger assign_student_fee_receipt_number_trg before insert on public.student_fee_payments
 for each row execute function public.assign_student_fee_receipt_number();

alter table public.student_fee_packages enable row level security;
alter table public.student_fee_payments enable row level security;

drop policy if exists fees_admin_read on public.student_fee_packages;
create policy fees_admin_read
on public.student_fee_packages
for select to authenticated
using(public.is_admin());

drop policy if exists fees_admin_create on public.student_fee_packages;
create policy fees_admin_create
on public.student_fee_packages
for insert to authenticated
with check(public.is_admin());

drop policy if exists payments_admin_read on public.student_fee_payments;
create policy payments_admin_read
on public.student_fee_payments
for select to authenticated
using(public.is_admin());

drop policy if exists payments_admin_create on public.student_fee_payments;
create policy payments_admin_create
on public.student_fee_payments
for insert to authenticated
with check(public.is_admin());


-- Configurable commercial agreement: session limit is applicable only to session packages.
alter table public.student_fee_packages alter column amount type numeric(14,3);
alter table public.student_fee_payments alter column amount type numeric(14,3);
alter table public.student_fee_packages alter column sessions drop not null;
alter table public.student_fee_packages add column if not exists charge_absences boolean not null default false;

alter table public.student_fee_packages drop constraint if exists student_fee_packages_sessions_check;
alter table public.student_fee_packages add column if not exists billing_model text not null default 'session_package';
alter table public.student_fee_packages drop constraint if exists student_fee_packages_billing_model_check;
alter table public.student_fee_packages add constraint student_fee_packages_billing_model_check check(billing_model in ('session_package','monthly','per_class','fixed_course','open_ended','custom'));
alter table public.student_fee_packages drop constraint if exists student_fee_packages_optional_sessions_check;
alter table public.student_fee_packages add constraint student_fee_packages_optional_sessions_check check(sessions is null or sessions>0);
alter table public.student_fee_packages drop constraint if exists student_fee_packages_scheme_check;
alter table public.student_fee_packages add constraint student_fee_packages_scheme_check check(scheme in ('Monthly','2 Months','Full Course','Custom','Per 8 Classes','Per X Classes','Per Class','Open Ended'));
alter table public.student_fee_packages drop constraint if exists student_fee_packages_currency_check;
alter table public.student_fee_packages add constraint student_fee_packages_currency_check check(currency in ('INR','AED','SAR','QAR','OMR','KWD','BHD','USD','EUR','GBP','SGD','HKD','MYR','AUD','NZD','CAD'));
drop policy if exists fees_parent_read on public.student_fee_packages;
create policy fees_parent_read on public.student_fee_packages for select to authenticated using(
 exists(select 1 from public.enrollments e join public.parent_students ps on ps.student_id=e.student_id join public.parents pa on pa.id=ps.parent_id where e.id=enrollment_id and pa.profile_id=(select auth.uid()))
);
drop policy if exists fees_admin_update on public.student_fee_packages;
create policy fees_admin_update on public.student_fee_packages for update to authenticated
 using(public.is_admin()) with check(public.is_admin());
drop policy if exists payments_parent_read on public.student_fee_payments;
create policy payments_parent_read on public.student_fee_payments for select to authenticated using(
 exists(select 1 from public.student_fee_packages fp join public.enrollments e on e.id=fp.enrollment_id join public.parent_students ps on ps.student_id=e.student_id join public.parents pa on pa.id=ps.parent_id where fp.id=package_id and pa.profile_id=(select auth.uid()))
);

-- Family payment: one receipt may fund multiple learner packages, with atomic allocations.
create table if not exists public.student_family_receipts (
 id uuid primary key default gen_random_uuid(),
 parent_id uuid not null references public.parents(id) on delete restrict,
 currency text not null,
 amount numeric(14,3) not null check(amount>0),
 payment_date date not null,
 method text not null check(length(trim(method))>0),
 transaction_reference text not null check(length(trim(transaction_reference))>0),
 collector_name text not null default '',
 collection_location text not null default '',
 receipt_number text unique,
 recorded_by uuid default auth.uid(),
 created_at timestamptz not null default now(),
 unique(parent_id,transaction_reference)
);
alter table public.student_fee_payments add column if not exists family_receipt_id uuid references public.student_family_receipts(id) on delete restrict;
create index if not exists student_fee_payments_family_receipt_idx on public.student_fee_payments(family_receipt_id);
alter table public.student_family_receipts enable row level security;
drop policy if exists family_receipts_admin_read on public.student_family_receipts;
create policy family_receipts_admin_read on public.student_family_receipts for select to authenticated using(public.is_admin());
drop policy if exists family_receipts_parent_read on public.student_family_receipts;
create policy family_receipts_parent_read on public.student_family_receipts for select to authenticated using(
 exists(select 1 from public.parents pa where pa.id=parent_id and pa.profile_id=(select auth.uid()))
);
create or replace function public.assign_family_receipt_number()
returns trigger language plpgsql security definer set search_path=public as $family_receipt$
begin
 if new.receipt_number is null then
  new.receipt_number:='RTX-R-'||to_char(current_date,'YYYY')||'-'||lpad(nextval('public.student_fee_receipt_sequence')::text,6,'0');
 end if;
 return new;
end $family_receipt$;
revoke all on function public.assign_family_receipt_number() from public,anon,authenticated;
drop trigger if exists assign_family_receipt_number_trg on public.student_family_receipts;
create trigger assign_family_receipt_number_trg before insert on public.student_family_receipts
 for each row execute function public.assign_family_receipt_number();

create or replace function public.record_family_payment_v1(
 p_parent_id uuid,p_currency text,p_amount numeric,p_payment_date date,
 p_method text,p_reference text,p_allocations jsonb,
 p_collector_name text default '',p_location text default ''
) returns jsonb language plpgsql security definer set search_path=public as $family_payment$
declare
 v_line jsonb;v_package_id uuid;v_amount numeric(14,3);
 v_total numeric(14,3):=0;v_seen uuid[]:=array[]::uuid[];
 v_receipt record;v_factor integer;
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 if not exists(select 1 from public.parents where id=p_parent_id) then raise exception 'Family not found';end if;
 if p_currency not in ('INR','AED','SAR','QAR','OMR','KWD','BHD','USD','EUR','GBP','SGD','HKD','MYR','AUD','NZD','CAD') then raise exception 'Unsupported currency';end if;
 v_factor:=case when p_currency in ('BHD','KWD','OMR') then 1000 else 100 end;
 if p_amount is null or p_amount<=0 or p_amount*v_factor<>round(p_amount*v_factor)
 then raise exception 'Invalid payment amount or currency precision';end if;
 if p_payment_date is null or p_payment_date>current_date then raise exception 'Payment date cannot be in the future';end if;
 if nullif(trim(p_reference),'') is null then raise exception 'Transaction reference required';end if;
 if nullif(trim(p_method),'') is null or p_method='Razorpay' then raise exception 'Choose a manually verified payment method';end if;
 if p_method='Cash' and nullif(trim(p_collector_name),'') is null then raise exception 'Cash collector name required';end if;
 if jsonb_typeof(p_allocations)<>'array' or jsonb_array_length(p_allocations)=0 then raise exception 'Allocations required';end if;
 for v_line in select value from jsonb_array_elements(p_allocations) as value loop
  v_package_id:=(v_line->>'package_id')::uuid;
  v_amount:=(v_line->>'amount')::numeric;
  if v_package_id=any(v_seen) then raise exception 'Duplicate package allocation';end if;
  if v_amount is null or v_amount<=0 or v_amount*v_factor<>round(v_amount*v_factor) then raise exception 'Invalid allocation';end if;
  if not exists(
    select 1 from public.student_fee_packages fp
    join public.enrollments en on en.id=fp.enrollment_id
    join public.parent_students ps on ps.student_id=en.student_id
    where fp.id=v_package_id and ps.parent_id=p_parent_id and fp.currency=p_currency
  ) then raise exception 'Package is not in the chosen family and currency';end if;
  v_seen:=array_append(v_seen,v_package_id);
  v_total:=v_total+v_amount;
 end loop;
 if v_total<>p_amount then raise exception 'Allocations must equal the received amount';end if;
 insert into public.student_family_receipts(parent_id,currency,amount,payment_date,method,transaction_reference,collector_name,collection_location)
 values(p_parent_id,p_currency,p_amount,p_payment_date,p_method,trim(p_reference),trim(p_collector_name),trim(p_location))
 returning id,receipt_number into v_receipt;
 for v_line in select value from jsonb_array_elements(p_allocations) as value loop
  v_package_id:=(v_line->>'package_id')::uuid;v_amount:=(v_line->>'amount')::numeric;
  insert into public.student_fee_payments(id,package_id,amount,payment_date,method,reference,kind,
    collector_name,collection_location,family_receipt_id)
  values(gen_random_uuid(),v_package_id,v_amount,p_payment_date,p_method,
    'FAMILY-'||v_receipt.id::text||'-'||v_package_id::text,'payment',
    trim(p_collector_name),trim(p_location),v_receipt.id);
 end loop;
 return jsonb_build_object('receipt_id',v_receipt.id,'receipt_number',v_receipt.receipt_number,'allocated',v_total);
end $family_payment$;
revoke all on function public.record_family_payment_v1(uuid,text,numeric,date,text,text,jsonb,text,text) from public,anon;
grant execute on function public.record_family_payment_v1(uuid,text,numeric,date,text,text,jsonb,text,text) to authenticated;

create or replace function public.validate_fee_package()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  total numeric;
  invalid_count integer;
begin
  if new.billing_model='per_class' and new.installments='[]'::jsonb then return new; end if;
  if jsonb_typeof(new.installments) <> 'array'
     or jsonb_array_length(new.installments) = 0
  then
    raise exception 'Instalments required';
  end if;

  select
    sum((i->>'amount')::numeric),
    count(*) filter (
      where (i->>'amount')::numeric <= 0
         or (i->>'amount') is null
         or (i->>'due') is null
         or (i->>'due')::date is null
    )
  into total, invalid_count
  from jsonb_array_elements(new.installments) i;

  if invalid_count > 0 or total is distinct from new.amount then
    raise exception 'Instalments must total package amount';
  end if;

  return new;
end
$$;

drop trigger if exists fee_package_validate on public.student_fee_packages;
create trigger fee_package_validate
before insert or update on public.student_fee_packages
for each row execute function public.validate_fee_package();

create or replace function public.validate_fee_refund()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  net numeric;
begin
  if new.payment_date > (now() at time zone 'Asia/Kolkata')::date then
    raise exception 'Payment date cannot be in the future';
  end if;

  perform 1
  from public.student_fee_packages
  where id = new.package_id
  for update;

  select coalesce(
    sum(case when kind='refund' then -amount else amount end),
    0
  )
  into net
  from public.student_fee_payments
  where package_id = new.package_id;

  if new.kind = 'refund' and new.amount > net then
    raise exception 'Refund exceeds net receipts';
  end if;

  return new;
end
$$;

drop trigger if exists fee_refund_validate on public.student_fee_payments;
create trigger fee_refund_validate
before insert on public.student_fee_payments
for each row execute function public.validate_fee_refund();

-- Add the already-hardened generic audit trigger to the newly restored tables.
drop trigger if exists audit_student_fee_packages on public.student_fee_packages;
create trigger audit_student_fee_packages
after insert or update or delete on public.student_fee_packages
for each row execute function public.audit_core_change();

drop trigger if exists audit_student_fee_payments on public.student_fee_payments;
create trigger audit_student_fee_payments
after insert or update or delete on public.student_fee_payments
for each row execute function public.audit_core_change();

commit;

-- ============================================================================
-- FINAL RELEASE CONSOLIDATION: course/trainer RLS relationship helpers
-- ============================================================================
-- Robotronix Learning Portal — Production V1
-- Course + Trainer RLS for Parent/Student learner experience
--
-- Symptom:
-- QA Parent can read parent_students, students and enrollments, but linked
-- courses/trainers return 0 rows. Parent learner detail therefore cannot
-- construct the course snapshot.
--
-- This replaces nested RLS-dependent relationship checks with small
-- SECURITY DEFINER helpers. It preserves the intended access model:
--   Admin   -> all
--   Trainer -> self + assigned courses
--   Student -> course/trainer from own enrollments
--   Parent  -> course/trainer from linked learner enrollments
--
-- Run once in Supabase SQL Editor.

begin;

-- ------------------------------------------------------------
-- COURSE RELATIONSHIP HELPERS
-- ------------------------------------------------------------

create or replace function public.is_student_enrolled_in_course(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.enrollments e
    join public.students s on s.id = e.student_id
    join public.profiles p on p.id = s.profile_id
    where e.course_id = p_course_id
      and s.profile_id = auth.uid()
      and p.active = true
      and e.status <> 'cancelled'
  )
$$;

create or replace function public.is_parent_linked_to_course(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.enrollments e
    join public.parent_students ps on ps.student_id = e.student_id
    join public.parents pa on pa.id = ps.parent_id
    join public.profiles p on p.id = pa.profile_id
    where e.course_id = p_course_id
      and pa.profile_id = auth.uid()
      and p.active = true
      and e.status <> 'cancelled'
  )
$$;

create or replace function public.is_trainer_assigned_to_course(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.trainer_courses tc
    join public.trainers t on t.id = tc.trainer_id
    join public.profiles p on p.id = t.profile_id
    where tc.course_id = p_course_id
      and t.profile_id = auth.uid()
      and p.active = true
  )
$$;

create or replace function public.can_read_course(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select
    public.is_admin()
    or public.is_trainer_assigned_to_course(p_course_id)
    or public.is_student_enrolled_in_course(p_course_id)
    or public.is_parent_linked_to_course(p_course_id)
$$;

drop policy if exists courses_select on public.courses;

create policy courses_select
on public.courses
for select
using (
  public.can_read_course(id)
);

-- ------------------------------------------------------------
-- TRAINER RELATIONSHIP HELPERS
-- ------------------------------------------------------------

create or replace function public.is_student_linked_to_trainer(p_trainer_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.enrollments e
    join public.students s on s.id = e.student_id
    join public.profiles p on p.id = s.profile_id
    where e.trainer_id = p_trainer_id
      and s.profile_id = auth.uid()
      and p.active = true
      and e.status <> 'cancelled'
  )
$$;

create or replace function public.is_parent_linked_to_trainer(p_trainer_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.enrollments e
    join public.parent_students ps on ps.student_id = e.student_id
    join public.parents pa on pa.id = ps.parent_id
    join public.profiles p on p.id = pa.profile_id
    where e.trainer_id = p_trainer_id
      and pa.profile_id = auth.uid()
      and p.active = true
      and e.status <> 'cancelled'
  )
$$;

create or replace function public.can_read_trainer(p_trainer_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select
    public.is_admin()
    or p_trainer_id = public.current_trainer_id()
    or public.is_student_linked_to_trainer(p_trainer_id)
    or public.is_parent_linked_to_trainer(p_trainer_id)
$$;

drop policy if exists trainers_select on public.trainers;

create policy trainers_select
on public.trainers
for select
using (
  public.can_read_trainer(id)
);

commit;

-- ============================================================================
-- FINAL RELEASE VERIFICATION
-- ============================================================================
do $$
begin
  if to_regclass('public.profiles') is null then raise exception 'Missing profiles table'; end if;
  if to_regclass('public.students') is null then raise exception 'Missing students table'; end if;
  if to_regclass('public.enrollments') is null then raise exception 'Missing enrollments table'; end if;
  if to_regclass('public.schedule_events') is null then raise exception 'Missing schedule_events table'; end if;
  if to_regclass('public.trainer_earnings') is null then raise exception 'Missing trainer_earnings table'; end if;
  if to_regclass('public.student_fee_packages') is null then raise exception 'Missing student_fee_packages table'; end if;
  if to_regclass('public.student_fee_payments') is null then raise exception 'Missing student_fee_payments table'; end if;
  if to_regclass('public.correction_requests') is null then raise exception 'Missing correction_requests table'; end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='schedule_events' and column_name='actual_duration_minutes'
  ) then raise exception 'Missing schedule_events.actual_duration_minutes'; end if;
  if to_regprocedure('public.can_read_student(uuid)') is null then raise exception 'Missing can_read_student helper'; end if;
  if to_regprocedure('public.can_read_course(uuid)') is null then raise exception 'Missing can_read_course helper'; end if;
  if to_regprocedure('public.can_read_trainer(uuid)') is null then raise exception 'Missing can_read_trainer helper'; end if;
  if to_regprocedure('public.sync_trainer_earning(uuid,boolean)') is null then raise exception 'Missing trainer earning sync'; end if;
end
$$;

select 'Robotronix Production V1 database baseline installed successfully' as status, now() as installed_at;


