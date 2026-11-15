-- Phase 3G: scope family payment allocations to selected SaaS Academy tenant.
-- Additive replacement; preserves legacy standalone admin operation.
BEGIN;
CREATE OR REPLACE FUNCTION public.record_family_payment_v1(p_parent_id uuid, p_currency text, p_amount numeric, p_payment_date date, p_method text, p_reference text, p_allocations jsonb, p_collector_name text DEFAULT ''::text, p_location text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
 v_line jsonb;v_package_id uuid;v_amount numeric(14,3);
 v_total numeric(14,3):=0;v_seen uuid[]:=array[]::uuid[];
 v_receipt record;v_factor integer;
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 if saas.has_organization_membership() and not saas.can_administer_selected_academy() then
  raise exception 'Selected Academy organization admin access required' using errcode='42501';
 end if;
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
      and (not saas.has_organization_membership() or saas.can_access_academy_record('enrollments',en.id))
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
 insert into public.portal_notifications(
  recipient_role,recipient_profile_id,type,priority,title,message,href,dedupe_key)
 select 'parent',pa.profile_id,'family_payment_received','info','Family payment received',
   'Received '||p_currency||' '||to_char(p_amount,'FM999999990.999')
   ||' for your family. View the receipt and allocations.',
   '/parent/billing','family-payment:'||v_receipt.id::text
 from public.parents pa where pa.id=p_parent_id
 on conflict (dedupe_key) where dedupe_key is not null do nothing;
 return jsonb_build_object('receipt_id',v_receipt.id,'receipt_number',v_receipt.receipt_number,'allocated',v_total);
end $function$
;
COMMIT;
