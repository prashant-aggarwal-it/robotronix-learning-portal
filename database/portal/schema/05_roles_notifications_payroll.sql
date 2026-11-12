-- ============================================================================
-- TRAINER ACCOUNTABILITY + PAYROLL RULES
-- ============================================================================

-- Robotronix Final v1.0
-- 21_trainer_accountability_payroll.sql
-- Student no-show / cancellation = zero trainer pay.
-- Adds trainer-side no-show / late accountability settings.
-- Allows audited negative earning totals so a no-show penalty can reduce monthly payroll.

begin;

alter table public.trainer_compensation_plans
  add column if not exists trainer_no_show_penalty_percent numeric(6,2) not null default 100 check (trainer_no_show_penalty_percent between 0 and 200),
  add column if not exists late_grace_minutes int not null default 5 check (late_grace_minutes between 0 and 60),
  add column if not exists late_penalty_percent numeric(5,2) not null default 0 check (late_penalty_percent between 0 and 100);

update public.trainer_compensation_plans set no_show_percent=0,cancelled_percent=0 where no_show_percent<>0 or cancelled_percent<>0;

create or replace function public.recalc_trainer_earning_manual() returns trigger language plpgsql as $$
declare p public.trainer_compensation_plans%rowtype;
begin
 if new.status='paid' and tg_op='UPDATE' and (new.adjustment is distinct from old.adjustment or new.conversion_applied is distinct from old.conversion_applied) then raise exception 'Paid earning is locked. Create a later payroll adjustment instead.'; end if;
 select * into p from public.trainer_compensation_plans where trainer_id=new.trainer_id and effective_from<=new.earning_date order by effective_from desc limit 1;
 if not found then return new; end if;
 new.conversion_bonus:=case when new.conversion_applied and new.session_type='demo' then case when new.pay_band='day' then p.demo_conversion_day else p.demo_conversion_night end else 0 end;
 new.total_amount:=round((new.base_rate*new.duration_factor*(case when new.class_outcome='completed' then 100 else 0 end)/100.0+new.conversion_bonus+new.adjustment)::numeric,2);
 new.updated_at:=now();
 return new;
end $$;

drop trigger if exists trainer_earning_manual_recalc on public.trainer_earnings;
create trigger trainer_earning_manual_recalc before update of conversion_applied,adjustment,adjustment_reason,notes,status on public.trainer_earnings for each row execute function public.recalc_trainer_earning_manual();

commit;

select trainer_no_show_penalty_percent,late_grace_minutes,late_penalty_percent,no_show_percent,cancelled_percent from public.trainer_compensation_plans order by updated_at desc limit 5;


-- ============================================================================
-- ROLE PROFILES + PARENT COMMUNITY + TRAINER FINANCE REQUESTS
-- ============================================================================

-- Robotronix v1.0 consolidated update
-- 22_role_profiles_parent_community_trainer_finance_requests.sql
begin;

alter table public.profiles add column if not exists phone text not null default '';
alter table public.profiles add column if not exists timezone text not null default 'Asia/Kolkata';


-- Trainers can read their approved payout record, but cannot edit it directly.
drop policy if exists trainer_finance_trainer_select on public.trainer_finance;
create policy trainer_finance_trainer_select on public.trainer_finance for select using(trainer_id=public.current_trainer_id());

-- Trainer-owned availability editing. Admin policies remain in place.
drop policy if exists availability_trainer_write on public.trainer_availability;
create policy availability_trainer_write on public.trainer_availability for all using(trainer_id=public.current_trainer_id()) with check(trainer_id=public.current_trainer_id());
drop policy if exists availability_override_trainer_write on public.trainer_availability_overrides;
create policy availability_override_trainer_write on public.trainer_availability_overrides for all using(trainer_id=public.current_trainer_id()) with check(trainer_id=public.current_trainer_id());

create table if not exists public.trainer_finance_change_requests(
 id uuid primary key default gen_random_uuid(),
 trainer_id uuid not null references public.trainers(id) on delete cascade,
 account_holder_name text not null default '', bank_name text not null default '', account_number text not null default '', ifsc text not null default '', upi_id text not null default '', pan text not null default '',
 preferred_payout_method text not null default 'bank' check(preferred_payout_method in ('bank','upi','other')),
 status text not null default 'pending' check(status in ('pending','approved','rejected','correction_requested')),
 trainer_note text not null default '', admin_note text not null default '', submitted_at timestamptz not null default now(), reviewed_at timestamptz, reviewed_by uuid references public.profiles(id) on delete set null
);
alter table public.trainer_finance_change_requests enable row level security;
drop policy if exists trainer_finance_requests_select on public.trainer_finance_change_requests;
create policy trainer_finance_requests_select on public.trainer_finance_change_requests for select using(public.is_admin() or trainer_id=public.current_trainer_id());
drop policy if exists trainer_finance_requests_trainer_insert on public.trainer_finance_change_requests;
create policy trainer_finance_requests_trainer_insert on public.trainer_finance_change_requests for insert with check(trainer_id=public.current_trainer_id() and status='pending');
drop policy if exists trainer_finance_requests_admin_update on public.trainer_finance_change_requests;
create policy trainer_finance_requests_admin_update on public.trainer_finance_change_requests for update using(public.is_admin()) with check(public.is_admin());

create table if not exists public.parent_community_profiles(
 parent_id uuid primary key references public.parents(id) on delete cascade,
 profession text not null default '', organization text not null default '', designation text not null default '', linkedin_url text not null default '', instagram_handle text not null default '', facebook_url text not null default '',
 expertise text[] not null default '{}', contribution_interests text[] not null default '{}', foundation_interests text[] not null default '{}',
 ambassador_interest boolean not null default false, social_tag_consent boolean not null default false, community_contact_consent boolean not null default false,
 updated_at timestamptz not null default now()
);
alter table public.parent_community_profiles enable row level security;
drop policy if exists parent_community_select on public.parent_community_profiles;
create policy parent_community_select on public.parent_community_profiles for select using(public.is_admin() or parent_id=public.current_parent_id());
drop policy if exists parent_community_parent_write on public.parent_community_profiles;
create policy parent_community_parent_write on public.parent_community_profiles for all using(parent_id=public.current_parent_id()) with check(parent_id=public.current_parent_id());
drop policy if exists parent_community_admin_write on public.parent_community_profiles;
create policy parent_community_admin_write on public.parent_community_profiles for all using(public.is_admin()) with check(public.is_admin());

create table if not exists public.family_introductions(
 id uuid primary key default gen_random_uuid(), parent_id uuid not null references public.parents(id) on delete cascade,
 introduced_name text not null, introduced_contact text not null default '', note text not null default '',
 status text not null default 'introduced' check(status in ('introduced','contacted','demo_scheduled','enrolled','closed')),
 converted_at timestamptz, benefit_status text not null default 'none' check(benefit_status in ('none','available','redeemed','donated')),
 benefit_value_inr numeric(12,2), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.family_introductions enable row level security;
drop policy if exists family_introductions_select on public.family_introductions;
create policy family_introductions_select on public.family_introductions for select using(public.is_admin() or parent_id=public.current_parent_id());
drop policy if exists family_introductions_parent_insert on public.family_introductions;
create policy family_introductions_parent_insert on public.family_introductions for insert with check(parent_id=public.current_parent_id());
drop policy if exists family_introductions_admin_update on public.family_introductions;
create policy family_introductions_admin_update on public.family_introductions for update using(public.is_admin()) with check(public.is_admin());


create or replace function public.set_family_introduction_benefit()
returns trigger language plpgsql as $$
declare v numeric(12,2);
begin
 if new.status='enrolled' and old.status is distinct from 'enrolled' then
  select nullif(value_text,'')::numeric into v from public.system_settings where key='parent_referral_benefit_value_inr';
  new.converted_at:=coalesce(new.converted_at,now());
  new.benefit_status:='available';
  new.benefit_value_inr:=coalesce(v,750);
 end if;
 new.updated_at:=now();
 return new;
end $$;
drop trigger if exists family_introduction_benefit_trigger on public.family_introductions;
create trigger family_introduction_benefit_trigger before update on public.family_introductions for each row execute function public.set_family_introduction_benefit();

insert into public.system_settings(key,value_text,description,updated_at) values
 ('parent_referral_benefit_value_inr','750','Internal value of one converted Parent Community introduction. Parent-facing UI should call this a Community Benefit, not referral commission.',now())
on conflict(key) do update set description=excluded.description,updated_at=now();

create or replace function public.update_own_trainer_profile(p_mobile text,p_city text,p_state text,p_country text,p_timezone text,p_specialties text[])
returns void language plpgsql security definer set search_path=public as $$
begin
 update public.trainers set mobile=coalesce(p_mobile,''),city=coalesce(p_city,''),state=coalesce(p_state,''),country=coalesce(p_country,'India'),timezone=coalesce(p_timezone,'Asia/Kolkata'),specialties=coalesce(p_specialties,'{}'),updated_at=now()
 where profile_id=auth.uid();
 if not found then raise exception 'Trainer profile not linked'; end if;
end $$;
grant execute on function public.update_own_trainer_profile(text,text,text,text,text,text[]) to authenticated;

create or replace function public.review_trainer_finance_request(p_request_id uuid,p_action text,p_admin_note text default '')
returns void language plpgsql security definer set search_path=public as $$
declare r public.trainer_finance_change_requests%rowtype; target_status text;
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 select * into r from public.trainer_finance_change_requests where id=p_request_id for update;
 if not found then raise exception 'Request not found'; end if;
 if p_action='approve' then target_status:='approved'; elsif p_action='reject' then target_status:='rejected'; elsif p_action='request_correction' then target_status:='correction_requested'; else raise exception 'Invalid review action'; end if;
 if target_status='approved' then
  insert into public.trainer_finance(trainer_id,account_holder_name,bank_name,account_number,ifsc,upi_id,preferred_payout_method,pan,compliance_status,updated_at)
  values(r.trainer_id,r.account_holder_name,r.bank_name,r.account_number,r.ifsc,r.upi_id,r.preferred_payout_method,r.pan,'pending',now())
  on conflict(trainer_id) do update set account_holder_name=excluded.account_holder_name,bank_name=excluded.bank_name,account_number=excluded.account_number,ifsc=excluded.ifsc,upi_id=excluded.upi_id,preferred_payout_method=excluded.preferred_payout_method,pan=excluded.pan,updated_at=now();
 end if;
 update public.trainer_finance_change_requests set status=target_status,admin_note=coalesce(p_admin_note,''),reviewed_at=now(),reviewed_by=auth.uid() where id=p_request_id;
end $$;
grant execute on function public.review_trainer_finance_request(uuid,text,text) to authenticated;

commit;


-- ============================================================================
-- TRAINER FINANCE RATE-CARD VISIBILITY
-- ============================================================================

-- Robotronix v1.0
-- 23_trainer_finance_ratecard_visibility.sql
--
-- Purpose:
--   Ensure a logged-in Trainer can read ONLY their own approved payout details
--   and their own current rate card, while Admin retains full control.
--
-- This does NOT allow a Trainer to edit trainer_finance or compensation plans.
-- Trainer payout changes still go through trainer_finance_change_requests.

begin;

-- Recreate the self-read policies explicitly. This is idempotent and useful
-- when an environment was upgraded through different historical patch paths.
drop policy if exists trainer_finance_trainer_select on public.trainer_finance;
create policy trainer_finance_trainer_select
on public.trainer_finance
for select
using (trainer_id = public.current_trainer_id());

drop policy if exists trainer_comp_plans_trainer_select on public.trainer_compensation_plans;
create policy trainer_comp_plans_trainer_select
on public.trainer_compensation_plans
for select
using (trainer_id = public.current_trainer_id());

-- Keep trainer finance change requests visible only to the owning trainer or Admin.
drop policy if exists trainer_finance_requests_select on public.trainer_finance_change_requests;
create policy trainer_finance_requests_select
on public.trainer_finance_change_requests
for select
using (public.is_admin() or trainer_id = public.current_trainer_id());

commit;

-- READ-ONLY diagnostic:
-- This should show the Trainer record linked to the same profile UUID as the Auth user.
-- Run while inspecting a specific trainer in SQL by replacing the email below if needed.
--
-- select
--   t.id as trainer_id,
--   t.full_name,
--   t.email,
--   t.profile_id,
--   p.email as profile_email,
--   p.role,
--   t.login_linked,
--   exists(select 1 from public.trainer_finance f where f.trainer_id=t.id) as has_finance,
--   exists(select 1 from public.trainer_compensation_plans cp where cp.trainer_id=t.id) as has_rate_card
-- from public.trainers t
-- left join public.profiles p on p.id=t.profile_id
-- where lower(t.email)=lower('TRAINER_EMAIL_HERE');


-- ============================================================================
-- ADMIN NOTIFICATION ON PARENT ONBOARDING
-- ============================================================================

-- Robotronix Production Readiness Patch 24
-- Create an Admin portal notification whenever a parent successfully submits onboarding.
-- Idempotent. No client-side Admin permission is required because the trigger runs in the database.

begin;

create or replace function public.notify_admin_on_onboarding_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.portal_notifications(
    recipient_role, type, priority, title, message, href, created_at
  ) values (
    'admin',
    'onboarding_submitted',
    'action',
    'New family onboarding received',
    coalesce(nullif(trim(new.child_name),''),'A new learner') ||
      ' has been submitted by ' ||
      coalesce(nullif(trim(new.primary_guardian_name),''), nullif(trim(new.login_email),''), 'a parent / guardian') ||
      ' and is awaiting review.',
    '/admin/onboarding/' || new.id::text,
    now()
  );
  return new;
end;
$$;

drop trigger if exists onboarding_submission_admin_notification_trg on public.onboarding_submissions;
create trigger onboarding_submission_admin_notification_trg
after insert on public.onboarding_submissions
for each row execute function public.notify_admin_on_onboarding_submission();

commit;

-- Verification (read-only):
-- select type,priority,title,message,href,created_at
-- from public.portal_notifications
-- where type='onboarding_submitted'
-- order by created_at desc limit 10;


-- ============================================================================
-- CONSOLIDATED FRESH-INSTALL FIXES DISCOVERED DURING PRODUCTION QA
-- ============================================================================

comment on column public.enrollments.schedule_override_confirmed is
'Confirms that an administrator intentionally accepted a schedule override/conflict.';

comment on column public.enrollments.schedule_override_note is
'Optional administrative note explaining a schedule override/conflict.';

-- RLS policies do not themselves grant PostgreSQL table privileges.
-- On a fresh Supabase schema, authenticated users need base DML privileges on
-- RLS-protected tables; the RLS policies continue to control permitted rows/actions.
begin;

grant usage on schema public to authenticated;

do $$
declare
  r record;
begin
  for r in
    select format('%I.%I', n.nspname, c.relname) as fq_table
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r','p')
      and c.relrowsecurity = true
  loop
    execute format(
      'grant select, insert, update, delete on table %s to authenticated',
      r.fq_table
    );
  end loop;
end
$$;

commit;


-- ============================================================================
-- FINAL RELEASE CONSOLIDATION: active-student opening position + private notes
-- ============================================================================
begin;
alter table public.enrollments add column if not exists migration_type text not null default 'native';
alter table public.enrollments add column if not exists opening_completed_sessions integer not null default 0;
alter table public.enrollments add column if not exists opening_completed_minutes integer not null default 0;
alter table public.enrollments add column if not exists migration_note text;
alter table public.enrollments add column if not exists portal_tracking_started_at date;
do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='public.enrollments'::regclass and conname='enrollments_migration_type_check') then alter table public.enrollments add constraint enrollments_migration_type_check check(migration_type in ('native','active_existing')); end if;
 if not exists(select 1 from pg_constraint where conrelid='public.enrollments'::regclass and conname='enrollments_opening_completed_sessions_check') then alter table public.enrollments add constraint enrollments_opening_completed_sessions_check check(opening_completed_sessions>=0); end if;
 if not exists(select 1 from pg_constraint where conrelid='public.enrollments'::regclass and conname='enrollments_opening_completed_minutes_check') then alter table public.enrollments add constraint enrollments_opening_completed_minutes_check check(opening_completed_minutes>=0); end if;
end $$;
alter table public.student_fee_packages add column if not exists source text not null default 'portal';
alter table public.student_fee_packages add column if not exists notes text not null default '';
alter table public.student_fee_payments add column if not exists source text not null default 'portal';
create table if not exists public.learning_observation_internal_notes (schedule_event_id uuid not null references public.schedule_events(id) on delete cascade,student_id uuid not null references public.students(id) on delete cascade,enrollment_id uuid not null references public.enrollments(id) on delete cascade,trainer_id uuid not null references public.trainers(id) on delete restrict,note text not null default '',updated_at timestamptz not null default now(),primary key(schedule_event_id,student_id));
alter table public.learning_observation_internal_notes enable row level security;
grant select,insert,update,delete on public.learning_observation_internal_notes to authenticated;
drop policy if exists learning_internal_notes_select on public.learning_observation_internal_notes; create policy learning_internal_notes_select on public.learning_observation_internal_notes for select using(public.is_admin() or exists(select 1 from public.enrollments e where e.id=enrollment_id and e.trainer_id=public.current_trainer_id()));
drop policy if exists learning_internal_notes_admin_all on public.learning_observation_internal_notes; create policy learning_internal_notes_admin_all on public.learning_observation_internal_notes for all using(public.is_admin()) with check(public.is_admin());
drop policy if exists learning_internal_notes_trainer_insert on public.learning_observation_internal_notes; create policy learning_internal_notes_trainer_insert on public.learning_observation_internal_notes for insert with check(trainer_id=public.current_trainer_id() and exists(select 1 from public.enrollments e where e.id=enrollment_id and e.trainer_id=public.current_trainer_id()));
drop policy if exists learning_internal_notes_trainer_update on public.learning_observation_internal_notes; create policy learning_internal_notes_trainer_update on public.learning_observation_internal_notes for update using(trainer_id=public.current_trainer_id() and exists(select 1 from public.enrollments e where e.id=enrollment_id and e.trainer_id=public.current_trainer_id())) with check(trainer_id=public.current_trainer_id() and exists(select 1 from public.enrollments e where e.id=enrollment_id and e.trainer_id=public.current_trainer_id()));
drop policy if exists learning_internal_notes_trainer_delete on public.learning_observation_internal_notes; create policy learning_internal_notes_trainer_delete on public.learning_observation_internal_notes for delete using(trainer_id=public.current_trainer_id() and exists(select 1 from public.enrollments e where e.id=enrollment_id and e.trainer_id=public.current_trainer_id()));
do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='public.enrollments'::regclass and conname='enrollments_opening_within_plan_check') then alter table public.enrollments add constraint enrollments_opening_within_plan_check check(planned_sessions is null or opening_completed_sessions<=planned_sessions); end if;
 if not exists(select 1 from pg_constraint where conrelid='public.student_fee_packages'::regclass and conname='student_fee_packages_source_check') then alter table public.student_fee_packages add constraint student_fee_packages_source_check check(source in ('portal','migration')); end if;
 if not exists(select 1 from pg_constraint where conrelid='public.student_fee_payments'::regclass and conname='student_fee_payments_source_check') then alter table public.student_fee_payments add constraint student_fee_payments_source_check check(source in ('portal','migration')); end if;
end $$;
commit;

-- ============================================================================
-- FINAL RELEASE CONSOLIDATION: opening progress refresh trigger
-- ============================================================================
-- Existing active learners may begin portal tracking part-way through a course.
-- Keep cached sessions/progress in sync whenever the opening position changes.
create or replace function public.on_enrollment_opening_progress_change()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  perform public.refresh_enrollment_progress(new.id);
  return new;
end
$$;

drop trigger if exists enrollment_opening_progress_trigger on public.enrollments;
create trigger enrollment_opening_progress_trigger
after insert or update of opening_completed_sessions, opening_completed_minutes, planned_sessions, course_id
on public.enrollments
for each row execute function public.on_enrollment_opening_progress_change();

