-- All Connect data stays in the private connect schema: service-role-only RPC facade.
create or replace function public.connect_portal_demo_bridge(
 p_actor_id uuid,p_tenant_id uuid,p_action text,p_data jsonb default '{}'::jsonb
) returns jsonb language plpgsql security invoker set search_path='' as $fn$
declare v_member record;v_integrated record;v_link record;v_opp record;v_learner record;
 v_guardian record;v_mobile text;v_email text;v_result jsonb;v_id uuid;v_expected int;
begin
 select m.role,m.status into v_member from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active' and t.status in ('active','trial');
 if not found then raise exception 'Workspace access denied' using errcode='42501';end if;
 select i.status,i.installed_by into v_integrated from connect.portal_demo_integrations i where i.tenant_id=p_tenant_id;
 if p_action='context' then
  return jsonb_build_object('role',v_member.role,'installed',v_integrated.status='active','portalActorId',v_integrated.installed_by);
 elsif p_action='install' then
  if v_member.role not in ('owner','admin') or not exists(
   select 1 from public.profiles p where p.id=p_actor_id and p.role='admin' and p.active
  ) then raise exception 'Both application admin permissions required' using errcode='42501';end if;
  if p_data->>'status' not in ('active','disabled') then raise exception 'Invalid status' using errcode='22023';end if;
  insert into connect.portal_demo_integrations(tenant_id,status,installed_by) values(p_tenant_id,p_data->>'status',p_actor_id)
  on conflict(tenant_id) do update set status=excluded.status,installed_by=excluded.installed_by,updated_at=now();
  return jsonb_build_object('ok',true);
 end if;
 if v_integrated.status is distinct from 'active' then raise exception 'Portal connection inactive' using errcode='42501';end if;
 if p_action='list' then
  if v_member.role='viewer' then return jsonb_build_object('items','[]'::jsonb);end if;
  select coalesce(jsonb_agg(to_jsonb(l) order by l.created_at desc),'[]'::jsonb) into v_result
  from (select id,opportunity_id,person_id,portal_session_id,status,version,created_at
   from connect.portal_demo_links where tenant_id=p_tenant_id order by created_at desc limit 100) l;
  return jsonb_build_object('items',v_result);
 end if;
 if v_member.role='viewer' then raise exception 'CRM write access denied' using errcode='42501';end if;
 if p_action='booking_context' then
  select * into v_opp from connect.opportunities where id=(p_data->>'opportunityId')::uuid and tenant_id=p_tenant_id;
  select id,full_name into v_learner from connect.people where id=(p_data->>'learnerPersonId')::uuid and tenant_id=p_tenant_id and status='active';
  if v_opp.id is null or v_learner.id is null or
   (v_opp.contact_id<>v_learner.id and not exists(select 1 from connect.opportunity_people op
    where op.tenant_id=p_tenant_id and op.opportunity_id=v_opp.id and op.person_id=v_learner.id))
  then raise exception 'Learner not linked to admission' using errcode='22023';end if;
  if v_opp.contact_id is null then raise exception 'Guardian contact required' using errcode='22023';end if;
  select id,full_name into v_guardian from connect.people where id=v_opp.contact_id and tenant_id=p_tenant_id and status='active';
  if v_guardian.id is null then raise exception 'Guardian not found' using errcode='22023';end if;
  select cm.display_value into v_mobile from connect.contact_methods cm where cm.tenant_id=p_tenant_id and cm.person_id=v_guardian.id
   and cm.kind in ('whatsapp','mobile','phone') order by case cm.kind when 'whatsapp' then 0 when 'mobile' then 1 else 2 end,cm.is_primary desc limit 1;
  select cm.display_value into v_email from connect.contact_methods cm where cm.tenant_id=p_tenant_id and cm.person_id=v_guardian.id
   and cm.kind='email' order by cm.is_primary desc limit 1;
  if v_mobile is null then raise exception 'Guardian phone required' using errcode='22023';end if;
  return jsonb_build_object('opportunityTitle',v_opp.title,'guardianName',v_guardian.full_name,'learnerName',v_learner.full_name,
   'guardianMobile',v_mobile,'guardianEmail',v_email);
 elsif p_action='begin' then
  select * into v_link from connect.portal_demo_links where tenant_id=p_tenant_id and request_id=(p_data->>'requestId')::uuid;
  if found then return jsonb_build_object('id',v_link.id,'status',v_link.status,'payloadHash',v_link.payload_hash,
   'sessionId',v_link.portal_session_id,'existing',true);end if;
  insert into connect.portal_demo_links(tenant_id,request_id,payload_hash,opportunity_id,person_id,created_by,status)
  values(p_tenant_id,(p_data->>'requestId')::uuid,p_data->>'payloadHash',(p_data->>'opportunityId')::uuid,
   (p_data->>'learnerPersonId')::uuid,p_actor_id,'provisioning') returning id into v_id;
  return jsonb_build_object('id',v_id,'status','provisioning','existing',false);
 elsif p_action in ('complete','fail','change','detail') then
  select * into v_link from connect.portal_demo_links where tenant_id=p_tenant_id and id=(p_data->>'linkId')::uuid;
  if not found then raise exception 'Demo link missing' using errcode='22023';end if;
  if v_member.role not in ('owner','admin','manager') and v_link.created_by<>p_actor_id then
   raise exception 'Demo access denied' using errcode='42501';end if;
  if p_action='detail' then return to_jsonb(v_link);end if;
  if p_action='complete' then
   if v_link.status<>'provisioning' then raise exception 'Invalid booking state' using errcode='40001';end if;
   update connect.portal_demo_links set portal_session_id=(p_data->>'sessionId')::uuid,
    portal_schedule_event_id=(p_data->>'scheduleEventId')::uuid,
    portal_participant_id=(p_data->>'participantId')::uuid,status='scheduled',updated_at=now() where id=v_link.id;
  elsif p_action='fail' then
   update connect.portal_demo_links set status='failed',failure_code='RECONCILE_REQUIRED',updated_at=now() where id=v_link.id and status='provisioning';
  else
   v_expected:=(p_data->>'version')::int;
   if v_link.version<>v_expected or v_link.status<>'scheduled' then raise exception 'Demo version changed' using errcode='40001';end if;
   if p_data->>'status' not in ('scheduled','cancelled') then raise exception 'Invalid status' using errcode='22023';end if;
   update connect.portal_demo_links set status=p_data->>'status',version=version+1,updated_at=now() where id=v_link.id;
  end if;
  return jsonb_build_object('ok',true);
 end if;
 raise exception 'Unknown Portal bridge command' using errcode='22023';
end $fn$;
revoke all on function public.connect_portal_demo_bridge(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.connect_portal_demo_bridge(uuid,uuid,text,jsonb) to service_role;
