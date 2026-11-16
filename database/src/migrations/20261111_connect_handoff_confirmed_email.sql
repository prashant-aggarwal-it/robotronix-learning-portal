-- Development/upgrade alignment (NOT required for a fresh-module install via release_install/07).
-- Changes the trusted confirmed-email boundary for the CRM guardian handoff RPC.
BEGIN;
DROP FUNCTION IF EXISTS public.portal_admission_handoff_token(text,text,uuid,uuid);
create or replace function public.portal_admission_handoff_token(
 p_token_hash text,p_action text,p_user_id uuid default null,p_submission_id uuid default null,p_confirmed_email text default null
) returns jsonb language plpgsql security invoker set search_path='' as $fn$
declare v_h record;v_guardian record;v_learner record;v_onb record;
 v_email text;v_verified boolean:=false;
begin
 select * into v_h from connect.portal_admission_handoffs
 where token_hash=p_token_hash and token_expires_at>now() and status in ('invited','onboarding_pending','review_required') for update;
 if not found then raise exception 'Handoff link expired or unavailable' using errcode='22023';end if;
 select p.id,p.full_name into v_learner from connect.people p where p.tenant_id=v_h.tenant_id and p.id=v_h.learner_person_id;
 select p.id,p.full_name into v_guardian from connect.opportunities o join connect.people p on p.tenant_id=o.tenant_id and p.id=o.contact_id
 where o.tenant_id=v_h.tenant_id and o.id=v_h.opportunity_id;
 if v_guardian.id is null or v_learner.id is null then raise exception 'Handoff contact missing' using errcode='22023';end if;
 select display_value into v_email from connect.contact_methods where tenant_id=v_h.tenant_id and person_id=v_guardian.id
  and kind='email' order by is_primary desc limit 1;
 if p_action='preview' then
  return jsonb_build_object('parentName',v_guardian.full_name,'childName',v_learner.full_name,
   'parentEmail',coalesce(v_email,''),'source','CRM admission','offerCurrency',v_h.offer_snapshot->>'currency',
   'offerSessions',v_h.offer_snapshot->>'sessions');
 end if;
 if p_action<>'bind' or p_user_id is null or p_submission_id is null then raise exception 'Invalid handoff request' using errcode='22023';end if;
 if v_h.onboarding_submission_id is not null then
  if v_h.onboarding_submission_id=p_submission_id then return jsonb_build_object('ok',true,'status',v_h.status);end if;
  raise exception 'Handoff already bound to another onboarding' using errcode='23505';
 end if;
 select * into v_onb from public.onboarding_submissions where id=p_submission_id and user_id=p_user_id and data_consent=true;
 if not found or lower(btrim(v_onb.child_name))<>lower(btrim(v_learner.full_name)) then
  raise exception 'Consent or learner identity mismatch' using errcode='42501';end if;
 -- Caller is the authenticated server; only service_role can execute this RPC.
 -- The server uses Supabase Auth getUser(token) to supply an email only if confirmed.
 v_verified:=p_confirmed_email is not null and v_email is not null and
  lower(btrim(p_confirmed_email))=lower(btrim(v_email));
 update connect.portal_admission_handoffs set onboarding_submission_id=p_submission_id,
  verified_at=case when v_verified then now() else null end,
  verified_by=null,status=case when v_verified then 'onboarding_pending' else 'review_required' end,
  updated_at=now() where id=v_h.id;
 return jsonb_build_object('ok',true,'status',case when v_verified then 'onboarding_pending' else 'review_required' end);
end $fn$;
revoke all on function public.portal_admission_handoff_token(text,text,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.portal_admission_handoff_token(text,text,uuid,uuid,text) to service_role;
COMMIT;
