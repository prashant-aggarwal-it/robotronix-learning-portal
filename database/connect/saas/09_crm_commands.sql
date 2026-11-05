-- Connect Phase 2B: restricted transactional CRM commands for institute workspaces.
-- All CRM tables remain private in connect schema. Only service_role can call RPC.
begin;
create or replace function public.connect_crm_write(
 p_actor_id uuid,p_tenant_id uuid,p_action text,p_data jsonb
) returns jsonb language plpgsql volatile security invoker set search_path=''
as $fn$
declare v_member uuid;v_role text;v_id uuid;v_extra uuid;v_old uuid;v_pipeline uuid;v_stage uuid;v_version int;
 v_result jsonb;v_name text;v_kind text;v_source text;v_token text;
begin
 select m.id,m.role into v_member,v_role
 from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active' and t.status in ('trial','active');
 if v_member is null or v_role='viewer' then
  raise exception 'Workspace write access denied' using errcode='42501';end if;
 if p_data is null or jsonb_typeof(p_data)<>'object'
 then raise exception 'An object payload is required' using errcode='22023';end if;
 if p_action in ('create_program','create_pipeline','bootstrap_pipeline','add_stage') and v_role not in ('owner','admin','manager') then
  raise exception 'Management role required' using errcode='42501';end if;

 case p_action
 when 'capture_lead' then
  -- Single transaction: either contact, contact details, inquiry and optional opportunity all exist, or none do.
  v_name:=nullif(btrim(p_data->>'name'),'');
  v_source:=nullif(btrim(p_data->>'source'),'');
  if v_name is null or length(v_name)>150 or v_source is null or length(v_source)>80 then
   raise exception 'Name and enquiry source are required' using errcode='22023';end if;
  v_id:=nullif(p_data->>'personId','')::uuid;
  if v_id is null then
   insert into connect.people(tenant_id,full_name) values(p_tenant_id,v_name) returning id into v_id;
   insert into connect.person_roles(tenant_id,person_id,role) values(p_tenant_id,v_id,'contact');
   if nullif(btrim(p_data->>'email'),'') is not null then
    v_token:=lower(btrim(p_data->>'email'));
    if length(v_token)>254 or position('@' in v_token)<2 then
     raise exception 'Invalid email address' using errcode='22023';end if;
    insert into connect.contact_methods(tenant_id,person_id,kind,normalized_value,display_value,is_primary)
    values(p_tenant_id,v_id,'email',v_token,v_token,true);
   end if;
   if nullif(btrim(p_data->>'phone'),'') is not null then
    v_token:=btrim(p_data->>'phone');
    if length(v_token)>35 then raise exception 'Invalid phone' using errcode='22023';end if;
    insert into connect.contact_methods(tenant_id,person_id,kind,normalized_value,display_value,is_primary)
    values(p_tenant_id,v_id,'mobile',v_token,v_token,true);
   end if;
  elsif not exists(select 1 from connect.people where tenant_id=p_tenant_id and id=v_id and status='active') then
   raise exception 'Contact not found' using errcode='42501';
  end if;
  v_extra:=null;
  if nullif(p_data->>'pipelineId','') is not null then
   v_pipeline:=(p_data->>'pipelineId')::uuid;v_stage:=(p_data->>'stageId')::uuid;
   if not exists(select 1 from connect.pipeline_stages where tenant_id=p_tenant_id
       and pipeline_id=v_pipeline and id=v_stage and outcome='open')
   then raise exception 'Choose an open admissions stage' using errcode='22023';end if;
   insert into connect.opportunities(tenant_id,pipeline_id,stage_id,title,contact_id)
   values(p_tenant_id,v_pipeline,v_stage,
    coalesce(nullif(btrim(p_data->>'title'),''),v_name||' — enquiry'),v_id)
   returning id into v_extra;
   insert into connect.stage_events(tenant_id,opportunity_id,pipeline_id,to_stage_id,changed_by_membership_id,note)
   values(p_tenant_id,v_extra,v_pipeline,v_stage,v_member,'Created from enquiry');
  end if;
  insert into connect.inquiries(tenant_id,person_id,opportunity_id,source,summary)
  values(p_tenant_id,v_id,v_extra,v_source,left(p_data->>'summary',2000))
  returning id into v_old;
  insert into connect.audit_events(tenant_id,actor_membership_id,event_type,entity_type,entity_id,metadata)
  values(p_tenant_id,v_member,'capture_lead','inquiry',v_old,jsonb_build_object('personId',v_id,'opportunityId',v_extra));
  return jsonb_build_object('ok',true,'id',v_old,'personId',v_id,'opportunityId',v_extra);
 when 'create_contact' then
  v_name:=nullif(btrim(p_data->>'name'),'');
  if v_name is null or length(v_name)>150 then raise exception 'Invalid contact name' using errcode='22023';end if;
  insert into connect.people(tenant_id,full_name) values(p_tenant_id,v_name) returning id into v_id;
  insert into connect.person_roles(tenant_id,person_id,role)
   values(p_tenant_id,v_id,coalesce(nullif(p_data->>'role',''),'contact'));
  if nullif(btrim(p_data->>'email'),'') is not null then
   v_token:=lower(btrim(p_data->>'email'));
   if length(v_token)>254 or position('@' in v_token)<2 then raise exception 'Invalid contact email' using errcode='22023';end if;
   insert into connect.contact_methods(tenant_id,person_id,kind,normalized_value,display_value,is_primary)
   values(p_tenant_id,v_id,'email',v_token,v_token,true);
  end if;
  if nullif(btrim(p_data->>'phone'),'') is not null then
   v_token:=btrim(p_data->>'phone');
   if length(v_token)>35 then raise exception 'Invalid contact phone' using errcode='22023';end if;
   insert into connect.contact_methods(tenant_id,person_id,kind,normalized_value,display_value,is_primary)
   values(p_tenant_id,v_id,'mobile',v_token,v_token,true);
  end if;
 when 'create_person' then
  v_name:=nullif(btrim(p_data->>'name'),'');
  if v_name is null or length(v_name)>150 then raise exception 'Invalid contact name' using errcode='22023';end if;
  insert into connect.people(tenant_id,full_name) values(p_tenant_id,v_name) returning id into v_id;
  if p_data ? 'role' then
   insert into connect.person_roles(tenant_id,person_id,role)
   values(p_tenant_id,v_id,p_data->>'role');
  end if;
 when 'update_person' then
  v_id:=(p_data->>'personId')::uuid;
  v_name:=nullif(btrim(p_data->>'name'),'');
  if v_name is null or length(v_name)>150 then raise exception 'Invalid contact name' using errcode='22023';end if;
  update connect.people set full_name=v_name,updated_at=now()
  where tenant_id=p_tenant_id and id=v_id and status='active';
  if not found then raise exception 'Contact not found' using errcode='42501';end if;
 when 'add_person_role' then
  v_id:=(p_data->>'personId')::uuid;
  insert into connect.person_roles(tenant_id,person_id,role)
   values(p_tenant_id,v_id,p_data->>'role') on conflict do nothing;
 when 'add_contact_method' then
  v_extra:=(p_data->>'personId')::uuid;
  v_token:=nullif(btrim(p_data->>'value'),'');
  if v_token is null or length(v_token)>254 then raise exception 'Invalid contact value' using errcode='22023';end if;
  if (p_data->>'kind')='email' then v_token:=lower(v_token);end if;
  insert into connect.contact_methods(tenant_id,person_id,kind,normalized_value,display_value,is_primary)
  values(p_tenant_id,v_extra,p_data->>'kind',v_token,v_token,coalesce((p_data->>'primary')::boolean,false))
  returning id into v_id;
 when 'create_household' then
  v_name:=nullif(btrim(p_data->>'name'),'');
  if length(coalesce(v_name,''))>150 then raise exception 'Invalid household name' using errcode='22023';end if;
  insert into connect.households(tenant_id,display_name) values(p_tenant_id,v_name) returning id into v_id;
 when 'link_household_member' then
  v_id:=(p_data->>'householdId')::uuid;
  insert into connect.household_members(tenant_id,household_id,person_id,relation,is_primary_contact)
  values(p_tenant_id,v_id,(p_data->>'personId')::uuid,p_data->>'relation',
    coalesce((p_data->>'primary')::boolean,false));
 when 'link_people' then
  v_id:=(p_data->>'personId')::uuid;
  insert into connect.person_relations(tenant_id,from_person_id,to_person_id,relationship)
  values(p_tenant_id,v_id,(p_data->>'relatedPersonId')::uuid,p_data->>'relationship');
 when 'create_organization' then
  v_name:=nullif(btrim(p_data->>'name'),'');
  if v_name is null or length(v_name)>180 then raise exception 'Invalid organization name' using errcode='22023';end if;
  insert into connect.organizations(tenant_id,name,category)
  values(p_tenant_id,v_name,coalesce(nullif(p_data->>'category',''),'other')) returning id into v_id;
 when 'link_organization_contact' then
  v_id:=(p_data->>'organizationId')::uuid;
  insert into connect.organization_contacts(tenant_id,organization_id,person_id,position_title)
  values(p_tenant_id,v_id,(p_data->>'personId')::uuid,p_data->>'position');
 when 'create_program' then
  v_name:=nullif(btrim(p_data->>'name'),'');
  if v_name is null or length(v_name)>180 then raise exception 'Invalid programme name' using errcode='22023';end if;
  insert into connect.programs(tenant_id,name,code)
  values(p_tenant_id,v_name,nullif(btrim(p_data->>'code'),'')) returning id into v_id;
 when 'bootstrap_pipeline' then
  v_name:=nullif(btrim(p_data->>'name'),'');
  if v_name is null or length(v_name)>150 then raise exception 'Invalid pipeline name' using errcode='22023';end if;
  insert into connect.pipelines(tenant_id,name,kind) values(p_tenant_id,v_name,'admissions') returning id into v_id;
  insert into connect.pipeline_stages(tenant_id,pipeline_id,name,sort_order,outcome)
  values
   (p_tenant_id,v_id,'New',0,'open'),
   (p_tenant_id,v_id,'Contacted',1,'open'),
   (p_tenant_id,v_id,'Trial / Counselling',2,'open'),
   (p_tenant_id,v_id,'Won',3,'won'),
   (p_tenant_id,v_id,'Lost',4,'lost');
 when 'create_pipeline' then
  v_name:=nullif(btrim(p_data->>'name'),'');
  if v_name is null or length(v_name)>150 then raise exception 'Invalid pipeline name' using errcode='22023';end if;
  insert into connect.pipelines(tenant_id,name,kind)
  values(p_tenant_id,v_name,coalesce(nullif(p_data->>'kind',''),'admissions')) returning id into v_id;
 when 'add_stage' then
  v_pipeline:=(p_data->>'pipelineId')::uuid;
  v_name:=nullif(btrim(p_data->>'name'),'');
  if v_name is null or length(v_name)>120 or (p_data->>'order')::int<0 then
   raise exception 'Invalid pipeline stage' using errcode='22023';end if;
  insert into connect.pipeline_stages(tenant_id,pipeline_id,name,sort_order,outcome)
  values(p_tenant_id,v_pipeline,v_name,(p_data->>'order')::int,
    coalesce(nullif(p_data->>'outcome',''),'open')) returning id into v_id;
 when 'create_opportunity' then
  v_name:=nullif(btrim(p_data->>'title'),'');
  if v_name is null or length(v_name)>200 then raise exception 'Invalid opportunity title' using errcode='22023';end if;
  v_pipeline:=(p_data->>'pipelineId')::uuid;v_stage:=(p_data->>'stageId')::uuid;
  if p_data->>'ownerMemberId' is not null and not exists(
   select 1 from connect.memberships where tenant_id=p_tenant_id
   and id=(p_data->>'ownerMemberId')::uuid and status='active'
  ) then raise exception 'Assignee must be an active member' using errcode='42501';end if;
  if not exists (
   select 1 from connect.pipeline_stages
   where tenant_id=p_tenant_id and pipeline_id=v_pipeline and id=v_stage and outcome='open'
  ) then raise exception 'New opportunities must begin at an open stage' using errcode='22023';end if;
  insert into connect.opportunities(tenant_id,pipeline_id,stage_id,title,contact_id,organization_id,owner_membership_id,expected_value)
  values(p_tenant_id,v_pipeline,v_stage,v_name,
    nullif(p_data->>'contactId','')::uuid,nullif(p_data->>'organizationId','')::uuid,
    nullif(p_data->>'ownerMemberId','')::uuid,nullif(p_data->>'value','')::numeric)
  returning id into v_id;
  insert into connect.stage_events(tenant_id,opportunity_id,pipeline_id,to_stage_id,changed_by_membership_id,note)
  values(p_tenant_id,v_id,v_pipeline,v_stage,v_member,'Created');
 when 'link_opportunity_person' then
  v_id:=(p_data->>'opportunityId')::uuid;
  insert into connect.opportunity_people(tenant_id,opportunity_id,person_id,role)
  values(p_tenant_id,v_id,(p_data->>'personId')::uuid,coalesce(nullif(p_data->>'role',''),'learner'));
 when 'link_opportunity_program' then
  v_id:=(p_data->>'opportunityId')::uuid;
  insert into connect.opportunity_programs(tenant_id,opportunity_id,program_id)
  values(p_tenant_id,v_id,(p_data->>'programId')::uuid);
 when 'move_opportunity' then
  v_id:=(p_data->>'opportunityId')::uuid;v_stage:=(p_data->>'stageId')::uuid;
  select pipeline_id,stage_id,version into v_pipeline,v_old,v_version
  from connect.opportunities where tenant_id=p_tenant_id and id=v_id for update;
  if not found then raise exception 'Opportunity not found' using errcode='42501';end if;
  if v_version<>coalesce((p_data->>'version')::int,-1) then
    raise exception 'Opportunity was changed: reload before updating' using errcode='40001';end if;
  if v_stage=v_old then raise exception 'Opportunity already in this stage' using errcode='22023';end if;
  update connect.opportunities o set stage_id=v_stage,version=o.version+1,updated_at=now(),
   closed_at=case when (select outcome from connect.pipeline_stages where tenant_id=p_tenant_id
     and pipeline_id=v_pipeline and id=v_stage) in ('won','lost') then now() else null end
  where o.tenant_id=p_tenant_id and o.id=v_id;
  insert into connect.stage_events(tenant_id,opportunity_id,pipeline_id,from_stage_id,to_stage_id,changed_by_membership_id,note)
  values(p_tenant_id,v_id,v_pipeline,v_old,v_stage,v_member,left(p_data->>'note',1000));
 when 'assign_opportunity' then
  v_id:=(p_data->>'opportunityId')::uuid;
  v_extra:=(p_data->>'ownerMemberId')::uuid;
  if not exists(select 1 from connect.memberships where tenant_id=p_tenant_id
    and id=v_extra and status='active') then
    raise exception 'Assignee must be an active member' using errcode='42501';end if;
  if v_role not in ('owner','admin','manager') and v_extra<>v_member then
    raise exception 'Only managers may assign leads to other staff' using errcode='42501';end if;
  update connect.opportunities o set owner_membership_id=v_extra,
    version=o.version+1,updated_at=now()
  where o.tenant_id=p_tenant_id and o.id=v_id
    and o.version=(p_data->>'version')::int;
  if not found then raise exception 'Opportunity missing or outdated' using errcode='40001';end if;
 when 'create_inquiry' then
  v_source:=nullif(btrim(p_data->>'source'),'');
  if v_source is null or length(v_source)>80 then raise exception 'Invalid enquiry source' using errcode='22023';end if;
  if (p_data->>'personId') is null and (p_data->>'opportunityId') is null
  then raise exception 'Enquiry needs a contact or opportunity' using errcode='22023';end if;
  insert into connect.inquiries(tenant_id,person_id,opportunity_id,source,summary)
  values(p_tenant_id,nullif(p_data->>'personId','')::uuid,
    nullif(p_data->>'opportunityId','')::uuid,v_source,left(p_data->>'summary',2000))
  returning id into v_id;
 when 'create_task' then
  v_name:=nullif(btrim(p_data->>'title'),'');
  if v_name is null or length(v_name)>250 then raise exception 'Invalid task title' using errcode='22023';end if;
  if p_data->>'assigneeMemberId' is not null and not exists(
   select 1 from connect.memberships where tenant_id=p_tenant_id
    and id=(p_data->>'assigneeMemberId')::uuid and status='active'
  ) then raise exception 'Task assignee must be an active member' using errcode='42501';end if;
  insert into connect.tasks(tenant_id,opportunity_id,person_id,assignee_membership_id,title,due_at)
  values(p_tenant_id,nullif(p_data->>'opportunityId','')::uuid,nullif(p_data->>'personId','')::uuid,
     coalesce(nullif(p_data->>'assigneeMemberId','')::uuid,v_member),v_name,
     nullif(p_data->>'dueAt','')::timestamptz) returning id into v_id;
 when 'update_task' then
  v_id:=(p_data->>'taskId')::uuid;
  v_extra:=nullif(p_data->>'assigneeMemberId','')::uuid;
  if v_extra is not null and not exists(select 1 from connect.memberships where tenant_id=p_tenant_id
    and id=v_extra and status='active') then
    raise exception 'Task assignee must be an active member' using errcode='42501';end if;
  if v_extra is not null and v_extra<>v_member and v_role not in ('owner','admin','manager') then
    raise exception 'Only managers may reassign tasks' using errcode='42501';end if;
  if p_data ? 'status' and p_data->>'status' not in ('open','cancelled') then
    raise exception 'Use complete_task to finish a task' using errcode='22023';end if;
  update connect.tasks t set
    title=case when p_data ? 'title' then nullif(btrim(p_data->>'title'),'') else t.title end,
    due_at=case when p_data ? 'dueAt' then nullif(p_data->>'dueAt','')::timestamptz else t.due_at end,
    assignee_membership_id=coalesce(v_extra,t.assignee_membership_id),
    status=coalesce(p_data->>'status',t.status),
    completed_at=null
  where t.tenant_id=p_tenant_id and t.id=v_id and t.status='open'
    and (t.assignee_membership_id=v_member or v_role in ('owner','admin','manager'));
  if not found then raise exception 'Task unavailable' using errcode='42501';end if;
 when 'complete_task' then
  v_id:=(p_data->>'taskId')::uuid;
  update connect.tasks set status='done',completed_at=now()
  where tenant_id=p_tenant_id and id=v_id and status='open'
    and (assignee_membership_id=v_member or v_role in ('owner','admin','manager'));
  if not found then raise exception 'Task unavailable' using errcode='42501';end if;
 when 'log_activity' then
  v_kind:=p_data->>'kind';
  insert into connect.activities(tenant_id,opportunity_id,person_id,actor_membership_id,kind,summary)
  values(p_tenant_id,nullif(p_data->>'opportunityId','')::uuid,nullif(p_data->>'personId','')::uuid,
  v_member,v_kind,left(p_data->>'summary',3000)) returning id into v_id;
 when 'create_appointment' then
  v_name:=nullif(btrim(p_data->>'title'),'');
  if v_name is null or length(v_name)>250 then raise exception 'Invalid appointment title' using errcode='22023';end if;
  if p_data->>'opportunityId' is null and p_data->>'personId' is null
  then raise exception 'Appointment requires a contact or opportunity' using errcode='22023';end if;
  insert into connect.appointments(tenant_id,opportunity_id,person_id,owner_membership_id,kind,title,starts_at,ends_at)
  values(p_tenant_id,nullif(p_data->>'opportunityId','')::uuid,nullif(p_data->>'personId','')::uuid,
    v_member,coalesce(nullif(p_data->>'kind',''),'counselling'),v_name,
    (p_data->>'startsAt')::timestamptz,(p_data->>'endsAt')::timestamptz)
  returning id into v_id;
 when 'reschedule_appointment' then
  v_id:=(p_data->>'appointmentId')::uuid;
  update connect.appointments a set starts_at=(p_data->>'startsAt')::timestamptz,
    ends_at=(p_data->>'endsAt')::timestamptz
  where a.tenant_id=p_tenant_id and a.id=v_id and a.status='scheduled'
    and (a.owner_membership_id=v_member or v_role in ('owner','admin','manager'));
  if not found then raise exception 'Appointment unavailable' using errcode='42501';end if;
 when 'finish_appointment' then
  v_id:=(p_data->>'appointmentId')::uuid;
  v_kind:=p_data->>'status';
  if v_kind not in ('completed','cancelled','no_show') then
   raise exception 'Invalid appointment outcome' using errcode='22023';end if;
  update connect.appointments set status=v_kind
  where tenant_id=p_tenant_id and id=v_id and status='scheduled'
    and (owner_membership_id=v_member or v_role in ('owner','admin','manager'));
  if not found then raise exception 'Appointment unavailable' using errcode='42501';end if;
 else raise exception 'Unknown CRM action' using errcode='22023';
 end case;
 insert into connect.audit_events(tenant_id,actor_membership_id,event_type,entity_type,entity_id,metadata)
 values(p_tenant_id,v_member,p_action,'crm',v_id,
  jsonb_build_object('action',p_action));
 return jsonb_build_object('ok',true,'id',v_id);
end $fn$;
revoke all on function public.connect_crm_write(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.connect_crm_write(uuid,uuid,text,jsonb) to service_role;
commit;
