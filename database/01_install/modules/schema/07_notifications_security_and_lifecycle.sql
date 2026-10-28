-- ======================================================================
-- P1 Action notifications (consolidated into fresh-install baseline)
-- ======================================================================
-- Robotronix P1 action-required notifications (idempotent).
-- Run against DEV first. For an EXISTING installation this is a controlled migration;
-- fresh installations also include this content at the end of 01_CREATE_SCHEMA.sql.
begin;

-- Trainer payout: notify Admin when submitted, trainer when reviewed.
-- Never place account, UPI, PAN, IFSC or trainer notes in notification text.
create or replace function public.notify_trainer_payout_action()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_name text;
begin
  select coalesce(nullif(trim(full_name),''),'Trainer')
    into v_name from public.trainers where id=new.trainer_id;
  if tg_op='INSERT' and new.status='pending' then
    insert into public.portal_notifications
      (recipient_role,trainer_id,type,priority,title,message,href,dedupe_key)
    values
      ('admin',new.trainer_id,'trainer_payout_review','action',
       'Trainer payout change needs review',
       coalesce(v_name,'Trainer')||' submitted new payout details for review.',
       '/admin/trainers/'||new.trainer_id::text,
       'trainer-payout:'||new.id::text||':submitted')
    on conflict (dedupe_key) where dedupe_key is not null do nothing;
  elsif tg_op='UPDATE' and new.status is distinct from old.status
    and new.status in ('approved','rejected','correction_requested') then
    insert into public.portal_notifications
      (recipient_role,trainer_id,type,priority,title,message,href,dedupe_key)
    values
      ('trainer',new.trainer_id,'trainer_payout_decision',
       case when new.status='correction_requested' then 'action' else 'important' end,
       case new.status
         when 'approved' then 'Payout details approved'
         when 'rejected' then 'Payout details not approved'
         else 'Payout details need correction' end,
       case new.status
         when 'approved' then 'Your submitted payout details have been approved. Check the effective payroll cycle with Admin.'
         when 'rejected' then 'Admin did not approve your payout changes. Contact Robotronix Admin for clarification.'
         else 'Admin requested a correction to your submitted payout details. Open your profile to review.' end,
       '/trainer/profile',
       'trainer-payout:'||new.id::text||':'||new.status)
    on conflict (dedupe_key) where dedupe_key is not null do nothing;
  end if;
  return new;
end $$;
drop trigger if exists trainer_payout_action_insert_trg on public.trainer_finance_change_requests;
create trigger trainer_payout_action_insert_trg
after insert on public.trainer_finance_change_requests
for each row execute function public.notify_trainer_payout_action();
drop trigger if exists trainer_payout_action_update_trg on public.trainer_finance_change_requests;
create trigger trainer_payout_action_update_trg
after update of status on public.trainer_finance_change_requests
for each row execute function public.notify_trainer_payout_action();

-- Open urgent progress alerts need Admin attention, and subsequent updates should not
-- re-notify unless an alert is explicitly re-opened.
create or replace function public.notify_open_progress_alert()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status='open'
     and (tg_op='INSERT' or new.status is distinct from old.status) then
    insert into public.portal_notifications
      (recipient_role,student_id,type,priority,title,message,href,dedupe_key)
    values
      ('admin',new.student_id,'progress_alert_open','action',
       'Learner progress alert requires review',
       'A learner progress alert needs an Admin review.',
       '/admin/alerts',
       'progress-alert:'||new.id::text||':open:'||extract(epoch from new.updated_at)::bigint::text)
    on conflict (dedupe_key) where dedupe_key is not null do nothing;
  end if;
  return new;
end $$;
drop trigger if exists progress_action_insert_trg on public.progress_alert_actions;
create trigger progress_action_insert_trg after insert on public.progress_alert_actions
for each row execute function public.notify_open_progress_alert();
drop trigger if exists progress_action_update_trg on public.progress_alert_actions;
create trigger progress_action_update_trg after update of status on public.progress_alert_actions
for each row execute function public.notify_open_progress_alert();

-- Existing message trigger incorrectly routes trainer-originated messages to Parent
-- even when there is no Parent on the thread. Correct routing, do not expose message
-- bodies in notifications, and keep unread counts aligned with actual recipients.
create or replace function public.handle_communication_message()
returns trigger language plpgsql security definer set search_path=public as $$
declare t public.communication_threads%rowtype;
begin
 select * into t from public.communication_threads where id=new.thread_id;
 if not found then return new; end if;
 update public.communication_threads set
  last_message_at=new.created_at,
  last_message_preview=left(new.body,240),
  status=case
    when new.sender_role='parent' then 'waiting_team'
    when new.sender_role='trainer' then 'waiting_team'
    when t.parent_id is not null then 'waiting_parent'
    else 'open' end,
  unread_admin=case when new.sender_role in ('parent','trainer') then unread_admin+1 else unread_admin end,
  unread_parent=case when new.sender_role<>'parent' and t.parent_id is not null then unread_parent+1 else unread_parent end,
  unread_trainer=case when new.sender_role<>'trainer' and t.trainer_id is not null then unread_trainer+1 else unread_trainer end,
  updated_at=now()
 where id=new.thread_id;

 if new.sender_role in ('parent','trainer') then
  insert into public.portal_notifications
   (recipient_role,student_id,trainer_id,type,priority,title,message,href,dedupe_key)
  values ('admin',t.student_id,t.trainer_id,'message_received','action',
   case when new.sender_role='parent' then 'Parent message awaiting response' else 'Trainer message awaiting response' end,
   'A new message in your Robotronix inbox needs attention.',
   '/admin/messages/'||new.thread_id::text,
   'message:'||new.id::text||':admin')
  on conflict (dedupe_key) where dedupe_key is not null do nothing;
 end if;
 if new.sender_role='parent' and t.trainer_id is not null then
  insert into public.portal_notifications
   (recipient_role,student_id,trainer_id,type,priority,title,message,href,dedupe_key)
  values ('trainer',t.student_id,t.trainer_id,'message_received','action',
   'Parent message awaiting reply','A parent sent a message about a learner.',
   '/trainer/messages/'||new.thread_id::text,'message:'||new.id::text||':trainer')
  on conflict (dedupe_key) where dedupe_key is not null do nothing;
 end if;
 if new.sender_role='admin' and t.trainer_id is not null then
  insert into public.portal_notifications
   (recipient_role,student_id,trainer_id,type,priority,title,message,href,dedupe_key)
  values ('trainer',t.student_id,t.trainer_id,'message_received','action',
   'Message from Robotronix Admin','You have a new Admin message.',
   '/trainer/messages/'||new.thread_id::text,'message:'||new.id::text||':trainer')
  on conflict (dedupe_key) where dedupe_key is not null do nothing;
 end if;
 if new.sender_role<>'parent' and t.parent_id is not null then
  insert into public.portal_notifications
   (recipient_role,student_id,trainer_id,type,priority,title,message,href,dedupe_key)
  values ('parent',t.student_id,t.trainer_id,'message_received','action',
   'New Robotronix message','You have a new message in the family inbox.',
   '/parent/messages/'||new.thread_id::text,'message:'||new.id::text||':parent')
  on conflict (dedupe_key) where dedupe_key is not null do nothing;
 end if;
 return new;
end $$;

-- Existing class scheduling trigger already notifies trainers and families.
-- Notify Admin for cancellations/reschedules made by other roles, not Admin's own edits.
create or replace function public.notify_admin_critical_schedule_change()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if public.is_admin() then return new; end if;
 if new.event_type='class' and
   ((new.status in ('cancelled','rescheduled') and new.status is distinct from old.status)
      or new.date is distinct from old.date
      or new.start_time is distinct from old.start_time
      or new.end_time is distinct from old.end_time) then
  insert into public.portal_notifications
    (recipient_role,student_id,trainer_id,type,priority,title,message,href,dedupe_key)
  values ('admin',new.student_id,new.trainer_id,'class_change_review','action',
    'Class schedule change requires review',
    'A class was cancelled or its schedule changed. Review the affected class.',
    '/admin/schedule',
    'critical-class-change:'||new.id::text||':'||new.updated_at::text)
  on conflict (dedupe_key) where dedupe_key is not null do nothing;
 end if;
 return new;
end $$;
drop trigger if exists schedule_admin_action_update_trg on public.schedule_events;
create trigger schedule_admin_action_update_trg
after update of status,date,start_time,end_time on public.schedule_events
for each row execute function public.notify_admin_critical_schedule_change();

commit;


-- P2/P3 Realtime publication baseline, shared with existing-install migration.
-- P2/P3 event delivery: idempotent Supabase Realtime publication membership.
-- Apply only AFTER baseline schema and P1 action notifications migration.
-- Never expose sensitive trainer_finance / trainer_finance_change_requests row payloads
-- to public channels. Realtime Postgres Changes still enforces table RLS.
begin;
do $$
declare t text;
begin
 if not exists(select 1 from pg_publication where pubname='supabase_realtime') then
  raise exception 'Supabase Realtime publication is missing; verify correct DEV project';
 end if;
 foreach t in array array[
  'portal_notifications','onboarding_submissions',
  'students','trainers','courses','enrollments','cohorts',
  'schedule_events','class_attendance','session_records',
  'learning_observations','learner_projects',
  'trainer_earnings','trainer_payouts','trainer_compensation_plans',
  'trainer_finance','trainer_finance_change_requests',
  'trainer_availability','trainer_availability_overrides',
  'student_invoices','student_fee_payments',
  'progress_alert_actions','communication_threads','communication_messages'
 ] loop
  if to_regclass('public.'||t) is null then
    raise exception 'Realtime required table public.% missing; check migration order',t;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
   execute format('alter publication supabase_realtime add table public.%I',t);
  end if;
 end loop;
end $$;
commit;

-- Read-only verification:
-- select tablename from pg_publication_tables
-- where pubname='supabase_realtime' and schemaname='public' order by tablename;


-- Consolidated server-only diagnostics (existing-install delta: 06_PORTAL_SYSTEM_LOGS.sql)
-- Production-safe operational diagnostics: server-only writes, admin-only reads.
-- Apply in DEV after current baseline. No secrets, raw request bodies or bank details.
begin;
create table if not exists public.portal_system_logs(
 id uuid primary key default gen_random_uuid(),
 occurred_at timestamptz not null default now(),
 level text not null check(level in ('error','warning','info')),
 source text not null,
 action text not null,
 reference_id text not null,
 error_code text,
 safe_message text not null
);
create index if not exists portal_system_logs_date_idx on public.portal_system_logs(occurred_at desc);
create index if not exists portal_system_logs_ref_idx on public.portal_system_logs(reference_id);
alter table public.portal_system_logs enable row level security;
revoke all on public.portal_system_logs from anon,authenticated;
grant select on public.portal_system_logs to authenticated;
drop policy if exists portal_system_logs_admin_read on public.portal_system_logs;
create policy portal_system_logs_admin_read on public.portal_system_logs
 for select to authenticated using(public.is_admin());
-- service_role retains database-side write privileges; no client insert/update/delete policy.
commit;


-- Consolidated payroll cutoff and payout instruction locking (delta: 07_TRAINER_PAYROLL_CUTOFF.sql)
-- Robotronix trainer payout cut-off and immutable salary instructions.
-- Controlled DEV-only migration; review existing payout workflows before Production.
begin;

insert into public.system_settings(key,value_text,description) values
 ('trainer_payout_change_cutoff_day','25','Last IST calendar day for a verified payout change to apply to the current payroll month')
on conflict(key) do nothing;

alter table public.trainer_finance_change_requests
 add column if not exists effective_payroll_month text;
alter table public.trainer_finance_change_requests
 drop constraint if exists finance_request_effective_month_format;
alter table public.trainer_finance_change_requests
 add constraint finance_request_effective_month_format check(
  effective_payroll_month is null or effective_payroll_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

create table if not exists public.trainer_payout_instruction_versions (
 id uuid primary key default gen_random_uuid(),
 trainer_id uuid not null references public.trainers(id) on delete restrict,
 source_request_id uuid unique references public.trainer_finance_change_requests(id) on delete set null,
 effective_payroll_month text not null check(effective_payroll_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
 account_holder_name text not null default '',
 bank_name text not null default '',
 account_number text not null default '',
 ifsc text not null default '',
 upi_id text not null default '',
 pan text not null default '',
 preferred_payout_method text not null default 'bank',
 approved_by uuid references public.profiles(id) on delete set null,
 approved_at timestamptz not null default now()
);
create index if not exists trainer_payout_versions_by_month on public.trainer_payout_instruction_versions(trainer_id,effective_payroll_month desc,approved_at desc);
alter table public.trainer_payout_instruction_versions enable row level security;
revoke all on public.trainer_payout_instruction_versions from anon,authenticated;
grant select on public.trainer_payout_instruction_versions to authenticated;
drop policy if exists trainer_payout_versions_admin_read on public.trainer_payout_instruction_versions;
create policy trainer_payout_versions_admin_read on public.trainer_payout_instruction_versions
 for select to authenticated using(public.is_admin());

-- Preserve the existing verified payout record as a baseline version (only once).
insert into public.trainer_payout_instruction_versions
 (trainer_id,effective_payroll_month,account_holder_name,bank_name,account_number,ifsc,upi_id,pan,preferred_payout_method,approved_at)
select f.trainer_id,'1900-01',f.account_holder_name,f.bank_name,f.account_number,f.ifsc,f.upi_id,f.pan,f.preferred_payout_method,now()
from public.trainer_finance f
where not exists(select 1 from public.trainer_payout_instruction_versions v where v.trainer_id=f.trainer_id);

alter table public.trainer_payouts
 add column if not exists payout_instruction_version_id uuid references public.trainer_payout_instruction_versions(id) on delete restrict;
alter table public.trainer_payouts
 add column if not exists payout_details_locked_at timestamptz;
alter table public.trainer_payouts
 add column if not exists payout_account_holder_name text;
alter table public.trainer_payouts
 add column if not exists payout_bank_name text;
alter table public.trainer_payouts
 add column if not exists payout_account_number text;
alter table public.trainer_payouts
 add column if not exists payout_ifsc text;
alter table public.trainer_payouts
 add column if not exists payout_upi_id text;
alter table public.trainer_payouts
 add column if not exists payout_method text;

create or replace function public.review_trainer_finance_request(p_request_id uuid,p_action text,p_admin_note text default '')
returns void language plpgsql security definer set search_path=public as $$
declare r public.trainer_finance_change_requests%rowtype;
 target_status text; v_cutoff integer; v_month text; v_ist timestamp; v_lock boolean;
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 select * into r from public.trainer_finance_change_requests where id=p_request_id for update;
 if not found then raise exception 'Request not found'; end if;
 if r.status<>'pending' then raise exception 'This finance request has already been reviewed'; end if;
 if p_action='approve' then target_status:='approved';
 elsif p_action='reject' then target_status:='rejected';
 elsif p_action='request_correction' then target_status:='correction_requested';
 else raise exception 'Invalid review action'; end if;
 if target_status in ('rejected','correction_requested') and length(trim(coalesce(p_admin_note,'')))<5 then
  raise exception 'A meaningful correction/rejection reason is required'; end if;
 if target_status='approved' then
  select least(28,greatest(1,coalesce(nullif(value_text,'')::int,25)))
    into v_cutoff from public.system_settings where key='trainer_payout_change_cutoff_day';
  v_cutoff:=coalesce(v_cutoff,25);
  v_ist:=timezone('Asia/Kolkata',now());
  v_month:=to_char(v_ist,'YYYY-MM');
  select exists(select 1 from public.trainer_payouts where trainer_id=r.trainer_id
   and period_month=v_month and status in ('approved','paid')) into v_lock;
  if extract(day from v_ist)::int>v_cutoff or v_lock then
   v_month:=to_char(date_trunc('month',v_ist)+interval '1 month','YYYY-MM');
  end if;
  insert into public.trainer_payout_instruction_versions(
   trainer_id,source_request_id,effective_payroll_month,
   account_holder_name,bank_name,account_number,ifsc,upi_id,pan,preferred_payout_method,approved_by)
  values(r.trainer_id,r.id,v_month,r.account_holder_name,r.bank_name,r.account_number,r.ifsc,r.upi_id,r.pan,r.preferred_payout_method,auth.uid());
  -- Trainer Profile shows the latest approved bank details. Actual salary instructions
  -- are separately snapshotted from the version applicable to each payroll month.
  perform set_config('robotronix.payout_review','1',true);
  insert into public.trainer_finance(
   trainer_id,account_holder_name,bank_name,account_number,ifsc,upi_id,preferred_payout_method,pan,compliance_status,updated_at)
  values(r.trainer_id,r.account_holder_name,r.bank_name,r.account_number,r.ifsc,r.upi_id,r.preferred_payout_method,r.pan,'pending',now())
  on conflict(trainer_id) do update set
   account_holder_name=excluded.account_holder_name,bank_name=excluded.bank_name,
   account_number=excluded.account_number,ifsc=excluded.ifsc,upi_id=excluded.upi_id,
   preferred_payout_method=excluded.preferred_payout_method,pan=excluded.pan,updated_at=now();
 end if;
 update public.trainer_finance_change_requests set status=target_status,
  admin_note=coalesce(p_admin_note,''),reviewed_at=now(),reviewed_by=auth.uid(),
  effective_payroll_month=case when target_status='approved' then v_month else null end
 where id=p_request_id;
end $$;
grant execute on function public.review_trainer_finance_request(uuid,text,text) to authenticated;

-- Finalized netbanking payouts use an immutable snapshot applicable to THAT month.
-- A future trainer edit never mutates an approved or paid snapshot.
create or replace function public.lock_trainer_payout_instructions()
returns trigger language plpgsql security definer set search_path=public as $$
declare v public.trainer_payout_instruction_versions%rowtype;
begin
 if tg_op='UPDATE' and old.status='paid' then
  if new is distinct from old then raise exception 'Paid trainer payroll is locked. Use an audited adjustment'; end if;
  return new;
 end if;
 if tg_op='UPDATE' and old.status='approved' and old.payout_instruction_version_id is null then
  raise exception 'Legacy approved payroll needs explicit payout instruction reconciliation before payment';
 end if;
 if tg_op='UPDATE' and old.status='approved' then
  if new.status not in ('approved','paid') then raise exception 'Approved payroll cannot be returned to draft'; end if;
  if new.gross_amount is distinct from old.gross_amount or new.adjustment_amount is distinct from old.adjustment_amount
     or new.payable_amount is distinct from old.payable_amount or new.period_month is distinct from old.period_month
     or new.trainer_id is distinct from old.trainer_id then
   raise exception 'Approved payroll amounts are locked'; end if;
 end if;
 if new.status in ('approved','paid') then
  if new.status='paid' and (nullif(trim(coalesce(new.payment_reference,'')),'') is null
    or new.paid_at is null) then raise exception 'Paid payroll requires netbanking transaction reference and payment date'; end if;
  if new.payout_instruction_version_id is null then
   select * into v from public.trainer_payout_instruction_versions
   where trainer_id=new.trainer_id and effective_payroll_month<=new.period_month
   order by effective_payroll_month desc,approved_at desc limit 1;
   if not found then raise exception 'No verified payout instructions for payroll month %',new.period_month; end if;
   new.payout_instruction_version_id:=v.id;
   new.payout_account_holder_name:=v.account_holder_name;
   new.payout_bank_name:=v.bank_name;
   new.payout_account_number:=v.account_number;
   new.payout_ifsc:=v.ifsc;
   new.payout_upi_id:=v.upi_id;
   new.payout_method:=v.preferred_payout_method;
   new.payout_details_locked_at:=now();
  elsif tg_op='UPDATE' and old.payout_instruction_version_id is not null then
   if new.payout_instruction_version_id is distinct from old.payout_instruction_version_id
    or new.payout_account_number is distinct from old.payout_account_number
    or new.payout_upi_id is distinct from old.payout_upi_id
    or new.payout_method is distinct from old.payout_method then
    raise exception 'Payout instructions are locked for this payroll month'; end if;
  end if;
 end if;
 return new;
end $$;
drop trigger if exists trainer_payout_instruction_lock_trg on public.trainer_payouts;
create trigger trainer_payout_instruction_lock_trg
before insert or update on public.trainer_payouts
for each row execute function public.lock_trainer_payout_instructions();

-- Admin's direct edits to sensitive trainer finance fields must also preserve
-- an effective-dated version, otherwise those edits could evade payroll cutoff.
create or replace function public.version_direct_admin_payout_change()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_cutoff int; v_month text; v_date timestamp; v_locked boolean;
begin
 if current_setting('robotronix.payout_review',true)='1' then return new; end if;
 if tg_op='UPDATE' and row(
   new.account_holder_name,new.bank_name,new.account_number,new.ifsc,new.upi_id,new.pan,new.preferred_payout_method)
   is not distinct from row(
   old.account_holder_name,old.bank_name,old.account_number,old.ifsc,old.upi_id,old.pan,old.preferred_payout_method)
 then return new; end if;
 if not public.is_admin() then
  -- Review RPC runs with a controlled skip marker above. Never allow trainer writes.
  raise exception 'Admin verification is required before payout details change';
 end if;
 select least(28,greatest(1,coalesce(nullif(value_text,'')::int,25)))
  into v_cutoff from public.system_settings where key='trainer_payout_change_cutoff_day';
 v_cutoff:=coalesce(v_cutoff,25);
 v_date:=timezone('Asia/Kolkata',now());v_month:=to_char(v_date,'YYYY-MM');
 select exists(select 1 from public.trainer_payouts where trainer_id=new.trainer_id
  and period_month=v_month and status in ('approved','paid')) into v_locked;
 if extract(day from v_date)::int>v_cutoff or v_locked then
  v_month:=to_char(date_trunc('month',v_date)+interval '1 month','YYYY-MM');
 end if;
 insert into public.trainer_payout_instruction_versions(
 trainer_id,effective_payroll_month,account_holder_name,bank_name,account_number,ifsc,
 upi_id,pan,preferred_payout_method,approved_by)
 values(new.trainer_id,v_month,new.account_holder_name,new.bank_name,new.account_number,
 new.ifsc,new.upi_id,new.pan,new.preferred_payout_method,auth.uid());
 return new;
end $$;
drop trigger if exists trainer_finance_direct_change_version_trg on public.trainer_finance;
create trigger trainer_finance_direct_change_version_trg
after insert or update of account_holder_name,bank_name,account_number,ifsc,upi_id,pan,preferred_payout_method
on public.trainer_finance for each row execute function public.version_direct_admin_payout_change();

commit;

-- Passwordless access state (existing-install upgrade: 08_PASSWORDLESS_PORTAL_ACCESS.sql)
-- Expand portal-access state for passwordless Admin-granted accounts.
-- This is an additive DEV migration, not a full schema install.
begin;
alter table public.portal_access_requests
 drop constraint if exists portal_access_requests_status_check;
alter table public.portal_access_requests
 add constraint portal_access_requests_status_check
 check(status in ('invited','provisioned','linked','disabled'));
commit;

-- Service-role-only diagnostic retention (existing upgrade: 09_SYSTEM_LOG_RETENTION.sql)
-- Optional scheduled retention job entrypoint for server-side operations.
-- Use Supabase's Cron UI / pg_cron scheduler to invoke this function daily.
-- Existing database upgrade: run only after 06_PORTAL_SYSTEM_LOGS.sql.
begin;
create or replace function public.purge_old_portal_system_logs(p_retention_days integer default 90)
returns bigint
language plpgsql security invoker
set search_path=public
as $$
declare v_deleted bigint;
begin
 if p_retention_days<30 or p_retention_days>365 then
  raise exception 'Retention must be between 30 and 365 days';
 end if;
 delete from public.portal_system_logs
 where occurred_at < now()-make_interval(days=>p_retention_days);
 get diagnostics v_deleted=row_count;
 return v_deleted;
end $$;
revoke execute on function public.purge_old_portal_system_logs(integer) from public,anon,authenticated;
grant execute on function public.purge_old_portal_system_logs(integer) to service_role;
commit;
-- In Supabase Cron schedule a daily task with service-role authorization.
-- Do not schedule in Production until logging retention policy has been approved.

-- Trainer availability notifications
-- Trainer-origin availability updates: one Admin notification per successful user action.
-- Called only after an availability/override save or deletion succeeds.
create or replace function public.notify_admin_trainer_availability_change(p_trainer_id uuid,p_change_kind text)
returns void language plpgsql security definer set search_path=public as $$
declare v_name text;
begin
 if auth.uid() is null or p_trainer_id is null
    or public.current_trainer_id() is distinct from p_trainer_id then
  raise exception 'Only the linked trainer may report their own availability change';
 end if;
 if p_change_kind not in ('weekly','override_added','override_removed') then
  raise exception 'Unsupported availability change kind';
 end if;
 select full_name into v_name from public.trainers where id=p_trainer_id;
 insert into public.portal_notifications(recipient_role,trainer_id,type,priority,title,message,href)
 values('admin',p_trainer_id,'trainer_availability_changed','action',
        'Trainer availability updated',
        coalesce(nullif(v_name,''),'A trainer') || case p_change_kind
          when 'weekly' then ' updated weekly working hours.'
          when 'override_added' then ' added leave or special availability.'
          else ' removed a leave or special availability entry.' end,
        '/admin/trainers/'||p_trainer_id::text);
end $$;
revoke all on function public.notify_admin_trainer_availability_change(uuid,text) from public,anon;
grant execute on function public.notify_admin_trainer_availability_change(uuid,text) to authenticated;


-- ======================================================================
-- Scheduling V2 foundation: transaction-safe booking of full course slots
-- The server is authoritative; browser previews never create bookings.
-- ======================================================================
alter table public.schedule_events
 add column if not exists generation_key text;
create unique index if not exists schedule_events_generation_key_unique
 on public.schedule_events(generation_key) where generation_key is not null;

create or replace function public.generate_enrollment_schedule_v2(
 p_enrollment_id uuid,
 p_horizon text default 'full',
 p_weeks integer default null
)
returns jsonb language plpgsql security definer set search_path=public as $$
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
 if p_horizon not in ('full','weeks','manual') then raise exception 'Invalid scheduling horizon'; end if;
 if p_horizon='manual' then return jsonb_build_object('created',0,'mode','manual'); end if;
 if p_horizon='weeks' and (p_weeks is null or p_weeks<1 or p_weeks>104)
 then raise exception 'Weeks must be between 1 and 104'; end if;
 select * into v_en from public.enrollments where id=p_enrollment_id for update;
 if not found then raise exception 'Enrollment not found'; end if;
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
    'Course classes scheduled',v_created::text||' new class dates were booked. View the learning timetable.','/parent'),
   ('trainer',v_en.student_id,v_en.trainer_id,'course_schedule_generated','info',
    'Course classes scheduled',v_created::text||' future classes added to your timetable.','/trainer/classes');
 end if;
 return jsonb_build_object('created',v_created,'total',v_n,'mode',p_horizon);
end $$;
revoke all on function public.generate_enrollment_schedule_v2(uuid,text,integer) from public,anon;
grant execute on function public.generate_enrollment_schedule_v2(uuid,text,integer) to authenticated;


-- Scheduling V2: Admin reassignment of future uncompleted 1:1 classes.
-- Existing delivered, locked and historically attributed classes are untouched.
create or replace function public.reassign_enrollment_trainer_v2(
 p_enrollment_id uuid,p_new_trainer_id uuid,p_reason text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
 v_en public.enrollments%rowtype; v_count integer:=0;
 v_event record;
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
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
end $$;
revoke all on function public.reassign_enrollment_trainer_v2(uuid,uuid,text) from public,anon;
grant execute on function public.reassign_enrollment_trainer_v2(uuid,uuid,text) to authenticated;


-- Scheduling V2: trainer-owned reusable Zoom meetings. Unlike Zoom API-created
-- per-session meetings, this is a stable join link controlled by the trainer.
alter table public.trainers add column if not exists zoom_join_url text;
alter table public.trainers drop constraint if exists trainers_zoom_join_url_valid;
alter table public.trainers add constraint trainers_zoom_join_url_valid
 check (zoom_join_url is null or zoom_join_url='' or
        zoom_join_url ~* '^https://([a-z0-9-]+[.])*zoom[.]us/(j|wc/join)/[0-9]+([?][a-z0-9_=&%-]+)?$');

create or replace function public.class_reusable_zoom_link_v2(p_event_id uuid)
returns text language plpgsql security definer set search_path=public as $$
declare
 e public.schedule_events%rowtype;
 v_url text;
 v_authorized boolean:=false;
 v_start timestamptz; v_end timestamptz;
begin
 if auth.uid() is null then return null; end if;
 select * into e from public.schedule_events where id=p_event_id;
 if not found or e.event_type<>'class' or e.status not in ('scheduled','tentative','makeup')
 then return null; end if;
 if public.is_admin() or public.current_trainer_id()=e.trainer_id then
  v_authorized:=true;
 else
  select exists(
   select 1 from public.students s
   where s.id in (
     select x.student_id from public.enrollments x
       where x.id=e.enrollment_id or (e.cohort_id is not null and x.cohort_id=e.cohort_id)
     union select e.student_id where e.student_id is not null
   )
   and (
     s.profile_id=auth.uid()
     or exists(select 1 from public.parent_students ps
          join public.parents p on p.id=ps.parent_id
          where ps.student_id=s.id and p.profile_id=auth.uid())
   )
  ) into v_authorized;
 end if;
 if not v_authorized then return null; end if;
 v_start:=(e.date+e.start_time) at time zone e.timezone;
 v_end:=(e.date+e.end_time) at time zone e.timezone;
 if now()<v_start-interval '15 minutes' or now()>v_end+interval '15 minutes'
 then return null; end if;
 select nullif(trim(t.zoom_join_url),'') into v_url from public.trainers t where t.id=e.trainer_id;
 return v_url;
end $$;
revoke all on function public.class_reusable_zoom_link_v2(uuid) from public,anon;
grant execute on function public.class_reusable_zoom_link_v2(uuid) to authenticated;


-- Scheduling V2: 1-to-1 learner pause. The operation is all-or-nothing.
-- Shift uncompleted *regular* future classes by complete weeks. This preserves
-- weekly days/clock times and avoids breaking paid/delivered history.
create or replace function public.pause_enrollment_v2(
 p_enrollment_id uuid,p_from date,p_resume date,p_reason text,p_note text default ''
) returns jsonb language plpgsql security definer set search_path=public as $$
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
end $$;
revoke all on function public.pause_enrollment_v2(uuid,date,date,text,text) from public,anon;
grant execute on function public.pause_enrollment_v2(uuid,date,date,text,text) to authenticated;

create or replace function public.resume_enrollment_v2(p_enrollment_id uuid,p_note text default '')
returns boolean language plpgsql security definer set search_path=public as $$
declare v_en public.enrollments%rowtype;
begin
 select * into v_en from public.enrollments where id=p_enrollment_id for update;
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
end $$;
revoke all on function public.resume_enrollment_v2(uuid,text) from public,anon;
grant execute on function public.resume_enrollment_v2(uuid,text) to authenticated;


-- Scheduling V2: trainer-authorized one-off cancellation, with no automatic pay.
create or replace function public.cancel_class_v2(p_event_id uuid,p_requested_by text,p_reason text)
returns boolean language plpgsql security definer set search_path=public as $$
declare e public.schedule_events%rowtype;
begin
 select * into e from public.schedule_events where id=p_event_id for update;
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
end $$;
revoke all on function public.cancel_class_v2(uuid,text,text) from public,anon;
grant execute on function public.cancel_class_v2(uuid,text,text) to authenticated;

-- One-off reschedules are an atomic linked original/replacement pair.
create or replace function public.reschedule_class_v2(
 p_event_id uuid,p_date date,p_start time,p_end time,p_requested_by text,p_reason text
) returns uuid language plpgsql security definer set search_path=public as $$
declare e public.schedule_events%rowtype; new_id uuid; v_start timestamptz; v_end timestamptz;
begin
 select * into e from public.schedule_events where id=p_event_id for update;
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
end $$;
revoke all on function public.reschedule_class_v2(uuid,date,time,time,text,text) from public,anon;
grant execute on function public.reschedule_class_v2(uuid,date,time,time,text,text) to authenticated;


-- Scheduling V2: explicit Admin financial decision on parent cancellations.
create or replace function public.resolve_class_cancellation_v2(
 p_event_id uuid,p_decision text,p_reason text
) returns boolean language plpgsql security definer set search_path=public as $$
declare e public.schedule_events%rowtype;
begin
 if not public.is_admin() then raise exception 'Admin approval required'; end if;
 if p_decision not in ('approved','rejected') or nullif(trim(coalesce(p_reason,'')),'') is null
 then raise exception 'Choose approve/reject and record the reason'; end if;
 select * into e from public.schedule_events where id=p_event_id for update;
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
end $$;
revoke all on function public.resolve_class_cancellation_v2(uuid,text,text) from public,anon;
grant execute on function public.resolve_class_cancellation_v2(uuid,text,text) to authenticated;


-- Scheduling V2: one shared class per cohort occurrence (never per member).
create or replace function public.generate_cohort_schedule_v2(
 p_cohort_id uuid,p_horizon text default 'full',p_weeks integer default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
 c public.cohorts%rowtype; course public.courses%rowtype;
 v_day date; v_slot jsonb; v_start time; v_end time;
 v_start_at timestamptz; v_end_at timestamptz;
 v_total integer; v_count integer:=0; v_created integer:=0;
 v_limit integer; v_key text;
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 if p_horizon not in ('full','weeks','manual') then raise exception 'Invalid horizon'; end if;
 if p_horizon='manual' then return jsonb_build_object('created',0,'total',0); end if;
 if p_horizon='weeks' and (p_weeks is null or p_weeks not between 1 and 104)
 then raise exception 'Weeks must be between 1 and 104'; end if;
 select * into c from public.cohorts where id=p_cohort_id for update;
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
     'Batch timetable updated',v_created::text||' new shared batch classes were scheduled.','/parent'
   from public.enrollments en where en.cohort_id=c.id and en.status in ('active','on_hold');
 end if;
 return jsonb_build_object('created',v_created,'total',v_count);
end $$;
revoke all on function public.generate_cohort_schedule_v2(uuid,text,integer) from public,anon;
grant execute on function public.generate_cohort_schedule_v2(uuid,text,integer) to authenticated;

-- Scheduling V2: a makeup always references a previously cancelled/missed
-- class; it never represents a new curriculum entitlement.
create or replace function public.create_makeup_class_v2(
 p_original_id uuid,p_date date,p_start time,p_end time,p_reason text
) returns uuid language plpgsql security definer set search_path=public as $$
declare original public.schedule_events%rowtype; v_id uuid;
 v_start_at timestamptz;v_end_at timestamptz;
begin
 select * into original from public.schedule_events where id=p_original_id for update;
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
end $$;
revoke all on function public.create_makeup_class_v2(uuid,date,time,time,text) from public,anon;
grant execute on function public.create_makeup_class_v2(uuid,date,time,time,text) to authenticated;


-- Individual leave from a cohort NEVER shifts or cancels the shared batch class.
create or replace function public.pause_cohort_member_v2(
 p_enrollment_id uuid,p_from date,p_resume date,p_reason text,p_note text default ''
) returns jsonb language plpgsql security definer set search_path=public as $$
declare en public.enrollments%rowtype; v_days integer;
begin
 select * into en from public.enrollments where id=p_enrollment_id for update;
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
end $$;
revoke all on function public.pause_cohort_member_v2(uuid,date,date,text,text) from public,anon;
grant execute on function public.pause_cohort_member_v2(uuid,date,date,text,text) to authenticated;


-- Scheduling V2: future-only batch trainer replacement.
create or replace function public.reassign_cohort_trainer_v2(
 p_cohort_id uuid,p_new_trainer_id uuid,p_reason text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
 c public.cohorts%rowtype; v_count integer:=0;
 ev public.schedule_events%rowtype;
begin
 if not public.is_admin() then raise exception 'Admin required'; end if;
 if nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'Reason required'; end if;
 select * into c from public.cohorts where id=p_cohort_id for update;
 if not found or c.status not in ('planned','active') or c.trainer_id is null
 then raise exception 'Cohort is not eligible for reassignment'; end if;
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
end $$;
revoke all on function public.reassign_cohort_trainer_v2(uuid,uuid,text) from public,anon;
grant execute on function public.reassign_cohort_trainer_v2(uuid,uuid,text) to authenticated;

-- Privileged maintenance RPCs must not be callable through public PostgREST
-- roles. Database triggers run as the owning role and the server-side invoice
-- API uses the service-role client, so those trusted call paths remain intact.
revoke execute on function public.next_robotronix_invoice_number(date)
  from public, anon, authenticated;
revoke execute on function public.refresh_enrollment_progress(uuid)
  from public, anon, authenticated;
grant execute on function public.next_robotronix_invoice_number(date)
  to service_role;


-- Phase 3: transactional replacement of trainer weekly availability.
-- Safe on repeated installation. Authorization is checked before any mutation.
create or replace function public.replace_trainer_availability_v1(p_trainer_id uuid,p_slots jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 v_slot record;
 v_prior_day integer := -1;
 v_prior_end time;
 v_count integer := 0;
begin
 if auth.uid() is null or p_trainer_id is null or
    not (public.is_admin() or public.current_trainer_id()=p_trainer_id)
 then raise exception 'Trainer availability permission denied'; end if;
 if p_slots is null or jsonb_typeof(p_slots)<>'array' then raise exception 'Availability slots must be a JSON array'; end if;
 if jsonb_array_length(p_slots)>42 then raise exception 'Too many availability slots'; end if;
 perform pg_advisory_xact_lock(3210,hashtext(p_trainer_id::text));
 for v_slot in
   select * from jsonb_to_recordset(p_slots)
   as x(day_of_week integer,start_time time,end_time time,enabled boolean)
   order by day_of_week,start_time,end_time
 loop
   if v_slot.day_of_week is null or v_slot.day_of_week not between 0 and 6 or
      v_slot.start_time is null or v_slot.end_time is null or
      v_slot.start_time>=v_slot.end_time or v_slot.enabled is distinct from true
   then raise exception 'Invalid trainer availability slot'; end if;
   if v_prior_day=v_slot.day_of_week and v_slot.start_time<v_prior_end
   then raise exception 'Overlapping trainer availability slots'; end if;
   v_prior_day:=v_slot.day_of_week;
   v_prior_end:=v_slot.end_time;
   v_count:=v_count+1;
 end loop;
 delete from public.trainer_availability where trainer_id=p_trainer_id;
 insert into public.trainer_availability(trainer_id,day_of_week,start_time,end_time,enabled)
 select p_trainer_id,day_of_week,start_time,end_time,true
 from jsonb_to_recordset(p_slots)
 as x(day_of_week integer,start_time time,end_time time,enabled boolean);
 return jsonb_build_object('saved',v_count);
end $$;
revoke all on function public.replace_trainer_availability_v1(uuid,jsonb) from public,anon;
grant execute on function public.replace_trainer_availability_v1(uuid,jsonb) to authenticated;


-- P0/P1 audit-history coverage (fresh-install source of truth).
-- Keep aligned with database/04_migrations/2026_10_25_P0_P1_AUDIT_COVERAGE.sql.
DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['portal_access_requests','student_invoices','zoom_meetings','zoom_recordings'] LOOP
  IF to_regclass('public.'||t) IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM pg_trigger trg JOIN pg_class c ON c.oid=trg.tgrelid
   JOIN pg_namespace ns ON ns.oid=c.relnamespace
   WHERE ns.nspname='public' AND c.relname=t AND trg.tgname='audit_'||t
  ) THEN
   EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_core_change()', 'audit_'||t,t);
  END IF;
 END LOOP;
END $$;
