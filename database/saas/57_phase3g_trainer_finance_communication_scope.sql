-- Phase 3G: restrict availability, payroll review and communications to selected Academy tenant.
BEGIN;
CREATE OR REPLACE FUNCTION public.mark_communication_thread_read(p_thread_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if saas.has_organization_membership() AND NOT EXISTS (
    SELECT 1 FROM public.communication_threads t WHERE t.id=p_thread_id AND (
      (t.student_id IS NOT NULL AND saas.can_access_academy_record('students',t.student_id))
      OR (t.trainer_id IS NOT NULL AND saas.can_access_academy_record('trainers',t.trainer_id))
    )
  ) THEN raise exception 'Cross-organization communication denied' using errcode='42501'; END IF;
  if public.is_admin() AND saas.has_organization_membership() AND NOT saas.can_administer_selected_academy()
  THEN raise exception 'Selected Academy admin required' using errcode='42501'; END IF;
  if public.is_admin() then
    update public.communication_threads set unread_admin=0,updated_at=now() where id=p_thread_id and unread_admin<>0;
  elsif public.current_role()='trainer' then
    update public.communication_threads set unread_trainer=0,updated_at=now() where id=p_thread_id and trainer_id=public.current_trainer_id() and unread_trainer<>0;
  elsif public.current_role()='parent' then
    update public.communication_threads set unread_parent=0,updated_at=now() where id=p_thread_id and parent_id=public.current_parent_id() and unread_parent<>0;
  else
    raise exception 'Not authorized';
  end if;
end $function$
;
CREATE OR REPLACE FUNCTION public.replace_trainer_availability_v1(p_trainer_id uuid, p_slots jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
 v_slot record;
 v_prior_day integer := -1;
 v_prior_end time;
 v_count integer := 0;
begin
 if auth.uid() is null or p_trainer_id is null or
    not (public.is_admin() or public.current_trainer_id()=p_trainer_id)
 then raise exception 'Trainer availability permission denied'; end if;
 if saas.has_organization_membership() and
   (NOT saas.can_access_academy_record('trainers',p_trainer_id)
    OR (public.is_admin() AND NOT saas.can_administer_selected_academy())) then
   raise exception 'Cross-organization trainer availability denied' using errcode='42501';
 end if;
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
end $function$
;
CREATE OR REPLACE FUNCTION public.review_trainer_finance_request(p_request_id uuid, p_action text, p_admin_note text DEFAULT ''::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.trainer_finance_change_requests%rowtype;
 target_status text; v_cutoff integer; v_month text; v_ist timestamp; v_lock boolean;
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 select * into r from public.trainer_finance_change_requests where id=p_request_id for update;
 if not found then raise exception 'Request not found'; end if;
 if saas.has_organization_membership() AND
   (NOT saas.can_administer_selected_academy()
    OR NOT saas.can_access_academy_record('trainers',r.trainer_id)) then
   raise exception 'Cross-organization finance review denied' using errcode='42501';
 end if;
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
end $function$
;
CREATE OR REPLACE FUNCTION public.set_communication_thread_status(p_thread_id uuid, p_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_status not in ('open','waiting_parent','waiting_team','resolved') then raise exception 'Invalid thread status'; end if;
  if saas.has_organization_membership() AND NOT EXISTS (
    SELECT 1 FROM public.communication_threads t WHERE t.id=p_thread_id AND (
      (t.student_id IS NOT NULL AND saas.can_access_academy_record('students',t.student_id))
      OR (t.trainer_id IS NOT NULL AND saas.can_access_academy_record('trainers',t.trainer_id))
    )
  ) THEN raise exception 'Cross-organization communication denied' using errcode='42501'; END IF;
  if public.is_admin() AND saas.has_organization_membership() AND NOT saas.can_administer_selected_academy()
  THEN raise exception 'Selected Academy admin required' using errcode='42501'; END IF;
  if public.is_admin() then
    update public.communication_threads set status=p_status,updated_at=now() where id=p_thread_id;
  elsif public.current_role()='trainer' then
    update public.communication_threads set status=p_status,updated_at=now() where id=p_thread_id and trainer_id=public.current_trainer_id();
    if not found then raise exception 'Not authorized'; end if;
  else
    raise exception 'Not authorized';
  end if;
end $function$
;
COMMIT;
