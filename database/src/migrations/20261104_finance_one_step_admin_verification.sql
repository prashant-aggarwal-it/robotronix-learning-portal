-- UAT-FIN-01: Existing-database upgrade for one-step payout approval.
-- REVIEW ONLY. Apply to a backed-up DEV database after validating schema parity.
-- Does not modify any existing payout requests, verification statuses or payroll.
-- Existing approved requests are NOT retroactively marked verified.
begin;

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
  -- Approving a payout-change request is also the Admin's verification of the
  -- submitted payout details. This does NOT independently validate a bank account.
  -- Enforce the same required-field checks as the Admin finance editor.
  if r.preferred_payout_method='bank' then
   if nullif(trim(coalesce(r.account_holder_name,'')),'') is null
      or nullif(trim(coalesce(r.bank_name,'')),'') is null
      or nullif(trim(coalesce(r.account_number,'')),'') is null
      or coalesce(upper(trim(r.ifsc)),'') !~ '^[A-Z]{4}0[A-Z0-9]{6}$' then
    raise exception 'Complete bank holder, bank name, account number and a valid IFSC before approval';
   end if;
  elsif r.preferred_payout_method='upi' then
   if coalesce(trim(r.upi_id),'') !~ '^[^[:space:]@]+@[^[:space:]@]+$' then
    raise exception 'A valid UPI ID is required before approval';
   end if;
  end if;
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
  -- Payroll versions and approved/paid payout snapshots remain immutable.
  -- Guarded setting avoids a second direct-change payout version in this RPC.
  perform set_config('robotronix.payout_review','1',true);
  insert into public.trainer_finance(
   trainer_id,account_holder_name,bank_name,account_number,ifsc,upi_id,preferred_payout_method,pan,compliance_status,updated_at)
  values(r.trainer_id,r.account_holder_name,r.bank_name,r.account_number,r.ifsc,r.upi_id,r.preferred_payout_method,r.pan,'verified',now())
  on conflict(trainer_id) do update set
   account_holder_name=excluded.account_holder_name,bank_name=excluded.bank_name,
   account_number=excluded.account_number,ifsc=excluded.ifsc,upi_id=excluded.upi_id,
   preferred_payout_method=excluded.preferred_payout_method,pan=excluded.pan,
   compliance_status='verified',updated_at=now();
 end if;
 -- Correction/rejection never changes the existing approved payout details,
 -- compliance status or approved payroll instructions.
 update public.trainer_finance_change_requests set status=target_status,
  admin_note=coalesce(p_admin_note,''),reviewed_at=now(),reviewed_by=auth.uid(),
  effective_payroll_month=case when target_status='approved' then v_month else null end
 where id=p_request_id;
end $$;
grant execute on function public.review_trainer_finance_request(uuid,text,text) to authenticated;

-- The function performs its own public.is_admin() authorization check.
-- Preserve existing authenticated-user RPC access; revoke unintended PUBLIC access.
revoke all on function public.review_trainer_finance_request(uuid,text,text) from public,anon;
grant execute on function public.review_trainer_finance_request(uuid,text,text) to authenticated;

commit;

-- Read-only DEV verification:
-- select pg_get_functiondef('public.review_trainer_finance_request(uuid,text,text)'::regprocedure);
-- select compliance_status,count(*) from public.trainer_finance group by 1 order by 1;
-- Confirm on a disposable trainer record:
-- approve => request approved AND finance compliance_status verified;
-- request_correction/reject => finance values/status unchanged;
-- duplicate approve => error, no duplicate instruction version;
-- invalid bank IFSC or blank bank account => error, atomic rollback;
-- payroll cutoffs, approved/paid payroll snapshots remain unchanged.
