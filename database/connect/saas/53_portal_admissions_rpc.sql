-- Service-role-only Connect admissions facade. No Connect schema Data API exposure.
create or replace function public.connect_portal_admissions(
 p_actor_id uuid,p_tenant_id uuid,p_action text,p_data jsonb default '{}'::jsonb
) returns jsonb language plpgsql security invoker set search_path='' as $fn$
declare v_role text;v_installed boolean;v_id uuid;v_opp record;v_h record;v_onb record;
 v_stage uuid;v_old_stage uuid;v_member_id uuid;v_result jsonb;v_snapshot jsonb;
begin
 select m.role,m.id into v_role,v_member_id from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active' and t.status in ('active','trial');
 if v_role is null then raise exception 'CRM workspace access denied' using errcode='42501';end if;
 select exists(select 1 from connect.portal_demo_integrations where tenant_id=p_tenant_id and status='active') into v_installed;
 if not v_installed then raise exception 'Portal integration not active' using errcode='42501';end if;
 if p_action='list' then
  if v_role='viewer' then return jsonb_build_object('items','[]'::jsonb);end if;
  select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc),'[]'::jsonb) into v_result from (
   select h.id,h.opportunity_id,h.learner_person_id,h.status,h.offer_snapshot,h.created_at,
    h.onboarding_submission_id,h.portal_enrollment_id,h.verified_at,h.confirmed_at
   from connect.portal_admission_handoffs h where h.tenant_id=p_tenant_id
   order by h.created_at desc limit 100
  ) q;
  return jsonb_build_object('items',v_result);
 end if;
 if v_role='viewer' then raise exception 'CRM write access denied' using errcode='42501';end if;
 if p_action='accept' then
  if coalesce((p_data->>'consentAttested')::boolean,false) is not true then
   raise exception 'Guardian acceptance evidence is required' using errcode='22023';end if;
  select * into v_opp from connect.opportunities where tenant_id=p_tenant_id and id=(p_data->>'opportunityId')::uuid;
  if v_opp.id is null or v_opp.contact_id is null then raise exception 'Opportunity and guardian are required' using errcode='22023';end if;
  if not exists(select 1 from connect.people where tenant_id=p_tenant_id and id=(p_data->>'learnerPersonId')::uuid and status='active') or
   (v_opp.contact_id<>(p_data->>'learnerPersonId')::uuid and not exists(
    select 1 from connect.opportunity_people where tenant_id=p_tenant_id and opportunity_id=v_opp.id and person_id=(p_data->>'learnerPersonId')::uuid))
  then raise exception 'Learner is not linked to this admission' using errcode='22023';end if;
  if exists(select 1 from connect.pipeline_stages where tenant_id=p_tenant_id and id=v_opp.stage_id and outcome='lost') then
   raise exception 'Reopen the lost opportunity first' using errcode='22023';end if;
  v_snapshot:=p_data->'offer';
  if v_snapshot is null or jsonb_typeof(v_snapshot)<>'object' or
   coalesce((v_snapshot->>'fee')::numeric,-1)<0 or
   coalesce((v_snapshot->>'sessions')::int,0)<=0 or
   (v_snapshot->>'currency') !~ '^[A-Z]{3}$' or length(coalesce(v_snapshot->>'terms',''))>2000
  then raise exception 'Offer fee, currency, sessions and terms are required' using errcode='22023';end if;
  select * into v_h from connect.portal_admission_handoffs where tenant_id=p_tenant_id and request_id=(p_data->>'requestId')::uuid;
  if found then return jsonb_build_object('id',v_h.id,'existing',true,'payloadHash',v_h.payload_hash,'status',v_h.status);end if;
  insert into connect.portal_admission_handoffs(tenant_id,opportunity_id,learner_person_id,request_id,payload_hash,
   token_hash,token_expires_at,offer_snapshot,acceptance_recorded_by,guardian_consent_attested)
  values(p_tenant_id,v_opp.id,(p_data->>'learnerPersonId')::uuid,(p_data->>'requestId')::uuid,p_data->>'payloadHash',
   p_data->>'tokenHash',now()+interval '30 days',v_snapshot,p_actor_id,true) returning id into v_id;
  insert into connect.audit_events(tenant_id,actor_membership_id,event_type,entity_type,entity_id,metadata)
  values(p_tenant_id,v_member_id,'portal_offer_accepted','opportunity',v_opp.id,jsonb_build_object('handoffId',v_id));
  return jsonb_build_object('id',v_id,'existing',false,'status','invited');
 end if;
 v_id:=(p_data->>'handoffId')::uuid;
 select * into v_h from connect.portal_admission_handoffs where id=v_id and tenant_id=p_tenant_id for update;
 if not found then raise exception 'Handoff not found' using errcode='22023';end if;
 if p_action='revoke' then
  if v_role not in ('owner','admin','manager') or v_h.status='enrollment_confirmed' then
   raise exception 'Cannot revoke handoff' using errcode='42501';end if;
  update connect.portal_admission_handoffs set status='revoked',updated_at=now() where id=v_h.id;
  return jsonb_build_object('ok',true,'status','revoked');
 elsif p_action='verify' then
  if v_role not in ('owner','admin') or not exists(select 1 from public.profiles p where p.id=p_actor_id and p.role='admin' and p.active)
   or v_h.status<>'review_required' then raise exception 'Dual admin verification required' using errcode='42501';end if;
  if length(btrim(coalesce(p_data->>'evidenceNote','')))<12 then raise exception 'Record verification evidence' using errcode='22023';end if;
  update connect.portal_admission_handoffs set status='onboarding_pending',verified_at=now(),verified_by=p_actor_id,updated_at=now() where id=v_h.id;
  insert into connect.audit_events(tenant_id,actor_membership_id,event_type,entity_type,entity_id,metadata)
  values(p_tenant_id,v_member_id,'portal_guardian_verified','opportunity',v_h.opportunity_id,
   jsonb_build_object('handoffId',v_h.id,'evidenceNote',left(p_data->>'evidenceNote',500)));
  return jsonb_build_object('ok',true,'status','onboarding_pending');
 elsif p_action='reconcile' then
  if v_role not in ('owner','admin','manager') then raise exception 'Manager access required' using errcode='42501';end if;
  if v_h.status='enrollment_confirmed' then return jsonb_build_object('ok',true,'status',v_h.status,'enrollmentId',v_h.portal_enrollment_id);end if;
  if v_h.status<>'onboarding_pending' or v_h.verified_at is null or v_h.onboarding_submission_id is null then
   raise exception 'Guardian mapping or onboarding incomplete' using errcode='22023';end if;
  select * into v_onb from public.onboarding_submissions where id=v_h.onboarding_submission_id and status='active'
   and activated_enrollment_id is not null and activated_student_id is not null and data_consent=true;
  if not found or not exists(select 1 from public.enrollments e where e.id=v_onb.activated_enrollment_id and e.student_id=v_onb.activated_student_id and e.status='active') then
   return jsonb_build_object('ok',true,'status','onboarding_pending');end if;
  update connect.portal_admission_handoffs set status='enrollment_confirmed',portal_enrollment_id=v_onb.activated_enrollment_id,
   portal_student_id=v_onb.activated_student_id,confirmed_at=now(),updated_at=now() where id=v_h.id;
  select o.stage_id into v_old_stage from connect.opportunities o where o.id=v_h.opportunity_id and o.tenant_id=p_tenant_id for update;
  select s.id into v_stage from connect.pipeline_stages s join connect.opportunities o on o.tenant_id=s.tenant_id and o.pipeline_id=s.pipeline_id
   where o.id=v_h.opportunity_id and o.tenant_id=p_tenant_id and s.outcome='won' order by s.sort_order limit 1;
  if v_stage is null then raise exception 'Won stage not configured' using errcode='22023';end if;
  if v_old_stage is distinct from v_stage then
   update connect.opportunities set stage_id=v_stage,closed_at=now(),version=version+1,updated_at=now() where id=v_h.opportunity_id and tenant_id=p_tenant_id;
   insert into connect.stage_events(tenant_id,opportunity_id,pipeline_id,from_stage_id,to_stage_id,changed_by_membership_id,note)
   select p_tenant_id,v_h.opportunity_id,o.pipeline_id,v_old_stage,v_stage,v_member_id,'Portal enrollment confirmed'
   from connect.opportunities o where o.tenant_id=p_tenant_id and o.id=v_h.opportunity_id;
  end if;
  return jsonb_build_object('ok',true,'status','enrollment_confirmed','enrollmentId',v_onb.activated_enrollment_id);
 end if;
 raise exception 'Unknown admission action' using errcode='22023';
end $fn$;
revoke all on function public.connect_portal_admissions(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.connect_portal_admissions(uuid,uuid,text,jsonb) to service_role;
