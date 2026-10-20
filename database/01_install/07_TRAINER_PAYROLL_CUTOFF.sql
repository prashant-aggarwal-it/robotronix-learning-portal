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
