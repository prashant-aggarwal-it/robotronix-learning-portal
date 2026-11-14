-- FINAL core Robotronix Connect CRM function definitions.
-- One canonical definition per currently installed development signature.
-- Requires Connect schema and Supabase Auth; Portal integration is optional.
BEGIN;

-- public.connect_create_workspace(p_actor_id uuid, p_slug text, p_name text)
CREATE OR REPLACE FUNCTION public.connect_create_workspace(p_actor_id uuid, p_slug text, p_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_tenant uuid;
begin
 if p_actor_id is null then raise exception 'Authenticated user required' using errcode='28000';end if;
 if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or p_name is null or length(btrim(p_name)) not between 2 and 120 then
  raise exception 'Invalid workspace details' using errcode='22023';
 end if;
 insert into connect.tenants(slug,name) values(p_slug,btrim(p_name)) returning id into v_tenant;
 insert into connect.memberships(tenant_id,user_id,role,status)
 values(v_tenant,p_actor_id,'owner','active');
 return v_tenant;
end $function$;

-- public.connect_my_workspaces(p_actor_id uuid)
CREATE OR REPLACE FUNCTION public.connect_my_workspaces(p_actor_id uuid)
 RETURNS TABLE(tenant_id uuid, slug text, workspace_name text, tenant_status text, membership_role text)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 select t.id,t.slug,t.name,t.status,m.role
 from connect.memberships m
 join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.status='active' and t.status in ('active','trial')
 order by t.name
$function$;

-- public.connect_workspace_members(p_actor_id uuid, p_tenant_id uuid)
CREATE OR REPLACE FUNCTION public.connect_workspace_members(p_actor_id uuid, p_tenant_id uuid)
 RETURNS TABLE(member_id uuid, member_user_id uuid, member_role text, member_status text, member_created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
begin
 if not exists (
   select 1 from connect.memberships m join connect.tenants t on t.id=m.tenant_id
   where m.tenant_id=p_tenant_id and m.user_id=p_actor_id and m.status='active'
     and m.role in ('owner','admin','manager') and t.status in ('active','trial')
 ) then raise exception 'Workspace access denied' using errcode='42501'; end if;
 return query
 select m.id,m.user_id,m.role,m.status,m.created_at
 from connect.memberships m where m.tenant_id=p_tenant_id order by m.created_at;
end $function$;

-- public.connect_create_invitation(p_actor_id uuid, p_tenant_id uuid, p_email text, p_role text, p_token_sha256 text)
CREATE OR REPLACE FUNCTION public.connect_create_invitation(p_actor_id uuid, p_tenant_id uuid, p_email text, p_role text, p_token_sha256 text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_id uuid;
begin
 if not exists (
  select 1 from connect.memberships m join connect.tenants t on t.id=m.tenant_id
  where m.tenant_id=p_tenant_id and m.user_id=p_actor_id and m.status='active'
  and m.role in ('owner','admin') and t.status in ('active','trial')
 ) then raise exception 'Workspace administration required' using errcode='42501'; end if;
 if p_role not in ('admin','manager','counsellor','viewer')
   or p_email is null or length(p_email)>254 or position('@' in p_email)<2
   or p_token_sha256 is null or p_token_sha256 !~ '^[a-f0-9]{64}$'
 then raise exception 'Invalid invitation' using errcode='22023'; end if;
 -- Existing stale invitations can be explicitly revoked, never silently overwritten.
 insert into connect.invitations(tenant_id,email,role,token_sha256,invited_by,expires_at)
 values(p_tenant_id,lower(btrim(p_email)),p_role,p_token_sha256,p_actor_id,now()+interval '7 days')
 returning id into v_id;
 return v_id;
end $function$;

-- public.connect_accept_invitation(p_actor_id uuid, p_actor_email text, p_token_sha256 text)
CREATE OR REPLACE FUNCTION public.connect_accept_invitation(p_actor_id uuid, p_actor_email text, p_token_sha256 text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_inv connect.invitations%rowtype;v_email text;v_member uuid;
begin
 v_email:=lower(btrim(p_actor_email));
 if p_actor_id is null or v_email is null or v_email='' then
  raise exception 'Sign in to accept invitation' using errcode='28000';
 end if;
 select * into v_inv from connect.invitations where token_sha256=p_token_sha256 for update;
 if not found or v_inv.accepted_at is not null or v_inv.revoked_at is not null or v_inv.expires_at<=now()
   or v_inv.email<>v_email then raise exception 'Invitation invalid or expired' using errcode='42501';end if;
 if not exists(select 1 from connect.tenants where id=v_inv.tenant_id and status in ('active','trial'))
 then raise exception 'Workspace unavailable' using errcode='42501';end if;
 insert into connect.memberships(tenant_id,user_id,role,status)
 values(v_inv.tenant_id,p_actor_id,v_inv.role,'active')
 on conflict(tenant_id,user_id) do update
 set role=excluded.role,status='active'
 where connect.memberships.role<>'owner'
 returning id into v_member;
 if v_member is null then raise exception 'Owner membership cannot be replaced' using errcode='42501';end if;
 update connect.invitations set accepted_at=now() where id=v_inv.id;
 return v_inv.tenant_id;
end $function$;

-- public.connect_revoke_invitation(p_actor_id uuid, p_tenant_id uuid, p_invitation_id uuid)
CREATE OR REPLACE FUNCTION public.connect_revoke_invitation(p_actor_id uuid, p_tenant_id uuid, p_invitation_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if not exists(
  select 1 from connect.memberships m where m.tenant_id=p_tenant_id
   and m.user_id=p_actor_id and m.status='active' and m.role in ('owner','admin')
 ) then raise exception 'Workspace administration required' using errcode='42501';end if;
 update connect.invitations set revoked_at=now()
 where tenant_id=p_tenant_id and id=p_invitation_id
 and accepted_at is null and revoked_at is null;
 return found;
end $function$;

-- public.connect_update_member(p_actor_id uuid, p_tenant_id uuid, p_member_id uuid, p_role text, p_status text)
CREATE OR REPLACE FUNCTION public.connect_update_member(p_actor_id uuid, p_tenant_id uuid, p_member_id uuid, p_role text, p_status text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare actor_role text; target_role text; target_user uuid;
begin
 -- Serialize membership changes within this tenant to protect the final owner.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_tenant_id::text,0));
 select m.role into actor_role from connect.memberships m
 join connect.tenants t on t.id=m.tenant_id
 where m.tenant_id=p_tenant_id and m.user_id=p_actor_id
 and m.status='active' and t.status in ('active','trial');
 if actor_role is null or actor_role not in ('owner','admin') then
  raise exception 'Workspace administrator required' using errcode='42501';
 end if;
 select m.role,m.user_id into target_role,target_user from connect.memberships m
 where m.id=p_member_id and m.tenant_id=p_tenant_id for update;
 if not found then raise exception 'Member not found' using errcode='42501';end if;
 if p_role not in ('owner','admin','manager','counsellor','viewer')
    or p_status not in ('active','disabled') then
  raise exception 'Invalid membership change' using errcode='22023';end if;
 if actor_role='admin' and (
  target_role in ('owner','admin') or p_role in ('owner','admin')
 ) then
  raise exception 'Only owner can manage privileged roles' using errcode='42501';
 end if;
 -- Never remove or downgrade the final active owner.
 if target_role='owner' and (p_role<>'owner' or p_status<>'active')
    and (select count(*) from connect.memberships
         where tenant_id=p_tenant_id and role='owner' and status='active')<=1 then
  raise exception 'A workspace must retain an active owner' using errcode='42501';
 end if;
 update connect.memberships set role=p_role,status=p_status
 where id=p_member_id and tenant_id=p_tenant_id;
 return true;
end $function$;

-- public.connect_crm_write(p_actor_id uuid, p_tenant_id uuid, p_action text, p_data jsonb)
CREATE OR REPLACE FUNCTION public.connect_crm_write(p_actor_id uuid, p_tenant_id uuid, p_action text, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
  if nullif(p_data->>'categoryId','') is not null and not exists(
    select 1 from connect.enquiry_categories where tenant_id=p_tenant_id
    and id=(p_data->>'categoryId')::uuid and active
  ) then raise exception 'Invalid enquiry category' using errcode='22023';end if;
  insert into connect.inquiries(tenant_id,person_id,opportunity_id,source,summary,category_id)
  values(p_tenant_id,v_id,v_extra,v_source,left(p_data->>'summary',2000),nullif(p_data->>'categoryId','')::uuid)
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
end $function$;

-- public.connect_crm_read(p_actor_id uuid, p_tenant_id uuid, p_resource text, p_options jsonb)
CREATE OR REPLACE FUNCTION public.connect_crm_read(p_actor_id uuid, p_tenant_id uuid, p_resource text, p_options jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare v_member uuid;v_limit int;v_offset int;v_search text;v_id uuid;v_result jsonb;
begin
 select m.id into v_member from connect.memberships m
 join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id
   and m.status='active' and t.status in ('active','trial');
 if v_member is null then raise exception 'Workspace read access denied' using errcode='42501';end if;
 v_limit:=least(100,greatest(1,coalesce((p_options->>'limit')::integer,30)));
 v_offset:=least(10000,greatest(0,coalesce((p_options->>'offset')::integer,0)));
 v_search:=left(coalesce(p_options->>'search',''),100);
 v_id:=nullif(p_options->>'id','')::uuid;
 case p_resource
 when 'overview' then
  select jsonb_build_array(jsonb_build_object(
   'newEnquiries',(select count(*) from connect.inquiries where tenant_id=p_tenant_id and received_at>=date_trunc('day',now(),(select t.timezone from connect.tenants t where t.id=p_tenant_id))),
   'totalEnquiries',(select count(*) from connect.inquiries where tenant_id=p_tenant_id),
   'openOpportunities',(select count(*) from connect.opportunities o join connect.pipeline_stages st on st.tenant_id=o.tenant_id and st.id=o.stage_id where o.tenant_id=p_tenant_id and st.outcome='open'),
   'wonOpportunities',(select count(*) from connect.opportunities o join connect.pipeline_stages st on st.tenant_id=o.tenant_id and st.id=o.stage_id where o.tenant_id=p_tenant_id and st.outcome='won'),
   'overdueTasks',(select count(*) from connect.tasks where tenant_id=p_tenant_id and status='open' and due_at<now()),
   'openTasks',(select count(*) from connect.tasks where tenant_id=p_tenant_id and status='open'),
   'scheduledAppointments',(select count(*) from connect.appointments where tenant_id=p_tenant_id and status='scheduled' and starts_at>=now())
  )) into v_result;
 when 'people' then
  select coalesce(jsonb_agg(to_jsonb(q) order by q.full_name,q.id),'[]'::jsonb) into v_result
  from (select p.id,p.full_name,p.status,p.created_at,
   (select coalesce(jsonb_agg(jsonb_build_object('kind',cm.kind,'value',cm.display_value,'primary',cm.is_primary)),'[]'::jsonb)
    from connect.contact_methods cm where cm.tenant_id=p_tenant_id and cm.person_id=p.id) as contact_methods,
   (select coalesce(jsonb_agg(pr.role),'[]'::jsonb) from connect.person_roles pr
    where pr.tenant_id=p_tenant_id and pr.person_id=p.id) as roles
   from connect.people p where p.tenant_id=p_tenant_id and p.status='active'
     and (v_id is null or p.id=v_id) and (v_search='' or p.full_name ilike '%'||v_search||'%')
   order by p.full_name,p.id limit v_limit offset v_offset) q;
 when 'contact_matches' then
  -- Candidate lookup only. Shared family contact details need deliberate operator review, not auto-merge.
  select coalesce(jsonb_agg(to_jsonb(q) order by q.full_name),'[]'::jsonb) into v_result
  from (select distinct p.id,p.full_name,c.kind,c.display_value
   from connect.contact_methods c join connect.people p on p.tenant_id=c.tenant_id and p.id=c.person_id
   where c.tenant_id=p_tenant_id and c.normalized_value=v_search and p.status='active'
   order by p.full_name,p.id,c.kind,c.display_value limit v_limit offset v_offset) q;
 when 'households' then
  select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc),'[]'::jsonb) into v_result
  from (select h.id,h.display_name,h.created_at,
    (select coalesce(jsonb_agg(jsonb_build_object('personId',hm.person_id,'relation',hm.relation,'primary',hm.is_primary_contact)),'[]'::jsonb)
    from connect.household_members hm where hm.tenant_id=p_tenant_id and hm.household_id=h.id) as members
   from connect.households h where h.tenant_id=p_tenant_id and (v_id is null or h.id=v_id)
   order by h.created_at desc,h.id limit v_limit offset v_offset) q;
 when 'organizations' then
  select coalesce(jsonb_agg(to_jsonb(q) order by q.name),'[]'::jsonb) into v_result
  from (select id,name,category,created_at from connect.organizations
    where tenant_id=p_tenant_id and (v_id is null or id=v_id)
    order by name,id limit v_limit offset v_offset) q;
 when 'programs' then
  select coalesce(jsonb_agg(to_jsonb(q) order by q.name),'[]'::jsonb) into v_result
  from (select id,name,code,active from connect.programs where tenant_id=p_tenant_id
   order by name,id limit v_limit offset v_offset) q;
 when 'pipelines' then
  select coalesce(jsonb_agg(to_jsonb(q) order by q.name),'[]'::jsonb) into v_result
  from (select p.id,p.name,p.kind,p.active,
    (select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'order',s.sort_order,'outcome',s.outcome) order by s.sort_order),'[]'::jsonb)
    from connect.pipeline_stages s where s.tenant_id=p_tenant_id and s.pipeline_id=p.id) as stages
   from connect.pipelines p where p.tenant_id=p_tenant_id order by p.name,p.id limit v_limit offset v_offset) q;
 when 'opportunities' then
  select coalesce(jsonb_agg(to_jsonb(q) order by q.updated_at desc),'[]'::jsonb) into v_result
  from (select o.id,o.title,o.contact_id,o.organization_id,o.pipeline_id,o.stage_id,o.owner_membership_id,
   o.expected_value,o.currency,o.closed_at,o.version,o.updated_at,s.name as stage_name,s.outcome
   from connect.opportunities o
   join connect.pipeline_stages s on s.tenant_id=o.tenant_id and s.id=o.stage_id
   where o.tenant_id=p_tenant_id and (v_id is null or o.id=v_id)
     and (v_search='' or o.title ilike '%'||v_search||'%')
   order by o.updated_at desc,o.id limit v_limit offset v_offset) q;
 when 'inquiries' then
  select coalesce(jsonb_agg(to_jsonb(q) order by q.received_at desc),'[]'::jsonb) into v_result
  from (select i.id,i.person_id,i.opportunity_id,i.source,i.summary,i.received_at,i.category_id,ec.label as category_label,
    p.full_name as contact_name,
    (select cm.display_value from connect.contact_methods cm
     where cm.tenant_id=i.tenant_id and cm.person_id=i.person_id
     order by cm.is_primary desc,cm.created_at limit 1) as contact_detail,
    o.title as opportunity_title,o.stage_id,s.name as stage_name,s.outcome
    from connect.inquiries i
    left join connect.enquiry_categories ec on ec.tenant_id=i.tenant_id and ec.id=i.category_id
    left join connect.people p on p.tenant_id=i.tenant_id and p.id=i.person_id
    left join connect.opportunities o on o.tenant_id=i.tenant_id and o.id=i.opportunity_id
    left join connect.pipeline_stages s on s.tenant_id=i.tenant_id and s.id=o.stage_id
    where i.tenant_id=p_tenant_id and (v_id is null or i.id=v_id)
    and (v_search='' or p.full_name ilike '%'||v_search||'%' or i.summary ilike '%'||v_search||'%')
    order by i.received_at desc,i.id limit v_limit offset v_offset) q;
 when 'tasks' then
  select coalesce(jsonb_agg(to_jsonb(q) order by q.due_at nulls last),'[]'::jsonb) into v_result
  from (select id,title,status,person_id,opportunity_id,assignee_membership_id,due_at,completed_at,created_at
    from connect.tasks where tenant_id=p_tenant_id and (v_id is null or id=v_id)
    order by due_at nulls last,id limit v_limit offset v_offset) q;
 when 'activities' then
  select coalesce(jsonb_agg(to_jsonb(q) order by q.occurred_at desc),'[]'::jsonb) into v_result
  from (select id,opportunity_id,person_id,actor_membership_id,kind,summary,occurred_at
   from connect.activities where tenant_id=p_tenant_id and (v_id is null or id=v_id)
   order by occurred_at desc,id limit v_limit offset v_offset) q;
 when 'appointments' then
  select coalesce(jsonb_agg(to_jsonb(q) order by q.starts_at),'[]'::jsonb) into v_result
  from (select id,title,kind,status,person_id,opportunity_id,owner_membership_id,starts_at,ends_at
   from connect.appointments where tenant_id=p_tenant_id and (v_id is null or id=v_id)
   order by starts_at,id limit v_limit offset v_offset) q;
 when 'timeline' then
  if v_id is null then raise exception 'Timeline requires an opportunity or contact ID' using errcode='22023';end if;
  select coalesce(jsonb_agg(to_jsonb(q) order by q.event_time desc),'[]'::jsonb) into v_result
  from (
   select 'activity'::text as type,a.id,a.kind as title,a.summary,a.occurred_at as event_time
   from connect.activities a where a.tenant_id=p_tenant_id and (a.person_id=v_id or a.opportunity_id=v_id)
   union all
   select 'stage',e.id,'stage_change',e.note,e.changed_at
   from connect.stage_events e where e.tenant_id=p_tenant_id and e.opportunity_id=v_id
   order by event_time desc limit v_limit offset v_offset
  ) q;
 else raise exception 'Unknown CRM resource' using errcode='22023';
 end case;
 return jsonb_build_object('items',v_result,'limit',v_limit,'offset',v_offset);
end $function$;

-- public.connect_register_channel(p_actor_id uuid, p_tenant_id uuid, p_provider text, p_external_id text, p_label text)
CREATE OR REPLACE FUNCTION public.connect_register_channel(p_actor_id uuid, p_tenant_id uuid, p_provider text, p_external_id text, p_label text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_id uuid;v_role text;
begin
 select m.role into v_role from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active'
 and t.status in ('trial','active');
 if v_role not in ('owner','admin') or v_role is null then raise exception 'Channel administration required' using errcode='42501';end if;
 if p_provider not in ('whatsapp','meta_leads','email','website','instagram','facebook')
 or length(btrim(coalesce(p_external_id,''))) not between 4 and 200
 or length(btrim(coalesce(p_label,''))) not between 2 and 100 then
  raise exception 'Invalid channel registration' using errcode='22023';end if;
 insert into connect.channel_accounts(tenant_id,provider,external_account_id,display_name,status)
 values(p_tenant_id,p_provider,lower(btrim(p_external_id)),btrim(p_label),'inactive') returning id into v_id;
 return v_id;
end $function$;

-- public.connect_set_channel_status(p_actor_id uuid, p_tenant_id uuid, p_channel_id uuid, p_status text)
CREATE OR REPLACE FUNCTION public.connect_set_channel_status(p_actor_id uuid, p_tenant_id uuid, p_channel_id uuid, p_status text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if not exists(select 1 from connect.memberships m join connect.tenants t on t.id=m.tenant_id
  where m.tenant_id=p_tenant_id and m.user_id=p_actor_id and m.status='active'
  and m.role in ('owner','admin') and t.status in ('active','trial'))
 then raise exception 'Channel administration required' using errcode='42501';end if;
 if p_status not in ('active','inactive','disabled') then
  raise exception 'Invalid channel status' using errcode='22023';end if;
 update connect.channel_accounts set status=p_status
 where id=p_channel_id and tenant_id=p_tenant_id;
 if not found then raise exception 'Channel not found' using errcode='42501';end if;
 return true;
end $function$;

-- public.connect_list_channels(p_actor_id uuid, p_tenant_id uuid)
CREATE OR REPLACE FUNCTION public.connect_list_channels(p_actor_id uuid, p_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare v_result jsonb;
begin
 if not exists(select 1 from connect.memberships m join connect.tenants t on t.id=m.tenant_id
  where m.tenant_id=p_tenant_id and m.user_id=p_actor_id and m.status='active'
  and m.role in ('owner','admin','manager') and t.status in ('active','trial'))
 then raise exception 'Channel administration required' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',c.id,'provider',c.provider,'externalId',c.external_account_id,
  'name',c.display_name,'status',c.status) order by c.provider,c.display_name),'[]'::jsonb)
 into v_result from connect.channel_accounts c where c.tenant_id=p_tenant_id;
 return v_result;
end $function$;

-- public.connect_create_form_key(p_actor_id uuid, p_tenant_id uuid, p_channel_id uuid, p_token_hash text, p_label text)
CREATE OR REPLACE FUNCTION public.connect_create_form_key(p_actor_id uuid, p_tenant_id uuid, p_channel_id uuid, p_token_hash text, p_label text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_id uuid;
begin
 if not exists(select 1 from connect.memberships m join connect.tenants t on t.id=m.tenant_id
  where m.tenant_id=p_tenant_id and m.user_id=p_actor_id and m.status='active'
   and m.role in ('owner','admin') and t.status in ('active','trial'))
 then raise exception 'Channel administration required' using errcode='42501';end if;
 if p_token_hash !~ '^[a-f0-9]{64}$' or length(btrim(coalesce(p_label,''))) not between 2 and 100 then
  raise exception 'Invalid form key' using errcode='22023';end if;
 if not exists(select 1 from connect.channel_accounts where id=p_channel_id and tenant_id=p_tenant_id and provider='website')
 then raise exception 'Website channel required' using errcode='42501';end if;
 insert into connect.form_keys(tenant_id,channel_account_id,token_sha256,label)
 values(p_tenant_id,p_channel_id,p_token_hash,btrim(p_label)) returning id into v_id;
 return v_id;
end $function$;

-- public.connect_list_form_keys(p_actor_id uuid, p_tenant_id uuid)
CREATE OR REPLACE FUNCTION public.connect_list_form_keys(p_actor_id uuid, p_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare v_result jsonb;
begin
 if not exists(select 1 from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id
 and m.status='active' and m.role in ('owner','admin') and t.status in ('active','trial'))
 then raise exception 'Form administration required' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',k.id,'channelId',k.channel_account_id,'label',k.label,
  'active',k.active,'createdAt',k.created_at) order by k.created_at desc),'[]'::jsonb)
 into v_result from connect.form_keys k where k.tenant_id=p_tenant_id;
 return v_result;
end $function$;

-- public.connect_disable_form_key(p_actor_id uuid, p_tenant_id uuid, p_key_id uuid)
CREATE OR REPLACE FUNCTION public.connect_disable_form_key(p_actor_id uuid, p_tenant_id uuid, p_key_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if not exists(select 1 from connect.memberships where tenant_id=p_tenant_id
  and user_id=p_actor_id and role in ('owner','admin') and status='active')
 then raise exception 'Channel administration required' using errcode='42501';end if;
 update connect.form_keys set active=false where id=p_key_id and tenant_id=p_tenant_id and active;
 return found;
end $function$;

-- connect.ingest_event(p_account_id uuid, p_event_id text, p_name text, p_email text, p_phone text, p_source text, p_summary text)
CREATE OR REPLACE FUNCTION connect.ingest_event(p_account_id uuid, p_event_id text, p_name text, p_email text, p_phone text, p_source text, p_summary text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_account connect.channel_accounts%rowtype;v_person uuid;v_inquiry uuid;v_opp uuid;
 v_pipeline uuid;v_stage uuid;v_email text;v_phone text;v_name text;v_receipt uuid;v_conversation uuid;
begin
 select * into v_account from connect.channel_accounts c
  where c.id=p_account_id and c.status='active' for share;
 if not found then raise exception 'Inactive or unknown channel' using errcode='42501';end if;
 if not exists(select 1 from connect.tenants where id=v_account.tenant_id and status in ('trial','active'))
 then raise exception 'Workspace unavailable' using errcode='42501';end if;
 if p_event_id is null or length(p_event_id) not between 3 and 250
    or p_source is null or length(p_source) not between 2 and 80
 then raise exception 'Invalid event identity' using errcode='22023';end if;
 v_name:=nullif(btrim(coalesce(p_name,'')),'');
 v_email:=nullif(lower(btrim(coalesce(p_email,''))),'');
 v_phone:=nullif(regexp_replace(coalesce(p_phone,''),'[^0-9+]','','g'),'');
 if v_name is null then v_name:='Unknown contact';end if;
 if length(v_name)>150 or length(coalesce(v_email,''))>254
    or (v_email is not null and v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
    or length(coalesce(v_phone,''))>35 or length(coalesce(p_summary,''))>3000
    or (v_email is null and v_phone is null)
 then raise exception 'Invalid lead details' using errcode='22023';end if;

 -- A duplicate provider delivery must be a no-op, including concurrent retries.
 insert into connect.webhook_receipts(
  tenant_id,channel_account_id,external_event_id,event_type,payload,status,attempts)
 values(v_account.tenant_id,v_account.id,p_event_id,'lead_ingest',
    jsonb_build_object('source',p_source), 'pending',1)
 on conflict(tenant_id,channel_account_id,external_event_id) do nothing
 returning id into v_receipt;
 if v_receipt is null then return jsonb_build_object('ok',true,'duplicate',true);end if;

 -- Serialize matching lead contact identity within a tenant; no cross-institute sharing.
 perform pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(v_account.tenant_id::text||':'||coalesce(v_email,v_phone),0));
 if v_email is not null then
  select c.person_id into v_person from connect.contact_methods c
  join connect.people p on p.tenant_id=c.tenant_id and p.id=c.person_id and p.status='active'
  where c.tenant_id=v_account.tenant_id and c.kind='email' and c.normalized_value=v_email
  order by c.created_at,c.id limit 1;
 end if;
 if v_person is null and v_phone is not null then
  select c.person_id into v_person from connect.contact_methods c
  join connect.people p on p.tenant_id=c.tenant_id and p.id=c.person_id and p.status='active'
  where c.tenant_id=v_account.tenant_id and c.kind in ('mobile','phone','whatsapp')
   and c.normalized_value=v_phone
  order by c.created_at,c.id limit 1;
 end if;
 if v_person is null then
  insert into connect.people(tenant_id,full_name) values(v_account.tenant_id,v_name)
    returning id into v_person;
  insert into connect.person_roles(tenant_id,person_id,role)
    values(v_account.tenant_id,v_person,'contact');
 end if;
 if v_email is not null and not exists(
   select 1 from connect.contact_methods where tenant_id=v_account.tenant_id
   and person_id=v_person and kind='email' and normalized_value=v_email
 ) then
  insert into connect.contact_methods(tenant_id,person_id,kind,normalized_value,display_value,is_primary)
   values(v_account.tenant_id,v_person,'email',v_email,v_email,
    not exists(select 1 from connect.contact_methods where tenant_id=v_account.tenant_id
      and person_id=v_person and kind='email'));
 end if;
 if v_phone is not null and not exists(
   select 1 from connect.contact_methods where tenant_id=v_account.tenant_id
   and person_id=v_person and kind='mobile' and normalized_value=v_phone
 ) then
  insert into connect.contact_methods(tenant_id,person_id,kind,normalized_value,display_value,is_primary)
   values(v_account.tenant_id,v_person,'mobile',v_phone,v_phone,
    not exists(select 1 from connect.contact_methods where tenant_id=v_account.tenant_id
      and person_id=v_person and kind='mobile'));
 end if;

 -- Intake-first policy: a message from a trainer, supplier or collaborator is not an admission.
 -- Review/classify the enquiry before opening any pipeline opportunity.
 -- Deliberately do not create or reuse an admissions deal during channel ingestion.
 if v_account.provider in ('whatsapp','email') then
  insert into connect.conversations(tenant_id,channel_account_id,person_id,external_thread_id)
  values(v_account.tenant_id,v_account.id,v_person,v_person::text)
  on conflict(tenant_id,channel_account_id,external_thread_id) where external_thread_id is not null
    do update set person_id=excluded.person_id
  returning id into v_conversation;
  insert into connect.messages(tenant_id,conversation_id,external_message_id,direction,body)
  values(v_account.tenant_id,v_conversation,p_event_id,'inbound',left(p_summary,2000))
  on conflict(tenant_id,conversation_id,external_message_id) where external_message_id is not null do nothing;
 end if;
 insert into connect.inquiries(tenant_id,person_id,opportunity_id,
  channel_account_id,external_event_id,source,summary)
 values(v_account.tenant_id,v_person,v_opp,v_account.id,p_event_id,p_source,left(p_summary,2000))
 returning id into v_inquiry;
 update connect.webhook_receipts set status='processed',processed_at=now()
 where id=v_receipt;
 insert into connect.audit_events(tenant_id,event_type,entity_type,entity_id,metadata)
 values(v_account.tenant_id,'external_lead_ingested','inquiry',v_inquiry,
  jsonb_build_object('provider',v_account.provider,'channelAccountId',v_account.id));
 return jsonb_build_object('ok',true,'duplicate',false,'inquiryId',v_inquiry,'personId',v_person,'opportunityId',v_opp);
end $function$;

-- public.connect_ingest_channel(p_provider text, p_external_account_id text, p_event_id text, p_name text, p_email text, p_phone text, p_summary text)
CREATE OR REPLACE FUNCTION public.connect_ingest_channel(p_provider text, p_external_account_id text, p_event_id text, p_name text, p_email text, p_phone text, p_summary text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_id uuid;
begin
 if p_provider='whatsapp' then
  return public.connect_ingest_whatsapp_message(p_external_account_id,p_event_id,p_phone,
   p_name,'text',p_summary);
 end if;
 select c.id into v_id from connect.channel_accounts c
 where c.provider=p_provider and c.external_account_id=lower(btrim(p_external_account_id))
 and c.status='active';
 if v_id is null then raise exception 'Unregistered channel' using errcode='42501';end if;
 return connect.ingest_event(v_id,p_event_id,p_name,p_email,p_phone,p_provider,p_summary);
end $function$;

-- public.connect_ingest_website(p_token_hash text, p_event_id text, p_name text, p_email text, p_phone text, p_summary text)
CREATE OR REPLACE FUNCTION public.connect_ingest_website(p_token_hash text, p_event_id text, p_name text, p_email text, p_phone text, p_summary text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_id uuid;
begin
 select k.channel_account_id into v_id from connect.form_keys k
 join connect.channel_accounts c on c.tenant_id=k.tenant_id and c.id=k.channel_account_id
 join connect.tenants t on t.id=k.tenant_id
 where k.token_sha256=p_token_hash and k.active and c.status='active'
 and c.provider='website' and t.status in ('trial','active');
 if v_id is null then raise exception 'Unknown or disabled form' using errcode='42501';end if;
 return connect.ingest_event(v_id,p_event_id,p_name,p_email,p_phone,'website',p_summary);
end $function$;

-- connect.automate_new_opportunity()
CREATE OR REPLACE FUNCTION connect.automate_new_opportunity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_policy connect.automation_settings%rowtype;v_assignee uuid;
begin
 select * into v_policy from connect.automation_settings where tenant_id=new.tenant_id;
 if not found then
  insert into connect.automation_settings(tenant_id) values(new.tenant_id)
  on conflict(tenant_id) do nothing;
  select * into v_policy from connect.automation_settings where tenant_id=new.tenant_id;
 end if;
 if v_policy.assignment_enabled and new.owner_membership_id is null then
  -- Prefer active counsellors; distribute according to current open workload.
  select m.id into v_assignee
  from connect.memberships m
  left join lateral (
   select count(*) as workload from connect.opportunities o
   join connect.pipeline_stages st on st.tenant_id=o.tenant_id and st.id=o.stage_id
   where o.tenant_id=new.tenant_id and o.owner_membership_id=m.id and st.outcome='open'
  ) wl on true
  where m.tenant_id=new.tenant_id and m.status='active'
   and m.role in ('counsellor','manager','admin','owner')
  order by case when m.role='counsellor' then 0 when m.role='manager' then 1
    when m.role='admin' then 2 else 3 end,wl.workload,m.id
  limit 1;
  if v_assignee is not null then
   update connect.opportunities set owner_membership_id=v_assignee
   where tenant_id=new.tenant_id and id=new.id;
  end if;
 end if;
 if v_policy.initial_followup_enabled then
  insert into connect.tasks(tenant_id,opportunity_id,person_id,assignee_membership_id,title,due_at)
  values(new.tenant_id,new.id,new.contact_id,
   coalesce(new.owner_membership_id,v_assignee),
   'Follow up on new admission',now()+pg_catalog.make_interval(hours=>v_policy.followup_delay_hours));
 end if;
 return new;
end $function$;

-- public.connect_automation_settings(p_actor_id uuid, p_tenant_id uuid, p_update jsonb)
CREATE OR REPLACE FUNCTION public.connect_automation_settings(p_actor_id uuid, p_tenant_id uuid, p_update jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_role text;v_settings connect.automation_settings%rowtype;
begin
 select m.role into v_role from connect.memberships m
 join connect.tenants t on t.id=m.tenant_id
 where m.tenant_id=p_tenant_id and m.user_id=p_actor_id and m.status='active'
  and t.status in ('trial','active');
 if v_role is null then raise exception 'Workspace access denied' using errcode='42501';end if;
 if p_update is not null then
  if v_role not in ('owner','admin') then raise exception 'Only owners and admins may configure automation' using errcode='42501';end if;
  if jsonb_typeof(p_update)<>'object' or p_update ?| array['tenant_id','tenantId'] then
   raise exception 'Invalid automation policy' using errcode='22023';end if;
  if exists(select 1 from pg_catalog.jsonb_object_keys(p_update) as k
     where k not in ('assignmentEnabled','initialFollowupEnabled','followupDelayHours',
       'remindersEnabled','reminderAdvanceMinutes')) then
   raise exception 'Unknown automation option' using errcode='22023';end if;
 end if;
 insert into connect.automation_settings(tenant_id) values(p_tenant_id)
 on conflict(tenant_id) do nothing;
 if p_update is not null then
  update connect.automation_settings set
   assignment_enabled=coalesce((p_update->>'assignmentEnabled')::boolean,assignment_enabled),
   initial_followup_enabled=coalesce((p_update->>'initialFollowupEnabled')::boolean,initial_followup_enabled),
   followup_delay_hours=coalesce((p_update->>'followupDelayHours')::int,followup_delay_hours),
   reminders_enabled=coalesce((p_update->>'remindersEnabled')::boolean,reminders_enabled),
   reminder_advance_minutes=coalesce((p_update->>'reminderAdvanceMinutes')::int,reminder_advance_minutes),
   updated_at=now()
  where tenant_id=p_tenant_id;
 end if;
 select * into v_settings from connect.automation_settings where tenant_id=p_tenant_id;
 return jsonb_build_object('assignmentEnabled',v_settings.assignment_enabled,
  'initialFollowupEnabled',v_settings.initial_followup_enabled,
  'followupDelayHours',v_settings.followup_delay_hours,
  'remindersEnabled',v_settings.reminders_enabled,
  'reminderAdvanceMinutes',v_settings.reminder_advance_minutes);
end $function$;

-- public.connect_staff_inbox(p_actor_id uuid, p_tenant_id uuid, p_action text, p_notification_id uuid)
CREATE OR REPLACE FUNCTION public.connect_staff_inbox(p_actor_id uuid, p_tenant_id uuid, p_action text DEFAULT 'list'::text, p_notification_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_member uuid;v_data jsonb;
begin
 select m.id into v_member from connect.memberships m
 join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active'
  and t.status in ('trial','active');
 if v_member is null then raise exception 'Workspace access denied' using errcode='42501';end if;
 if p_action='read' then
  if p_notification_id is null then raise exception 'Notification id required' using errcode='22023';end if;
  update connect.staff_notifications set read_at=coalesce(read_at,now())
  where id=p_notification_id and tenant_id=p_tenant_id and member_id=v_member;
 elsif p_action<>'list' then raise exception 'Unsupported notification action' using errcode='22023';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'title',n.title,
  'taskId',n.task_id,'kind',n.kind,'createdAt',n.created_at,'readAt',n.read_at)
 order by n.created_at desc),'[]'::jsonb)
 into v_data
 from (select * from connect.staff_notifications where tenant_id=p_tenant_id
  and member_id=v_member order by created_at desc limit 100) n;
 return v_data;
end $function$;

-- public.connect_conversation_history(p_actor_id uuid, p_tenant_id uuid, p_person_id uuid, p_limit integer)
CREATE OR REPLACE FUNCTION public.connect_conversation_history(p_actor_id uuid, p_tenant_id uuid, p_person_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 40)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare v_member uuid;v_result jsonb;
begin
 select m.id into v_member from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active'
  and t.status in ('trial','active');
 if v_member is null then raise exception 'Workspace access denied' using errcode='42501';end if;
 if p_person_id is not null and not exists(select 1 from connect.people
    where tenant_id=p_tenant_id and id=p_person_id) then
  raise exception 'Contact unavailable' using errcode='42501';end if;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.occurred_at,q.id),'[]'::jsonb) into v_result
 from (select m.id,m.conversation_id,c.person_id,p.full_name as person_name,
  a.provider,a.display_name as channel_name,m.direction,m.body,m.delivery_status,m.occurred_at
  from connect.messages m
  join connect.conversations c on c.tenant_id=m.tenant_id and c.id=m.conversation_id
  join connect.channel_accounts a on a.tenant_id=c.tenant_id and a.id=c.channel_account_id
  left join connect.people p on p.tenant_id=c.tenant_id and p.id=c.person_id
  where m.tenant_id=p_tenant_id and (p_person_id is null or c.person_id=p_person_id)
  order by m.occurred_at desc,m.id desc limit least(100,greatest(1,coalesce(p_limit,40)))
 ) q;
 return v_result;
end $function$;

-- public.connect_run_reminders(p_batch_size integer)
CREATE OR REPLACE FUNCTION public.connect_run_reminders(p_batch_size integer DEFAULT 250)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_created integer;
begin
 with candidate as (
  select t.tenant_id,t.id,t.assignee_membership_id,t.title,
   case when t.due_at<=now() then 'overdue' else 'upcoming' end as kind
  from connect.tasks t
  join connect.memberships m on m.tenant_id=t.tenant_id
    and m.id=t.assignee_membership_id and m.status='active'
  join connect.tenants tn on tn.id=t.tenant_id and tn.status in ('trial','active')
  join connect.automation_settings p on p.tenant_id=t.tenant_id and p.reminders_enabled
  where t.status='open' and t.due_at is not null
    and t.due_at<=now()+pg_catalog.make_interval(mins=>p.reminder_advance_minutes)
    and t.due_at>=now()-interval '30 days'
    and not exists (
      select 1 from connect.staff_notifications n
      where n.tenant_id=t.tenant_id and n.task_id=t.id
        and n.member_id=t.assignee_membership_id
        and n.kind=case when t.due_at<=now() then 'overdue' else 'upcoming' end
    )
  order by t.due_at,t.id
  limit least(1000,greatest(1,coalesce(p_batch_size,250)))
 )
 insert into connect.staff_notifications(tenant_id,task_id,member_id,title,kind)
 select tenant_id,id,assignee_membership_id,
  case when kind='overdue' then 'Overdue follow-up: ' else 'Follow-up due soon: ' end||left(title,190),kind
 from candidate
 on conflict(tenant_id,task_id,member_id,kind) do nothing;
 get diagnostics v_created=row_count;
 return jsonb_build_object('created',v_created,'delivery','in_app_only');
end $function$;

-- public.connect_report_write(p_actor_id uuid, p_tenant_id uuid, p_action text, p_data jsonb)
CREATE OR REPLACE FUNCTION public.connect_report_write(p_actor_id uuid, p_tenant_id uuid, p_action text, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_role text;v_member uuid;v_currency text;v_id uuid;v_amount numeric;v_campaign uuid;
begin
 select m.role,m.id,t.default_currency into v_role,v_member,v_currency
 from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.tenant_id=p_tenant_id and m.user_id=p_actor_id
  and m.status='active' and t.status in ('trial','active');
 if v_role is null or v_role not in ('owner','admin','manager') then
  raise exception 'Analytics finance management role required' using errcode='42501';end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' then
  raise exception 'Invalid record payload' using errcode='22023';end if;
 v_amount:=nullif(p_data->>'amount','')::numeric;
 if p_action='create_campaign' then
  if length(btrim(coalesce(p_data->>'name',''))) not between 2 and 150
   or length(coalesce(p_data->>'source',''))>80 then
   raise exception 'Invalid campaign details' using errcode='22023';end if;
  insert into connect.campaigns(tenant_id,name,source)
  values(p_tenant_id,btrim(p_data->>'name'),
   lower(nullif(btrim(p_data->>'source'),''))) returning id into v_id;
 elsif p_action='attribute_campaign' then
  v_campaign:=(p_data->>'campaignId')::uuid;
  if not exists(select 1 from connect.campaigns where tenant_id=p_tenant_id and id=v_campaign)
   or not exists(select 1 from connect.opportunities where tenant_id=p_tenant_id
    and id=(p_data->>'opportunityId')::uuid) then
   raise exception 'Campaign or opportunity unavailable' using errcode='42501';end if;
  if exists(select 1 from connect.attribution
   where tenant_id=p_tenant_id and opportunity_id=(p_data->>'opportunityId')::uuid
    and campaign_id is not null) then
   raise exception 'Opportunity already has campaign attribution' using errcode='23505';end if;
  insert into connect.attribution(tenant_id,opportunity_id,campaign_id,source,medium)
  select p_tenant_id,o.id,v_campaign,coalesce(c.source,'unknown'),'campaign'
  from connect.opportunities o join connect.campaigns c on c.tenant_id=o.tenant_id and c.id=v_campaign
  where o.tenant_id=p_tenant_id and o.id=(p_data->>'opportunityId')::uuid returning id into v_id;
 elsif p_action in ('record_spend','record_revenue') then
  if v_amount is null or v_amount<=0 or v_amount>999999999999.99
   or (p_data->>'currency') is distinct from v_currency
   or length(coalesce(p_data->>'note',''))>500 then
   raise exception 'Positive amount in institute base currency is required' using errcode='22023';end if;
  if p_action='record_spend' then
   insert into connect.campaign_spend(tenant_id,campaign_id,spent_on,amount,currency,note,recorded_by)
   values(p_tenant_id,(p_data->>'campaignId')::uuid,(p_data->>'date')::date,v_amount,v_currency,
    nullif(p_data->>'note',''),v_member) returning id into v_id;
  else
   if length(btrim(coalesce(p_data->>'reference',''))) not between 3 and 180 then
    raise exception 'A unique payment reference is required to avoid duplicate receipts' using errcode='22023';end if;
   if not exists(select 1 from connect.opportunities
     where tenant_id=p_tenant_id and id=(p_data->>'opportunityId')::uuid
       and currency=v_currency) then
    raise exception 'Admission currency must match the reporting base currency' using errcode='22023';
   end if;
   insert into connect.realized_revenue(tenant_id,opportunity_id,received_on,amount,currency,
    external_reference,note,recorded_by)
   values(p_tenant_id,(p_data->>'opportunityId')::uuid,(p_data->>'date')::date,v_amount,v_currency,
    nullif(p_data->>'reference',''),nullif(p_data->>'note',''),v_member)
   returning id into v_id;
  end if;
 else raise exception 'Unknown analytics operation' using errcode='22023';end if;
 insert into connect.audit_events(tenant_id,actor_membership_id,event_type,entity_type,entity_id,metadata)
 values(p_tenant_id,v_member,p_action,'reporting',v_id,
  jsonb_build_object('kind',p_action));
 return jsonb_build_object('ok',true,'id',v_id);
end $function$;

-- public.connect_report_read(p_actor_id uuid, p_tenant_id uuid, p_from date, p_to date, p_pipeline_id uuid)
CREATE OR REPLACE FUNCTION public.connect_report_read(p_actor_id uuid, p_tenant_id uuid, p_from date, p_to date, p_pipeline_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare v_member uuid;v_role text;v_tz text;v_currency text;v_start timestamptz;v_end timestamptz;
 v_summary jsonb;v_funnel jsonb;v_journey jsonb;v_staff jsonb;v_sources jsonb;v_campaigns jsonb;
 v_opps bigint;v_won bigint;v_spend numeric;v_revenue numeric;v_opportunity_revenue numeric;
begin
 select m.id,m.role,t.timezone,t.default_currency into v_member,v_role,v_tz,v_currency
 from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active'
  and t.status in ('trial','active');
 if v_member is null then raise exception 'Workspace unavailable' using errcode='42501';end if;
 -- Detailed reporting only for managers; counsellors should not see other staff finances.
 if v_role not in ('owner','admin','manager') then
  raise exception 'Reporting permission required' using errcode='42501';end if;
 if p_from is null or p_to is null or p_from>p_to or (p_to-p_from)>366
   or p_to>current_date+1 then raise exception 'Invalid reporting date range' using errcode='22023';end if;
 if p_pipeline_id is not null and not exists(
  select 1 from connect.pipelines where tenant_id=p_tenant_id and id=p_pipeline_id
 ) then raise exception 'Pipeline unavailable' using errcode='42501';end if;
 v_start:=p_from::timestamp at time zone v_tz;
 v_end:=(p_to+1)::timestamp at time zone v_tz;

 -- Conversion cohort = opportunities created in the period. Stage is current,
 -- not an as-of-period snapshot. Multiple enquiries are not double-counted.
 with eligible as (
  select o.* ,s.outcome from connect.opportunities o
  join connect.pipeline_stages s on s.tenant_id=o.tenant_id and s.id=o.stage_id
  where o.tenant_id=p_tenant_id and o.created_at>=v_start and o.created_at<v_end
   and (p_pipeline_id is null or o.pipeline_id=p_pipeline_id)
 )
 select count(*),count(*) filter(where outcome='won') into v_opps,v_won from eligible;
 select jsonb_build_object(
  'opportunities',v_opps,'won',v_won,
  'conversionRate',case when v_opps=0 then null else round(100.0*v_won/v_opps,2) end,
  'inquiries',(select count(*) from connect.inquiries i where i.tenant_id=p_tenant_id
    and i.received_at>=v_start and i.received_at<v_end
    and (p_pipeline_id is null or exists(
     select 1 from connect.opportunities o where o.id=i.opportunity_id and o.tenant_id=p_tenant_id
     and o.pipeline_id=p_pipeline_id))),
  'expectedValue',(select coalesce(sum(o.expected_value),0) from connect.opportunities o
   where o.tenant_id=p_tenant_id and o.created_at>=v_start and o.created_at<v_end
   and o.currency=v_currency
   and (p_pipeline_id is null or o.pipeline_id=p_pipeline_id)),
  'excludedCurrencyOpportunities',(select count(*) from connect.opportunities o
   where o.tenant_id=p_tenant_id and o.created_at>=v_start and o.created_at<v_end
    and o.currency<>v_currency and o.expected_value is not null
    and (p_pipeline_id is null or o.pipeline_id=p_pipeline_id)),
  'currency',v_currency,'fromDate',p_from,'toDate',p_to
 ) into v_summary;

 -- Funnel: current stage for the selected opportunity creation cohort;
 -- includes outcome and denominators. Does NOT claim historical stage-through rates.
 select coalesce(jsonb_agg(jsonb_build_object('pipelineId',q.pipeline_id,'pipeline',q.pipeline,
  'stageId',q.stage_id,'stage',q.stage,'sortOrder',q.sort_order,'outcome',q.outcome,
  'opportunities',q.opp_count) order by q.pipeline,q.sort_order),'[]'::jsonb)
 into v_funnel
 from (select p.id as pipeline_id,p.name as pipeline,s.id as stage_id,s.name as stage,
  s.sort_order,s.outcome,count(o.id) as opp_count
  from connect.pipelines p join connect.pipeline_stages s on s.tenant_id=p.tenant_id and s.pipeline_id=p.id
  left join connect.opportunities o on o.tenant_id=p.tenant_id
   and o.pipeline_id=p.id and o.stage_id=s.id and o.created_at>=v_start and o.created_at<v_end
  where p.tenant_id=p_tenant_id and (p_pipeline_id is null or p.id=p_pipeline_id)
  group by p.id,p.name,s.id,s.name,s.sort_order,s.outcome) q;

 -- Historical reach: each opportunity counted once per stage it has ever entered.
 -- Denominator remains the same created-during-period opportunity cohort, not stage-to-stage.
 select coalesce(jsonb_agg(jsonb_build_object(
  'pipelineId',q.pipeline_id,'pipeline',q.pipeline,'stageId',q.stage_id,'stage',q.stage,
  'sortOrder',q.sort_order,'outcome',q.outcome,
  'reached',q.reached,
  'cohort',q.cohort,
  'reachPercent',case when q.cohort=0 then null else round(100.0*q.reached/q.cohort,2) end)
  order by q.pipeline,q.sort_order),'[]'::jsonb) into v_journey
 from (
  select p.id as pipeline_id,p.name as pipeline,s.id as stage_id,s.name as stage,s.sort_order,s.outcome,
   (select count(distinct e.opportunity_id)
    from connect.stage_events e join connect.opportunities o on o.tenant_id=e.tenant_id and o.id=e.opportunity_id
    where e.tenant_id=p_tenant_id and e.pipeline_id=p.id and e.to_stage_id=s.id
      and o.created_at>=v_start and o.created_at<v_end) as reached,
   (select count(*) from connect.opportunities o where o.tenant_id=p_tenant_id
      and o.pipeline_id=p.id and o.created_at>=v_start and o.created_at<v_end) as cohort
  from connect.pipelines p join connect.pipeline_stages s on s.tenant_id=p.tenant_id and s.pipeline_id=p.id
  where p.tenant_id=p_tenant_id and (p_pipeline_id is null or p.id=p_pipeline_id)
 ) q;

 -- Current assignee attribution. Unknown/unassigned excluded from person rows but shown separately.
 select coalesce(jsonb_agg(to_jsonb(q) order by q.won desc,q.opportunities desc),'[]'::jsonb)
 into v_staff
 from (select m.id as "memberId",m.role,
   count(o.id) as opportunities,
   count(o.id) filter(where s.outcome='won') as won,
   count(o.id) filter(where s.outcome='open') as open,
   count(o.id) filter(where s.outcome='lost') as lost,
   case when count(o.id)=0 then null else round(100.0*count(o.id) filter(where s.outcome='won')/count(o.id),2) end as "conversionRate",
   (select count(*) from connect.tasks t where t.tenant_id=p_tenant_id and t.assignee_membership_id=m.id
      and t.created_at>=v_start and t.created_at<v_end and t.status='done') as "tasksCompleted"
  from connect.memberships m
  left join connect.opportunities o on o.tenant_id=m.tenant_id
    and o.owner_membership_id=m.id and o.created_at>=v_start and o.created_at<v_end
    and (p_pipeline_id is null or o.pipeline_id=p_pipeline_id)
  left join connect.pipeline_stages s on s.tenant_id=o.tenant_id and s.id=o.stage_id
  where m.tenant_id=p_tenant_id and m.role in ('owner','admin','manager','counsellor')
  group by m.id,m.role) q;

 -- Each opportunity credited once to its earliest associated enquiry source.
 -- Spend source is the source declared by campaign. Revenue is recorded paid amount,
 -- grouped by associated opportunity's first-touch source, in the period received.
 with first_source as (
  select distinct on (i.opportunity_id) i.opportunity_id,lower(trim(i.source)) as source
  from connect.inquiries i
  where i.tenant_id=p_tenant_id and i.opportunity_id is not null
  order by i.opportunity_id,i.received_at,i.id
 ), sources as (
  select lower(trim(i.source)) as source,count(*) as inquiries
  from connect.inquiries i where i.tenant_id=p_tenant_id
   and i.received_at>=v_start and i.received_at<v_end
  group by lower(trim(i.source))
 ), conversions as (
  select coalesce(f.source,'unattributed') as source,count(*) as opportunities,
   count(*) filter(where s.outcome='won') as won
  from connect.opportunities o
  join connect.pipeline_stages s on s.tenant_id=o.tenant_id and s.id=o.stage_id
  left join first_source f on f.opportunity_id=o.id
  where o.tenant_id=p_tenant_id and o.created_at>=v_start and o.created_at<v_end
   and (p_pipeline_id is null or o.pipeline_id=p_pipeline_id)
  group by coalesce(f.source,'unattributed')
 ), income as (
  select coalesce(f.source,'unattributed') as source,sum(r.amount) as revenue
  from connect.realized_revenue r join connect.opportunities o on o.tenant_id=r.tenant_id and o.id=r.opportunity_id
  left join first_source f on f.opportunity_id=o.id
  where r.tenant_id=p_tenant_id and r.received_on between p_from and p_to
   and (p_pipeline_id is null or o.pipeline_id=p_pipeline_id)
  group by coalesce(f.source,'unattributed')
 ), spend as (
  select lower(trim(coalesce(c.source,'unattributed'))) as source,sum(sp.amount) as spend
  from connect.campaign_spend sp join connect.campaigns c on c.tenant_id=sp.tenant_id and c.id=sp.campaign_id
  where sp.tenant_id=p_tenant_id and sp.spent_on between p_from and p_to
   and p_pipeline_id is null
  group by lower(trim(coalesce(c.source,'unattributed')))
 )
 select coalesce(jsonb_agg(jsonb_build_object('source',k.source,'inquiries',coalesce(sr.inquiries,0),
  'opportunities',coalesce(cv.opportunities,0),'won',coalesce(cv.won,0),
  'conversionRate',case when coalesce(cv.opportunities,0)=0 then null else round(100.0*cv.won/cv.opportunities,2) end,
  'spend',sp.spend,'revenue',inc.revenue,
  'roiPercent',case when coalesce(sp.spend,0)<=0 then null else round(100*(coalesce(inc.revenue,0)-sp.spend)/sp.spend,2) end)
  order by coalesce(sr.inquiries,0) desc,k.source),'[]'::jsonb) into v_sources
 from (select source from sources union select source from conversions
       union select source from income union select source from spend) k
 left join sources sr on sr.source=k.source
 left join conversions cv on cv.source=k.source
 left join income inc on inc.source=k.source
 left join spend sp on sp.source=k.source;

 -- Campaign ROI: paid revenue for specifically attributed opportunities in range.
 with spend as (
  select campaign_id,sum(amount) amount from connect.campaign_spend where tenant_id=p_tenant_id
  and spent_on between p_from and p_to group by campaign_id
 ), revenue as (
  select a.campaign_id,sum(r.amount) amount from connect.realized_revenue r
  join connect.attribution a on a.tenant_id=r.tenant_id and a.opportunity_id=r.opportunity_id
    and a.campaign_id is not null
  join connect.opportunities o on o.tenant_id=r.tenant_id and o.id=r.opportunity_id
  where r.tenant_id=p_tenant_id and r.received_on between p_from and p_to
   and (p_pipeline_id is null or o.pipeline_id=p_pipeline_id)
  group by a.campaign_id
 ), performance as (
  select a.campaign_id,count(distinct a.opportunity_id) as opportunities,
    count(distinct a.opportunity_id) filter(where s.outcome='won') as won
  from connect.attribution a join connect.opportunities o on o.tenant_id=a.tenant_id and o.id=a.opportunity_id
  join connect.pipeline_stages s on s.tenant_id=o.tenant_id and s.id=o.stage_id
  where a.tenant_id=p_tenant_id and a.campaign_id is not null
    and o.created_at>=v_start and o.created_at<v_end
    and (p_pipeline_id is null or o.pipeline_id=p_pipeline_id)
  group by a.campaign_id
 )
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',c.id,'name',c.name,'source',c.source,
  'spend',case when p_pipeline_id is null then sp.amount else null end,'revenue',rv.amount,'opportunities',coalesce(pf.opportunities,0),
  'won',coalesce(pf.won,0),
  'costPerAcquisition',case when coalesce(pf.won,0)=0 or sp.amount is null then null
   else case when p_pipeline_id is null then round(sp.amount/pf.won,2) else null end end,
  'roiPercent',case when p_pipeline_id is not null or coalesce(sp.amount,0)<=0 then null
   else round(100*(coalesce(rv.amount,0)-sp.amount)/sp.amount,2) end)
 order by c.name),'[]'::jsonb) into v_campaigns
 from connect.campaigns c
 left join spend sp on sp.campaign_id=c.id
 left join revenue rv on rv.campaign_id=c.id
 left join performance pf on pf.campaign_id=c.id
 where c.tenant_id=p_tenant_id;

 return jsonb_build_object('summary',v_summary,'funnel',v_funnel,'stageJourney',v_journey,'staff',v_staff,
  'sources',v_sources,'campaigns',v_campaigns,
  'definitions',jsonb_build_object(
    'conversion','Currently-won opportunities created during selected period / all opportunities created during that period',
    'staff','Current opportunity owner, not historical closer',
    'funnel','Current stage of opportunities created in selected period, not historical funnel stage-entry counts',
    'stageJourney','Count of distinct opportunities from the creation cohort that entered each stage, based on stage events; percentages use the full pipeline cohort',
    'sources','Earliest linked enquiry per opportunity; missing source is Unattributed',
    'roi','(Recorded paid revenue minus recorded campaign spend) / campaign spend, by ledger dates',
    'revenue','Only manually recorded receipts; expected pipeline value is not paid revenue',
    'currency',v_currency,'pipelineSpend','Spend is not allocated across pipelines; source and campaign ROI are suppressed for pipeline-specific reports'
  ));
end $function$;

-- connect.initialize_enquiry_categories()
CREATE OR REPLACE FUNCTION connect.initialize_enquiry_categories()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare labels text[]:=array['Online Courses','Offline Courses','Kits & Components','School Programs','Partnerships','Collaborations','Trainer / Job Applicant','Vendor / Supplier','General / Other'];v_label text;idx int:=0;
begin
 insert into connect.workspace_preferences(tenant_id) values(new.id);
 foreach v_label in array labels loop
  idx:=idx+1;
  insert into connect.enquiry_categories(tenant_id,label,sort_order) values(new.id,v_label,idx);
 end loop;
 return new;
end $function$;

-- public.connect_enquiry_preferences(p_actor_id uuid, p_tenant_id uuid, p_action text, p_data jsonb)
CREATE OR REPLACE FUNCTION public.connect_enquiry_preferences(p_actor_id uuid, p_tenant_id uuid, p_action text DEFAULT 'read'::text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_role text;v_member uuid;v_id uuid;v_mode text;v_categories jsonb;v_label text;v_category uuid;
begin
 select m.id,m.role into v_member,v_role from connect.memberships m
 join connect.tenants t on t.id=m.tenant_id
 where m.tenant_id=p_tenant_id and m.user_id=p_actor_id and m.status='active' and t.status in ('trial','active');
 if v_member is null then raise exception 'Institute access denied' using errcode='42501';end if;
 if p_action not in ('read','classify_inquiry') and v_role not in ('owner','admin') then raise exception 'Institute owner/admin required' using errcode='42501';end if;
 if p_action='set_mode' then
  v_mode:=p_data->>'mode';
  if v_mode not in ('simple','advanced') or v_mode is null then raise exception 'Invalid interface mode' using errcode='22023';end if;
  update connect.workspace_preferences set interface_mode=v_mode,updated_at=now() where tenant_id=p_tenant_id;
 elsif p_action='add_category' then
  v_label:=btrim(p_data->>'label');
  if v_label is null or length(v_label) not between 2 and 80 then raise exception 'Invalid category label' using errcode='22023';end if;
  insert into connect.enquiry_categories(tenant_id,label,sort_order)
  values(p_tenant_id,v_label,(select coalesce(max(sort_order),0)+1 from connect.enquiry_categories where tenant_id=p_tenant_id))
  returning id into v_id;
 elsif p_action='rename_category' then
  v_category:=(p_data->>'id')::uuid;v_label:=btrim(p_data->>'label');
  if v_label is null or length(v_label) not between 2 and 80 then raise exception 'Invalid category label' using errcode='22023';end if;
  update connect.enquiry_categories set label=v_label where tenant_id=p_tenant_id and id=v_category returning id into v_id;
  if v_id is null then raise exception 'Category unavailable' using errcode='42501';end if;
 elsif p_action='set_category_active' then
  v_category:=(p_data->>'id')::uuid;
  if jsonb_typeof(p_data->'active')<>'boolean' then raise exception 'Invalid category status' using errcode='22023';end if;
  update connect.enquiry_categories set active=(p_data->>'active')::boolean where tenant_id=p_tenant_id and id=v_category returning id into v_id;
  if v_id is null then raise exception 'Category unavailable' using errcode='42501';end if;
 elsif p_action='classify_inquiry' then
  if v_role='viewer' then raise exception 'Classification requires staff access' using errcode='42501';end if;
  v_category:=(p_data->>'categoryId')::uuid;
  if not exists(select 1 from connect.enquiry_categories where tenant_id=p_tenant_id and id=v_category and active)
  then raise exception 'Category unavailable' using errcode='42501';end if;
  update connect.inquiries set category_id=v_category where tenant_id=p_tenant_id and id=(p_data->>'inquiryId')::uuid returning id into v_id;
  if v_id is null then raise exception 'Enquiry unavailable' using errcode='42501';end if;
 else
  if p_action<>'read' then raise exception 'Unknown preference action' using errcode='22023';end if;
 end if;
 if p_action<>'read' then
  insert into connect.audit_events(tenant_id,actor_membership_id,event_type,entity_type,entity_id,metadata)
  values(p_tenant_id,v_member,'enquiry_'||p_action,'enquiry_configuration',v_id,jsonb_build_object('action',p_action));
 end if;
 select interface_mode into v_mode from connect.workspace_preferences where tenant_id=p_tenant_id;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'label',label,'active',active,'sortOrder',sort_order) order by sort_order,label),'[]'::jsonb)
 into v_categories from connect.enquiry_categories where tenant_id=p_tenant_id;
 return jsonb_build_object('mode',coalesce(v_mode,'simple'),'categories',v_categories);
end $function$;

-- connect.automate_unqualified_inquiry()
CREATE OR REPLACE FUNCTION connect.automate_unqualified_inquiry()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_policy connect.automation_settings%rowtype;v_assignee uuid;
begin
 if new.person_id is null or new.opportunity_id is not null then return new;end if;
 select * into v_policy from connect.automation_settings where tenant_id=new.tenant_id;
 if not found then
  insert into connect.automation_settings(tenant_id) values(new.tenant_id)
  on conflict(tenant_id) do nothing;
  select * into v_policy from connect.automation_settings where tenant_id=new.tenant_id;
 end if;
 if not v_policy.initial_followup_enabled then return new;end if;
 -- Serialize one-contact task creation across concurrent inbound channel deliveries.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  new.tenant_id::text||':initial-followup:'||new.person_id::text,0));
 if exists(select 1 from connect.tasks t where t.tenant_id=new.tenant_id and t.person_id=new.person_id
  and t.status='open') then return new;end if;
 select m.id into v_assignee from connect.memberships m
 where m.tenant_id=new.tenant_id and m.status='active'
  and m.role in ('counsellor','manager','admin','owner')
 order by case m.role when 'counsellor' then 0 when 'manager' then 1 when 'admin' then 2 else 3 end,
  (select count(*) from connect.tasks t where t.tenant_id=new.tenant_id and t.assignee_membership_id=m.id
   and t.status='open'),m.id limit 1;
 insert into connect.tasks(tenant_id,person_id,assignee_membership_id,title,due_at)
 values(new.tenant_id,new.person_id,v_assignee,'Review and follow up on enquiry',
 now()+pg_catalog.make_interval(hours=>v_policy.followup_delay_hours));
 return new;
end $function$;

-- public.connect_contact_timeline(p_actor_id uuid, p_tenant_id uuid, p_person_id uuid, p_before_at timestamp with time zone, p_before_key text, p_limit integer)
CREATE OR REPLACE FUNCTION public.connect_contact_timeline(p_actor_id uuid, p_tenant_id uuid, p_person_id uuid, p_before_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_before_key text DEFAULT NULL::text, p_limit integer DEFAULT 40)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare v_limit int:=least(100,greatest(1,coalesce(p_limit,40)));
 v_events jsonb;v_count int;v_page jsonb;v_last jsonb;
begin
 if not exists (
  select 1 from connect.memberships m join connect.tenants t on t.id=m.tenant_id
  where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active' and t.status in ('active','trial')
 ) then raise exception 'Workspace read access denied' using errcode='42501';end if;
 if not exists(select 1 from connect.people p where p.tenant_id=p_tenant_id and p.id=p_person_id)
 then raise exception 'Contact unavailable' using errcode='42501';end if;
 if (p_before_at is null) <> (p_before_key is null) then raise exception 'Invalid timeline cursor' using errcode='22023';end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',h.event_key,'kind',h.kind,'title',h.title,'detail',h.detail,'at',h.at,'status',h.status
 ) order by h.at desc,h.event_key desc),'[]'::jsonb),count(*)
 into v_events,v_count
 from (
  select e.* from (
   select 'enquiry:'||i.id::text event_key,'enquiry'::text kind,'Enquiry received'::text title,
    coalesce(nullif(i.summary,''),'Source: '||i.source) detail,i.received_at at,i.source status
   from connect.inquiries i where i.tenant_id=p_tenant_id and (i.person_id=p_person_id or
    i.opportunity_id in(select id from connect.opportunities where tenant_id=p_tenant_id and contact_id=p_person_id))
   union all
   select 'activity:'||a.id,'activity',initcap(replace(a.kind,'_',' ')),coalesce(a.summary,''),a.occurred_at,a.kind
   from connect.activities a where a.tenant_id=p_tenant_id and (a.person_id=p_person_id or
    a.opportunity_id in(select id from connect.opportunities where tenant_id=p_tenant_id and contact_id=p_person_id))
   union all
   select 'admission:'||o.id,'admission','Admission created',o.title,o.created_at,null::text
   from connect.opportunities o where o.tenant_id=p_tenant_id and o.contact_id=p_person_id
   union all
   select 'stage:'||st.id,'stage','Admission stage changed',
    coalesce(prev.name,'Start')||' → '||coalesce(destination.name,'Unknown')||
     case when st.note is null or st.note='' then '' else ' · '||st.note end,
    st.changed_at,destination.name
   from connect.stage_events st
   join connect.opportunities o on o.tenant_id=st.tenant_id and o.id=st.opportunity_id
   left join connect.pipeline_stages prev on prev.tenant_id=st.tenant_id and prev.id=st.from_stage_id
   left join connect.pipeline_stages destination on destination.tenant_id=st.tenant_id and destination.id=st.to_stage_id
   where st.tenant_id=p_tenant_id and o.contact_id=p_person_id
   union all
   select 'task:'||t.id,'task','Follow-up created',t.title,t.created_at,t.status
   from connect.tasks t where t.tenant_id=p_tenant_id and (t.person_id=p_person_id or
    t.opportunity_id in(select id from connect.opportunities where tenant_id=p_tenant_id and contact_id=p_person_id))
   union all
   select 'taskdone:'||t.id,'task','Follow-up completed',t.title,t.completed_at,t.status
   from connect.tasks t where t.tenant_id=p_tenant_id and t.completed_at is not null and (t.person_id=p_person_id or
    t.opportunity_id in(select id from connect.opportunities where tenant_id=p_tenant_id and contact_id=p_person_id))
   union all
   select 'appointment:'||a.id,'appointment','Appointment scheduled',a.title,a.created_at,a.status
   from connect.appointments a where a.tenant_id=p_tenant_id and (a.person_id=p_person_id or
    a.opportunity_id in(select id from connect.opportunities where tenant_id=p_tenant_id and contact_id=p_person_id))
   union all
   select 'message:'||m.id,'message',case when m.direction='inbound' then 'Message received' else 'Message sent' end,
    coalesce(nullif(m.body,''),'Message content unavailable'),m.occurred_at,accounts.provider
   from connect.messages m
   join connect.conversations c on c.tenant_id=m.tenant_id and c.id=m.conversation_id
   join connect.channel_accounts accounts on accounts.tenant_id=c.tenant_id and accounts.id=c.channel_account_id
   where m.tenant_id=p_tenant_id and c.person_id=p_person_id
  ) e
  where e.at is not null and (p_before_at is null or (e.at,e.event_key)<(p_before_at,p_before_key))
  order by e.at desc,e.event_key desc limit v_limit+1
 ) h;
 select coalesce(jsonb_agg(x.value order by x.ord),'[]'::jsonb) into v_page
 from jsonb_array_elements(v_events) with ordinality as x(value,ord) where x.ord<=v_limit;
 if v_count>v_limit then
  v_last:=v_page->(v_limit-1);
  return jsonb_build_object('items',v_page,'nextCursor',jsonb_build_object('at',v_last->>'at','key',v_last->>'id'));
 end if;
 return jsonb_build_object('items',v_page,'nextCursor',null);
end $function$;

-- public.connect_contact_relations(p_actor_id uuid, p_tenant_id uuid, p_person_id uuid)
CREATE OR REPLACE FUNCTION public.connect_contact_relations(p_actor_id uuid, p_tenant_id uuid, p_person_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare v_member uuid; v_owner jsonb; v_people jsonb; v_orgs jsonb;v_members jsonb;v_org_options jsonb;v_people_options jsonb;
begin
 select m.id into v_member from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active' and t.status in ('active','trial');
 if v_member is null then raise exception 'Access denied' using errcode='42501';end if;
 if not exists(select 1 from connect.people where tenant_id=p_tenant_id and id=p_person_id and status='active')
 then raise exception 'Contact unavailable' using errcode='42501';end if;

 select coalesce(jsonb_agg(jsonb_build_object('personId',x.other_id,'name',x.full_name,'relationship',x.relationship,'direction',x.direction)
   order by x.full_name,x.relationship),'[]'::jsonb) into v_people
 from (
  select r.to_person_id other_id,p.full_name,r.relationship,'outgoing'::text direction
  from connect.person_relations r join connect.people p on p.tenant_id=r.tenant_id and p.id=r.to_person_id
  where r.tenant_id=p_tenant_id and r.from_person_id=p_person_id
  union all
  select r.from_person_id,p.full_name,r.relationship,'incoming'::text
  from connect.person_relations r join connect.people p on p.tenant_id=r.tenant_id and p.id=r.from_person_id
  where r.tenant_id=p_tenant_id and r.to_person_id=p_person_id
 ) x;
 select coalesce(jsonb_agg(jsonb_build_object('organizationId',o.id,'name',o.name,'category',o.category,'position',oc.position_title)
 order by o.name),'[]'::jsonb) into v_orgs
 from connect.organization_contacts oc join connect.organizations o on o.tenant_id=oc.tenant_id and o.id=oc.organization_id
 where oc.tenant_id=p_tenant_id and oc.person_id=p_person_id;
 select jsonb_build_object('memberId',m.id,'role',m.role) into v_owner
 from connect.contact_owners co join connect.memberships m on m.tenant_id=co.tenant_id and m.id=co.owner_membership_id
 where co.tenant_id=p_tenant_id and co.person_id=p_person_id;
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'role',m.role,'label','Member '||left(m.user_id::text,8))
 order by m.user_id),'[]'::jsonb) into v_members
 from connect.memberships m
 where m.tenant_id=p_tenant_id and m.status='active' and m.role<>'viewer';
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'category',o.category) order by o.name),'[]'::jsonb)
 into v_org_options from connect.organizations o where o.tenant_id=p_tenant_id;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.full_name) order by p.full_name),'[]'::jsonb)
 into v_people_options from connect.people p where p.tenant_id=p_tenant_id and p.status='active' and p.id<>p_person_id;
 return jsonb_build_object('people',v_people,'organizations',v_orgs,'owner',v_owner,'members',v_members,
 'organizationOptions',v_org_options,'peopleOptions',v_people_options);
end $function$;

-- public.connect_contact_relation_command(p_actor_id uuid, p_tenant_id uuid, p_person_id uuid, p_action text, p_data jsonb)
CREATE OR REPLACE FUNCTION public.connect_contact_relation_command(p_actor_id uuid, p_tenant_id uuid, p_person_id uuid, p_action text, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_member uuid;v_role text;v_other uuid;v_org uuid;v_owner uuid;v_label text;
begin
 select m.id,m.role into v_member,v_role from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active' and t.status in ('active','trial');
 if v_member is null or v_role='viewer' then raise exception 'Write access denied' using errcode='42501';end if;
 if not exists(select 1 from connect.people where tenant_id=p_tenant_id and id=p_person_id and status='active')
 then raise exception 'Contact unavailable' using errcode='42501';end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Invalid payload' using errcode='22023';end if;
 case p_action
 when 'link_person' then
  v_other:=nullif(p_data->>'relatedPersonId','')::uuid;
  v_label:=nullif(btrim(p_data->>'relationship'),'');
  if v_other is null or v_other=p_person_id or v_label is null or length(v_label)>60
  or not exists(select 1 from connect.people where tenant_id=p_tenant_id and id=v_other and status='active')
  then raise exception 'Invalid related contact' using errcode='22023';end if;
  insert into connect.person_relations(tenant_id,from_person_id,to_person_id,relationship)
  values(p_tenant_id,p_person_id,v_other,v_label) on conflict do nothing;
 when 'unlink_person' then
  v_other:=nullif(p_data->>'relatedPersonId','')::uuid;
  v_label:=nullif(btrim(p_data->>'relationship'),'');
  if (p_data->>'direction') not in ('incoming','outgoing') or v_other is null or v_label is null
  then raise exception 'Invalid relationship' using errcode='22023';end if;
  if p_data->>'direction'='outgoing' then
   delete from connect.person_relations where tenant_id=p_tenant_id and from_person_id=p_person_id
   and to_person_id=v_other and relationship=v_label;
  else
   delete from connect.person_relations where tenant_id=p_tenant_id and from_person_id=v_other
   and to_person_id=p_person_id and relationship=v_label;
  end if;
 when 'link_organization' then
  v_org:=nullif(p_data->>'organizationId','')::uuid;
  v_label:=nullif(btrim(p_data->>'position'),'');
  if v_org is null or length(coalesce(v_label,''))>100 or
    not exists(select 1 from connect.organizations where tenant_id=p_tenant_id and id=v_org)
  then raise exception 'Invalid organization link' using errcode='22023';end if;
  insert into connect.organization_contacts(tenant_id,organization_id,person_id,position_title)
  values(p_tenant_id,v_org,p_person_id,v_label)
  on conflict(tenant_id,organization_id,person_id) do update set position_title=excluded.position_title;
 when 'unlink_organization' then
  v_org:=nullif(p_data->>'organizationId','')::uuid;
  if v_org is null then raise exception 'Missing organization' using errcode='22023';end if;
  delete from connect.organization_contacts where tenant_id=p_tenant_id and person_id=p_person_id and organization_id=v_org;
 when 'assign_owner' then
  if v_role not in ('owner','admin','manager') then raise exception 'Manager access required' using errcode='42501';end if;
  v_owner:=nullif(p_data->>'memberId','')::uuid;
  if v_owner is null then
   delete from connect.contact_owners where tenant_id=p_tenant_id and person_id=p_person_id;
  else
   if not exists(select 1 from connect.memberships where tenant_id=p_tenant_id and id=v_owner and status='active' and role<>'viewer')
   then raise exception 'Inactive or invalid assignee' using errcode='42501';end if;
   insert into connect.contact_owners(tenant_id,person_id,owner_membership_id,assigned_by_membership_id)
   values(p_tenant_id,p_person_id,v_owner,v_member)
   on conflict(tenant_id,person_id) do update
   set owner_membership_id=excluded.owner_membership_id,assigned_by_membership_id=excluded.assigned_by_membership_id,assigned_at=now();
  end if;
 else raise exception 'Unsupported relationship action' using errcode='22023';
 end case;
 insert into connect.audit_events(tenant_id,actor_membership_id,event_type,entity_type,entity_id,metadata)
 values(p_tenant_id,v_member,'contact_'||p_action,'person',p_person_id,jsonb_build_object('action',p_action));
 return jsonb_build_object('ok',true);
end $function$;

-- public.connect_contact_insights(p_actor_id uuid, p_tenant_id uuid, p_person_id uuid, p_limit integer)
CREATE OR REPLACE FUNCTION public.connect_contact_insights(p_actor_id uuid, p_tenant_id uuid, p_person_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare v_items jsonb;
begin
 if not exists(select 1 from connect.memberships m join connect.tenants t on t.id=m.tenant_id
  where m.user_id=p_actor_id and m.tenant_id=p_tenant_id
  and m.status='active' and t.status in ('active','trial')) then
  raise exception 'Workspace read access denied' using errcode='42501';
 end if;
 if p_person_id is not null and not exists(select 1 from connect.people
  where tenant_id=p_tenant_id and id=p_person_id and status='active') then
  raise exception 'Contact unavailable' using errcode='42501';
 end if;
 select coalesce(jsonb_agg(to_jsonb(result) order by result.priority desc,result.last_enquiry_at desc nulls last,result.person_id),'[]'::jsonb)
 into v_items
 from (
  select p.id as person_id,p.full_name as name,
   inquiries.enquiry_count,inquiries.first_enquiry_at,inquiries.last_enquiry_at,
   coalesce(tasks.open_tasks,0) open_tasks,coalesce(tasks.overdue_tasks,0) overdue_tasks,
   tasks.next_followup_at,coalesce(appointments.upcoming_appointments,0) upcoming_appointments,
   coalesce(opp.open_opportunities,0) open_opportunities,coalesce(opp.won_opportunities,0) won_opportunities,
   (owner.owner_membership_id is not null) has_owner,
   greatest(inquiries.last_enquiry_at,activities.last_activity_at,messages.last_message_at,stages.last_stage_at) last_interaction_at,
   case
    when coalesce(tasks.overdue_tasks,0)>0 then 4
    when inquiries.enquiry_count>0 and coalesce(opp.open_opportunities,0)>0
      and coalesce(tasks.open_tasks,0)=0 and coalesce(appointments.upcoming_appointments,0)=0 then 3
    when inquiries.last_enquiry_at<now()-interval '7 days' and coalesce(opp.open_opportunities,0)>0
      and greatest(inquiries.last_enquiry_at,activities.last_activity_at,messages.last_message_at,stages.last_stage_at)<now()-interval '7 days' then 2
    when inquiries.enquiry_count>0 and owner.owner_membership_id is null then 1
    else 0 end priority
  from connect.people p
  left join connect.contact_owners owner on owner.tenant_id=p.tenant_id and owner.person_id=p.id
  left join lateral (
   select count(*)::int enquiry_count,min(i.received_at) first_enquiry_at,max(i.received_at) last_enquiry_at
   from connect.inquiries i where i.tenant_id=p_tenant_id and
    (i.person_id=p.id or exists(select 1 from connect.opportunities o
      where o.tenant_id=p_tenant_id and o.id=i.opportunity_id and o.contact_id=p.id))
  ) inquiries on true
  left join lateral (
   select count(*) filter(where t.status='open')::int open_tasks,
    count(*) filter(where t.status='open' and t.due_at<now())::int overdue_tasks,
    min(t.due_at) filter(where t.status='open' and t.due_at>=now()) next_followup_at
   from connect.tasks t where t.tenant_id=p_tenant_id and
    (t.person_id=p.id or exists(select 1 from connect.opportunities o
      where o.tenant_id=p_tenant_id and o.id=t.opportunity_id and o.contact_id=p.id))
  ) tasks on true
  left join lateral (
   select count(*) filter(where a.status='scheduled' and a.starts_at>=now())::int upcoming_appointments
   from connect.appointments a where a.tenant_id=p_tenant_id and
    (a.person_id=p.id or exists(select 1 from connect.opportunities o
      where o.tenant_id=p_tenant_id and o.id=a.opportunity_id and o.contact_id=p.id))
  ) appointments on true
  left join lateral (
   select count(*) filter(where st.outcome='open')::int open_opportunities,
    count(*) filter(where st.outcome='won')::int won_opportunities
   from connect.opportunities o join connect.pipeline_stages st
    on st.tenant_id=o.tenant_id and st.id=o.stage_id
   where o.tenant_id=p_tenant_id and o.contact_id=p.id
  ) opp on true
  left join lateral (
   select max(a.occurred_at) last_activity_at from connect.activities a
   where a.tenant_id=p_tenant_id and (a.person_id=p.id or
    exists(select 1 from connect.opportunities o where o.tenant_id=p_tenant_id and o.id=a.opportunity_id and o.contact_id=p.id))
  ) activities on true
  left join lateral (
   select max(m.occurred_at) last_message_at from connect.messages m
   join connect.conversations c on c.tenant_id=m.tenant_id and c.id=m.conversation_id
   where m.tenant_id=p_tenant_id and c.person_id=p.id
  ) messages on true
  left join lateral (
   select max(se.changed_at) last_stage_at from connect.stage_events se
   join connect.opportunities o on o.tenant_id=se.tenant_id and o.id=se.opportunity_id
   where se.tenant_id=p_tenant_id and o.contact_id=p.id
  ) stages on true
  where p.tenant_id=p_tenant_id and p.status='active'
   and (p_person_id is null or p.id=p_person_id)
   and (p_person_id is not null or inquiries.enquiry_count>0 or coalesce(opp.open_opportunities,0)>0)
  order by priority desc,inquiries.last_enquiry_at desc nulls last,p.id
  limit least(100,greatest(1,coalesce(p_limit,30)))
 ) result;
 return jsonb_build_object('items',v_items,'asOf',now(),'scope',case when p_person_id is null then 'workspace' else 'contact' end);
end $function$;

-- public.connect_ingest_whatsapp_message(p_external_account_id text, p_message_id text, p_contact_wa_id text, p_contact_name text, p_kind text, p_body text, p_occurred_at timestamp with time zone, p_media_id text, p_media_mime_type text, p_media_filename text, p_reply_to_id text, p_direction text)
CREATE OR REPLACE FUNCTION public.connect_ingest_whatsapp_message(p_external_account_id text, p_message_id text, p_contact_wa_id text, p_contact_name text, p_kind text, p_body text, p_occurred_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_media_id text DEFAULT NULL::text, p_media_mime_type text DEFAULT NULL::text, p_media_filename text DEFAULT NULL::text, p_reply_to_id text DEFAULT NULL::text, p_direction text DEFAULT 'inbound'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_account connect.channel_accounts%rowtype; v_phone text;v_person uuid;v_conv uuid;
 v_msg uuid;v_count int;v_type text;
 v_at timestamptz;v_name text;
begin
 if p_message_id is null or length(p_message_id) not between 3 and 250 or
    p_direction not in ('inbound','outbound') then
  raise exception 'Invalid WhatsApp event' using errcode='22023';
 end if;
 v_type:=coalesce(nullif(btrim(p_kind),''),'unknown');
 if v_type not in ('text','image','video','audio','document','sticker','location','contacts','button','interactive','reaction','unknown')
 then v_type:='unknown';end if;
 if length(coalesce(p_body,''))>3000 or length(coalesce(p_media_id,''))>250 or
  length(coalesce(p_media_mime_type,''))>150 or length(coalesce(p_media_filename,''))>255 or
  length(coalesce(p_reply_to_id,''))>250 then
  raise exception 'WhatsApp content too long' using errcode='22023';
 end if;
 select count(*) into v_count from connect.channel_accounts a
 where a.provider='whatsapp' and a.external_account_id=lower(btrim(p_external_account_id))
 and a.status='active';
 if v_count<>1 then raise exception 'WhatsApp channel unavailable or ambiguous' using errcode='42501';end if;
 select a.* into v_account from connect.channel_accounts a join connect.tenants t on t.id=a.tenant_id
 where a.provider='whatsapp' and a.external_account_id=lower(btrim(p_external_account_id))
 and a.status='active' and t.status in ('trial','active') for share of a;
 if not found then raise exception 'WhatsApp channel unavailable' using errcode='42501';end if;
 v_phone:=pg_catalog.regexp_replace(coalesce(p_contact_wa_id,''),'[^0-9]','','g');
 if length(v_phone) not between 8 and 15 then raise exception 'Invalid sender number' using errcode='22023';end if;
 v_phone:='+'||v_phone;
 v_at:=case when p_occurred_at between '2000-01-01'::timestamptz and now()+interval '1 day'
 then p_occurred_at else now() end;
 v_name:=nullif(btrim(p_contact_name),'');
 if v_name is null then v_name:='WhatsApp contact';end if;
 v_name:=left(v_name,150);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_account.tenant_id::text||':'||v_phone,0));
 -- Preserve explicitly linked CRM contact on existing channel-specific conversation.
 select c.person_id into v_person from connect.conversations c
 where c.tenant_id=v_account.tenant_id and c.channel_account_id=v_account.id
 and c.external_thread_id=substring(v_phone from 2);
 if v_person is null then
 select c.person_id into v_person from connect.contact_methods c
 join connect.people p on p.tenant_id=c.tenant_id and p.id=c.person_id and p.status='active'
 where c.tenant_id=v_account.tenant_id and c.kind in ('whatsapp','mobile','phone')
 and pg_catalog.regexp_replace(c.normalized_value,'[^0-9]','','g')=substring(v_phone from 2)
 order by c.created_at,c.id limit 1;
 end if;
 if v_person is null then
  insert into connect.people(tenant_id,full_name) values(v_account.tenant_id,v_name)
  returning id into v_person;
  insert into connect.person_roles(tenant_id,person_id,role)
  values(v_account.tenant_id,v_person,'contact');
 end if;
 insert into connect.contact_methods(tenant_id,person_id,kind,normalized_value,display_value,is_primary)
 values(v_account.tenant_id,v_person,'whatsapp',v_phone,v_phone,
  not exists(select 1 from connect.contact_methods where tenant_id=v_account.tenant_id and person_id=v_person and kind='whatsapp'))
 on conflict(tenant_id,person_id,kind,normalized_value) do nothing;
 insert into connect.conversations(tenant_id,channel_account_id,person_id,external_thread_id)
 values(v_account.tenant_id,v_account.id,v_person,substring(v_phone from 2))
 on conflict(tenant_id,channel_account_id,external_thread_id) where external_thread_id is not null
 do update set person_id=excluded.person_id
 returning id into v_conv;
 insert into connect.messages(tenant_id,conversation_id,external_message_id,direction,body,
  message_type,media_id,media_mime_type,media_filename,reply_to_external_message_id,
  delivery_status,occurred_at,sent_at)
 values(v_account.tenant_id,v_conv,p_message_id,p_direction,nullif(p_body,''),
  v_type,nullif(p_media_id,''),nullif(p_media_mime_type,''),nullif(p_media_filename,''),nullif(p_reply_to_id,''),
  case when p_direction='inbound' then 'received' else 'sent' end,v_at,
  case when p_direction='outbound' then v_at else null end)
 on conflict(tenant_id,conversation_id,external_message_id) where external_message_id is not null do nothing
 returning id into v_msg;
 if v_msg is null then return jsonb_build_object('ok',true,'duplicate',true,'contactId',v_person,'conversationId',v_conv);end if;
 update connect.conversations set last_message_at=greatest(coalesce(last_message_at,v_at),v_at)
 where tenant_id=v_account.tenant_id and id=v_conv;
 -- Messages are not enquiries. A team member explicitly qualifies the thread in the inbox.
 -- Status callbacks can arrive before the outbound message has been persisted.
 if p_direction='outbound' then
  update connect.messages m set
   sent_at=coalesce((select min(e.occurred_at) from connect.whatsapp_delivery_events e where
     e.tenant_id=v_account.tenant_id and e.channel_account_id=v_account.id and e.external_message_id=p_message_id and e.status='sent'),m.sent_at),
   delivered_at=(select min(e.occurred_at) from connect.whatsapp_delivery_events e where
     e.tenant_id=v_account.tenant_id and e.channel_account_id=v_account.id and e.external_message_id=p_message_id and e.status='delivered'),
   read_at=(select min(e.occurred_at) from connect.whatsapp_delivery_events e where
     e.tenant_id=v_account.tenant_id and e.channel_account_id=v_account.id and e.external_message_id=p_message_id and e.status='read')
  where m.id=v_msg and m.tenant_id=v_account.tenant_id;
  update connect.messages m set delivery_status=
   case when m.read_at is not null then 'read' when m.delivered_at is not null then 'delivered'
   else 'sent' end where m.id=v_msg and m.tenant_id=v_account.tenant_id;
 end if;
 return jsonb_build_object('ok',true,'duplicate',false,'contactId',v_person,
  'conversationId',v_conv,'messageId',v_msg,'enquiryId',null);
end $function$;

-- public.connect_ingest_whatsapp_status(p_external_account_id text, p_message_id text, p_status text, p_occurred_at timestamp with time zone, p_failure_reason text)
CREATE OR REPLACE FUNCTION public.connect_ingest_whatsapp_status(p_external_account_id text, p_message_id text, p_status text, p_occurred_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_failure_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_account connect.channel_accounts%rowtype;v_at timestamptz;v_updated int;
begin
 if p_message_id is null or length(p_message_id) not between 3 and 250 or
 p_status not in ('sent','delivered','read','failed') or length(coalesce(p_failure_reason,''))>500
 then raise exception 'Invalid WhatsApp status event' using errcode='22023';end if;
 select a.* into v_account from connect.channel_accounts a join connect.tenants t on t.id=a.tenant_id
 where a.provider='whatsapp' and a.external_account_id=lower(btrim(p_external_account_id))
 and a.status='active' and t.status in ('trial','active');
 if not found then raise exception 'WhatsApp channel unavailable' using errcode='42501';end if;
 if (select count(*) from connect.channel_accounts where provider='whatsapp' and
  external_account_id=lower(btrim(p_external_account_id)) and status='active')<>1 then
 raise exception 'Ambiguous WhatsApp channel' using errcode='42501';end if;
 v_at:=case when p_occurred_at between '2000-01-01'::timestamptz and now()+interval '1 day'
 then p_occurred_at else now() end;
 insert into connect.whatsapp_delivery_events(tenant_id,channel_account_id,external_message_id,status,occurred_at,failure_reason)
 values(v_account.tenant_id,v_account.id,p_message_id,p_status,v_at,left(p_failure_reason,500))
 on conflict(tenant_id,channel_account_id,external_message_id,status)
 do update set occurred_at=least(connect.whatsapp_delivery_events.occurred_at,excluded.occurred_at),
 failure_reason=coalesce(connect.whatsapp_delivery_events.failure_reason,excluded.failure_reason);
 update connect.messages m set
  sent_at=case when p_status='sent' then coalesce(least(m.sent_at,v_at),v_at) else m.sent_at end,
  delivered_at=case when p_status='delivered' then coalesce(least(m.delivered_at,v_at),v_at) else m.delivered_at end,
  read_at=case when p_status='read' then coalesce(least(m.read_at,v_at),v_at) else m.read_at end,
  failed_at=case when p_status='failed' then coalesce(m.failed_at,v_at) else m.failed_at end,
  failure_reason=case when p_status='failed' then left(p_failure_reason,500) else m.failure_reason end,
  delivery_status=case when p_status='read' then 'read'
   when p_status='delivered' then case when m.delivery_status='read' then 'read' else 'delivered' end
   when p_status='sent' then case when m.delivery_status in ('read','delivered') then m.delivery_status else 'sent' end
   when p_status='failed' then case when m.delivery_status in ('read','delivered') then m.delivery_status else 'failed' end
   else m.delivery_status end
 from connect.conversations c
 where m.tenant_id=v_account.tenant_id and m.conversation_id=c.id
 and c.tenant_id=v_account.tenant_id and c.channel_account_id=v_account.id
 and m.external_message_id=p_message_id and m.direction='outbound';
 get diagnostics v_updated=row_count;
 return jsonb_build_object('ok',true,'matched',v_updated>0,'status',p_status);
end $function$;

-- public.connect_whatsapp_threads(p_actor_id uuid, p_tenant_id uuid, p_limit integer, p_before_at timestamp with time zone, p_before_id uuid)
CREATE OR REPLACE FUNCTION public.connect_whatsapp_threads(p_actor_id uuid, p_tenant_id uuid, p_limit integer DEFAULT 40, p_before_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_before_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare v_page jsonb;v_last jsonb;v_size int:=least(100,greatest(1,coalesce(p_limit,40)));v_count int;v_member uuid;
begin
 select m.id into v_member from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active' and t.status in ('active','trial');
 if v_member is null then raise exception 'Workspace access denied' using errcode='42501';end if;
 if (p_before_at is null)<>(p_before_id is null) then raise exception 'Invalid cursor' using errcode='22023';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',x.id,
  'channelId',x.channel_id,'channelName',x.channel_name,'personId',x.person_id,
  'personName',x.person_name,'phone',x.phone,'status',x.status,'assignedMemberId',x.assigned_member,
  'lastAt',x.last_at,'lastMessage',x.last_body,'lastType',x.last_type,'lastDirection',x.last_direction,
  'lastDeliveryStatus',x.last_delivery_status,'unreadCount',x.unread_count
 ) order by x.last_at desc,x.id desc),'[]'::jsonb),count(*) into v_page,v_count
 from (
  select c.id,a.id channel_id,a.display_name channel_name,c.person_id,
   coalesce(p.full_name,'Unknown contact') person_name,c.external_thread_id phone,c.status,
   c.assigned_membership_id assigned_member,
   coalesce(c.last_message_at,c.created_at) last_at,
   recent.body last_body,recent.message_type last_type,recent.direction last_direction,
   recent.delivery_status last_delivery_status,
   (select count(*)::int from connect.messages m where m.tenant_id=p_tenant_id and m.conversation_id=c.id
    and m.direction='inbound' and m.occurred_at>coalesce(state.last_read_at,'-infinity'::timestamptz)) unread_count
  from connect.conversations c join connect.channel_accounts a
   on a.tenant_id=c.tenant_id and a.id=c.channel_account_id and a.provider='whatsapp'
  left join connect.people p on p.tenant_id=c.tenant_id and p.id=c.person_id
  left join connect.whatsapp_thread_state state on state.tenant_id=c.tenant_id
   and state.conversation_id=c.id and state.member_id=v_member
  left join lateral (select m.body,m.message_type,m.direction,m.delivery_status from connect.messages m
   where m.tenant_id=c.tenant_id and m.conversation_id=c.id
   order by m.occurred_at desc,m.id desc limit 1) recent on true
  where c.tenant_id=p_tenant_id and (p_before_at is null or
   (coalesce(c.last_message_at,c.created_at),c.id)<(p_before_at,p_before_id))
  order by last_at desc,c.id desc limit v_size+1
 ) x;
 if v_count>v_size then
  v_page:=(select coalesce(jsonb_agg(z.item order by z.ord),'[]'::jsonb)
   from jsonb_array_elements(v_page) with ordinality as z(item,ord) where z.ord<=v_size);
  v_last:=v_page->(v_size-1);
  return jsonb_build_object('items',v_page,'nextCursor',
   jsonb_build_object('at',v_last->>'lastAt','id',v_last->>'id'));
 end if;
 return jsonb_build_object('items',v_page,'nextCursor',null);
end $function$;

-- public.connect_whatsapp_conversation_messages(p_actor_id uuid, p_tenant_id uuid, p_conversation_id uuid, p_limit integer, p_before_at timestamp with time zone, p_before_id uuid)
CREATE OR REPLACE FUNCTION public.connect_whatsapp_conversation_messages(p_actor_id uuid, p_tenant_id uuid, p_conversation_id uuid, p_limit integer DEFAULT 50, p_before_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_before_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare v_page jsonb;v_last jsonb;v_size int:=least(100,greatest(1,coalesce(p_limit,50)));v_count int;
begin
 if not exists(select 1 from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active'
 and t.status in ('active','trial')) then raise exception 'Workspace access denied' using errcode='42501';end if;
 if not exists(select 1 from connect.conversations c join connect.channel_accounts a
 on a.tenant_id=c.tenant_id and a.id=c.channel_account_id and a.provider='whatsapp'
 where c.tenant_id=p_tenant_id and c.id=p_conversation_id)
 then raise exception 'Conversation unavailable' using errcode='42501';end if;
 if (p_before_at is null)<>(p_before_id is null) then raise exception 'Invalid cursor' using errcode='22023';end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',x.id,'externalId',x.external_message_id,'direction',x.direction,
  'body',x.body,'kind',x.message_type,'mediaId',x.media_id,
  'mediaMimeType',x.media_mime_type,'mediaFilename',x.media_filename,
  'replyTo',x.reply_to_external_message_id,'deliveryStatus',x.delivery_status,
  'occurredAt',x.occurred_at,'sentAt',x.sent_at,'deliveredAt',x.delivered_at,
  'readAt',x.read_at,'failedAt',x.failed_at,'failureReason',x.failure_reason
 ) order by x.occurred_at desc,x.id desc),'[]'::jsonb),count(*) into v_page,v_count
 from (
  select m.* from connect.messages m where m.tenant_id=p_tenant_id and m.conversation_id=p_conversation_id
  and (p_before_at is null or (m.occurred_at,m.id)<(p_before_at,p_before_id))
  order by m.occurred_at desc,m.id desc limit v_size+1
 ) x;
 if v_count>v_size then
  v_page:=(select coalesce(jsonb_agg(z.item order by z.ord),'[]'::jsonb)
   from jsonb_array_elements(v_page) with ordinality as z(item,ord) where z.ord<=v_size);
  v_last:=v_page->(v_size-1);
  return jsonb_build_object('items',v_page,'nextCursor',
   jsonb_build_object('at',v_last->>'occurredAt','id',v_last->>'id'));
 end if;
 return jsonb_build_object('items',v_page,'nextCursor',null);
end $function$;

-- public.connect_whatsapp_manage_thread(p_actor_id uuid, p_tenant_id uuid, p_conversation_id uuid, p_action text, p_data jsonb)
CREATE OR REPLACE FUNCTION public.connect_whatsapp_manage_thread(p_actor_id uuid, p_tenant_id uuid, p_conversation_id uuid, p_action text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_member uuid;v_role text;v_target uuid;v_value text;v_link_person uuid;
begin
 select m.id,m.role into v_member,v_role from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active' and t.status in ('active','trial');
 if v_member is null then raise exception 'Workspace access denied' using errcode='42501';end if;
 if not exists(select 1 from connect.conversations c join connect.channel_accounts a
  on a.id=c.channel_account_id and a.tenant_id=c.tenant_id and a.provider='whatsapp'
  where c.tenant_id=p_tenant_id and c.id=p_conversation_id) then
  raise exception 'Conversation unavailable' using errcode='42501';end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Invalid request' using errcode='22023';end if;
 case p_action
 when 'mark_read' then
  insert into connect.whatsapp_thread_state(tenant_id,conversation_id,member_id,last_read_at)
  values(p_tenant_id,p_conversation_id,v_member,now())
  on conflict(tenant_id,conversation_id,member_id) do update
   set last_read_at=greatest(coalesce(connect.whatsapp_thread_state.last_read_at,excluded.last_read_at),excluded.last_read_at),
       updated_at=now();
 when 'save_draft' then
  if v_role='viewer' then raise exception 'Write access denied' using errcode='42501';end if;
  v_value:=coalesce(p_data->>'text','');
  if length(v_value)>3000 then raise exception 'Draft exceeds limit' using errcode='22023';end if;
  insert into connect.whatsapp_thread_state(tenant_id,conversation_id,member_id,draft_text)
  values(p_tenant_id,p_conversation_id,v_member,v_value)
  on conflict(tenant_id,conversation_id,member_id) do update
   set draft_text=excluded.draft_text,updated_at=now();
 when 'set_status' then
  if v_role='viewer' then raise exception 'Write access denied' using errcode='42501';end if;
  v_value:=p_data->>'status';
  if v_value not in ('open','pending','closed') then raise exception 'Invalid conversation status' using errcode='22023';end if;
  update connect.conversations set status=v_value where tenant_id=p_tenant_id and id=p_conversation_id;
 when 'assign' then
  if v_role not in ('owner','admin','manager') then raise exception 'Manager access required' using errcode='42501';end if;
  v_target:=nullif(p_data->>'memberId','')::uuid;
  if v_target is not null and not exists(select 1 from connect.memberships where
   tenant_id=p_tenant_id and id=v_target and status='active' and role<>'viewer') then
   raise exception 'Invalid assignee' using errcode='42501';
  end if;
  update connect.conversations set assigned_membership_id=v_target
  where tenant_id=p_tenant_id and id=p_conversation_id;
 when 'link_contact' then
  if v_role='viewer' then raise exception 'Write access denied' using errcode='42501';end if;
  v_link_person:=nullif(p_data->>'personId','')::uuid;
  if v_link_person is null or not exists(select 1 from connect.people
   where tenant_id=p_tenant_id and id=v_link_person and status='active') then
   raise exception 'Invalid contact' using errcode='22023';
  end if;
  update connect.conversations set person_id=v_link_person
  where tenant_id=p_tenant_id and id=p_conversation_id;
 else raise exception 'Unsupported action' using errcode='22023';
 end case;
 if p_action in ('assign','link_contact','set_status') then
  insert into connect.audit_events(tenant_id,actor_membership_id,event_type,entity_type,entity_id,metadata)
  values(p_tenant_id,v_member,'whatsapp_'||p_action,'conversation',p_conversation_id,
   jsonb_build_object('action',p_action));
 end if;
 return jsonb_build_object('ok',true);
end $function$;

-- public.connect_whatsapp_thread_details(p_actor_id uuid, p_tenant_id uuid, p_conversation_id uuid)
CREATE OR REPLACE FUNCTION public.connect_whatsapp_thread_details(p_actor_id uuid, p_tenant_id uuid, p_conversation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare v_member uuid;v_result jsonb;
begin
 select m.id into v_member from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active' and t.status in ('active','trial');
 if v_member is null then raise exception 'Workspace access denied' using errcode='42501';end if;
 select jsonb_build_object('conversationId',c.id,'personId',c.person_id,
  'status',c.status,'assignedMemberId',c.assigned_membership_id,
  'draft',coalesce(s.draft_text,''),'lastReadAt',s.last_read_at,
  'canWrite',m.role<>'viewer',
  'canAssign',m.role in ('owner','admin','manager'),
  'team',coalesce((select jsonb_agg(jsonb_build_object('id',tm.id,'label','Member '||left(tm.user_id::text,8),'role',tm.role)
    order by tm.user_id) from connect.memberships tm
   where tm.tenant_id=p_tenant_id and tm.status='active' and tm.role<>'viewer'),'[]'::jsonb)
 ) into v_result from connect.conversations c
 join connect.channel_accounts a on a.tenant_id=c.tenant_id and a.id=c.channel_account_id and a.provider='whatsapp'
 join connect.memberships m on m.id=v_member
 left join connect.whatsapp_thread_state s on s.tenant_id=c.tenant_id and s.conversation_id=c.id and s.member_id=v_member
 where c.tenant_id=p_tenant_id and c.id=p_conversation_id;
 if v_result is null then raise exception 'Conversation unavailable' using errcode='42501';end if;
 return v_result;
end $function$;

-- public.connect_whatsapp_contact_search(p_actor_id uuid, p_tenant_id uuid, p_query text, p_limit integer)
CREATE OR REPLACE FUNCTION public.connect_whatsapp_contact_search(p_actor_id uuid, p_tenant_id uuid, p_query text DEFAULT ''::text, p_limit integer DEFAULT 25)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare v_result jsonb;v_query text:=left(btrim(coalesce(p_query,'')),100);
begin
 if not exists(select 1 from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active' and t.status in ('active','trial'))
 then raise exception 'Workspace access denied' using errcode='42501';end if;
 if length(v_query)<2 then return '[]'::jsonb;end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'name',x.full_name,'phone',x.phone)
  order by x.full_name,x.id),'[]'::jsonb) into v_result
 from (select p.id,p.full_name,
  (select cm.display_value from connect.contact_methods cm where cm.tenant_id=p_tenant_id and cm.person_id=p.id
   and cm.kind in ('whatsapp','mobile','phone') order by cm.is_primary desc,cm.created_at limit 1) phone
  from connect.people p where p.tenant_id=p_tenant_id and p.status='active'
  and (p.full_name ilike '%'||v_query||'%' or exists(
   select 1 from connect.contact_methods cm where cm.tenant_id=p_tenant_id and cm.person_id=p.id
   and cm.normalized_value ilike '%'||v_query||'%'))
  order by p.full_name,p.id limit least(50,greatest(1,coalesce(p_limit,25)))) x;
 return v_result;
end $function$;

-- public.connect_whatsapp_reserve_test_send(p_actor_id uuid, p_tenant_id uuid, p_conversation_id uuid, p_client_request_id uuid, p_body text)
CREATE OR REPLACE FUNCTION public.connect_whatsapp_reserve_test_send(p_actor_id uuid, p_tenant_id uuid, p_conversation_id uuid, p_client_request_id uuid, p_body text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_actor uuid;v_role text;v_channel uuid;v_phone_id text;v_recipient text;
 v_request connect.whatsapp_send_requests%rowtype;v_last_inbound timestamptz;v_text text;
begin
 select m.id,m.role into v_actor,v_role from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active' and t.status in ('active','trial');
 if v_actor is null or v_role='viewer' then raise exception 'Write permission denied' using errcode='42501';end if;
 if p_client_request_id is null then raise exception 'Request ID required' using errcode='22023';end if;
 v_text:=btrim(coalesce(p_body,''));
 if length(v_text) not between 1 and 3000 then raise exception 'Enter a valid message' using errcode='22023';end if;
 -- Returning an existing request is read-only and prevents duplicate network sends.
 select * into v_request from connect.whatsapp_send_requests
 where tenant_id=p_tenant_id and conversation_id=p_conversation_id and client_request_id=p_client_request_id;
 if found then
  if v_request.actor_membership_id<>v_actor then raise exception 'Request belongs to another agent' using errcode='42501';end if;
  if v_request.body<>v_text then raise exception 'Request ID reused with another message' using errcode='22023';end if;
  return jsonb_build_object('id',v_request.id,'isNew',false,'state',v_request.state);
 end if;
 select c.channel_account_id,a.external_account_id,c.external_thread_id
 into v_channel,v_phone_id,v_recipient
 from connect.conversations c join connect.channel_accounts a
 on a.tenant_id=c.tenant_id and a.id=c.channel_account_id
 where c.tenant_id=p_tenant_id and c.id=p_conversation_id
 and a.provider='whatsapp' and a.status='active' and c.status<>'closed';
 if v_channel is null then raise exception 'Conversation not available for sending' using errcode='42501';end if;
 if v_phone_id is null or v_phone_id !~ '^[0-9]{5,25}$' or
 v_recipient is null or v_recipient !~ '^[0-9]{8,15}$'
 then raise exception 'Invalid sender or recipient' using errcode='22023';end if;
 select max(m.occurred_at) into v_last_inbound from connect.messages m
 where m.tenant_id=p_tenant_id and m.conversation_id=p_conversation_id
 and m.direction='inbound' and m.occurred_at<=now();
 if v_last_inbound is null or v_last_inbound<=now()-interval '23 hours 45 minutes' then
  raise exception 'Customer-service reply window expired' using errcode='22023';
 end if;
 insert into connect.whatsapp_send_requests(
  tenant_id,conversation_id,channel_account_id,actor_membership_id,client_request_id,destination,body
 ) values(p_tenant_id,p_conversation_id,v_channel,v_actor,p_client_request_id,v_recipient,v_text)
 on conflict(tenant_id,conversation_id,client_request_id) do nothing returning * into v_request;
 if not found then
  select * into v_request from connect.whatsapp_send_requests where
   tenant_id=p_tenant_id and conversation_id=p_conversation_id and client_request_id=p_client_request_id;
  return jsonb_build_object('id',v_request.id,'isNew',false,'state',v_request.state);
 end if;
 return jsonb_build_object('id',v_request.id,'isNew',true,'state','reserved',
  'phoneNumberId',v_phone_id,'destination',v_recipient);
end $function$;

-- public.connect_whatsapp_complete_test_send(p_actor_id uuid, p_tenant_id uuid, p_request_id uuid, p_state text, p_message_id text, p_failure_code text)
CREATE OR REPLACE FUNCTION public.connect_whatsapp_complete_test_send(p_actor_id uuid, p_tenant_id uuid, p_request_id uuid, p_state text, p_message_id text DEFAULT NULL::text, p_failure_code text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_request connect.whatsapp_send_requests%rowtype;v_actor uuid;v_message uuid;
 v_status text;v_sent timestamptz;v_delivered timestamptz;v_read timestamptz;v_failed timestamptz;
begin
 select id into v_actor from connect.memberships where
 user_id=p_actor_id and tenant_id=p_tenant_id and status='active';
 if v_actor is null then raise exception 'No active workspace membership' using errcode='42501';end if;
 select * into v_request from connect.whatsapp_send_requests where
 tenant_id=p_tenant_id and id=p_request_id for update;
 if not found or v_request.actor_membership_id<>v_actor then raise exception 'Send request unavailable' using errcode='42501';end if;
 if v_request.state<>'reserved' then
  return jsonb_build_object('ok',true,'state',v_request.state,'id',v_request.id);
 end if;
 if p_state not in ('accepted','rejected','unknown') then raise exception 'Invalid send outcome' using errcode='22023';end if;
 if p_state='accepted' and (p_message_id is null or length(p_message_id) not between 5 and 250) then
  raise exception 'Accepted send requires provider message ID' using errcode='22023';
 end if;
 update connect.whatsapp_send_requests set state=p_state,
 external_message_id=case when p_state='accepted' then p_message_id else null end,
 failure_code=left(p_failure_code,80),completed_at=now()
 where id=v_request.id;
 if p_state='accepted' then
  select min(occurred_at) filter(where status='sent'),
   min(occurred_at) filter(where status='delivered'),
   min(occurred_at) filter(where status='read'),
   min(occurred_at) filter(where status='failed')
   into v_sent,v_delivered,v_read,v_failed
  from connect.whatsapp_delivery_events where tenant_id=p_tenant_id
   and channel_account_id=v_request.channel_account_id and external_message_id=p_message_id;
  v_status:=case when v_read is not null then 'read' when v_delivered is not null then 'delivered'
   when v_failed is not null then 'failed' else 'sent' end;
  insert into connect.messages(tenant_id,conversation_id,external_message_id,direction,
   body,message_type,delivery_status,occurred_at,sent_at,delivered_at,read_at,failed_at)
  values(p_tenant_id,v_request.conversation_id,p_message_id,'outbound',
   v_request.body,'text',v_status,now(),coalesce(v_sent,now()),v_delivered,v_read,v_failed)
  on conflict(tenant_id,conversation_id,external_message_id)
   where external_message_id is not null
   do update set delivery_status=excluded.delivery_status
  returning id into v_message;
  update connect.conversations set last_message_at=greatest(coalesce(last_message_at,now()),now())
  where tenant_id=p_tenant_id and id=v_request.conversation_id;
 end if;
 return jsonb_build_object('ok',true,'state',p_state,'id',v_request.id,'messageId',v_message);
end $function$;

-- public.connect_whatsapp_test_reply_context(p_actor_id uuid, p_tenant_id uuid, p_conversation_id uuid)
CREATE OR REPLACE FUNCTION public.connect_whatsapp_test_reply_context(p_actor_id uuid, p_tenant_id uuid, p_conversation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare v_role text;v_phone_id text;v_recipient text;v_latest timestamptz;
begin
 select m.role into v_role from connect.memberships m
 join connect.tenants t on t.id=m.tenant_id where
 m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active'
 and t.status in ('trial','active');
 if v_role is null then raise exception 'Workspace access denied' using errcode='42501';end if;
 select a.external_account_id,c.external_thread_id into v_phone_id,v_recipient
 from connect.conversations c join connect.channel_accounts a on
 a.tenant_id=c.tenant_id and a.id=c.channel_account_id
 where c.tenant_id=p_tenant_id and c.id=p_conversation_id and a.provider='whatsapp'
 and a.status='active' and c.status<>'closed';
 if not found then return jsonb_build_object('canReply',false,'reason','Conversation is closed or sender channel inactive');end if;
 select max(m.occurred_at) into v_latest from connect.messages m
 where m.tenant_id=p_tenant_id and m.conversation_id=p_conversation_id
 and m.direction='inbound' and m.occurred_at<=now();
 return jsonb_build_object('canReply',
 v_role<>'viewer' and v_recipient~'^[0-9]{8,15}$' and
 v_latest is not null and v_latest>now()-interval '23 hours 45 minutes',
 'phoneNumberId',v_phone_id,'recipient',v_recipient,
 'lastInboundAt',v_latest,
 'reason',case
 when v_role='viewer' then 'Viewer access is read-only'
 when v_recipient is null or v_recipient!~'^[0-9]{8,15}$' then 'Missing valid recipient'
 when v_latest is null or v_latest<=now()-interval '23 hours 45 minutes' then 'No recent inbound customer message'
 else null end);
end $function$;

-- connect.whatsapp_send_test_rate_guard()
CREATE OR REPLACE FUNCTION connect.whatsapp_send_test_rate_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_conversation_count int;v_workspace_count int;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  new.tenant_id::text||':whatsapp-test-send:'||new.conversation_id::text,0));
 select count(*) into v_conversation_count from connect.whatsapp_send_requests
 where tenant_id=new.tenant_id and conversation_id=new.conversation_id
 and created_at>now()-interval '1 minute';
 if v_conversation_count>=5 then
  raise exception 'Test conversation send rate limit reached' using errcode='22023';
 end if;
 select count(*) into v_workspace_count from connect.whatsapp_send_requests
 where tenant_id=new.tenant_id and created_at>now()-interval '1 hour';
 if v_workspace_count>=100 then
  raise exception 'Test workspace send rate limit reached' using errcode='22023';
 end if;
 return new;
end $function$;

-- public.connect_sync_whatsapp_app_contact(p_external_account_id text, p_phone text, p_name text, p_action text, p_occurred_at timestamp with time zone)
CREATE OR REPLACE FUNCTION public.connect_sync_whatsapp_app_contact(p_external_account_id text, p_phone text, p_name text, p_action text, p_occurred_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare a connect.channel_accounts%rowtype; v_phone text; v_at timestamptz; v_updated int;v_person uuid;
begin
 if p_action not in ('add','remove') or p_occurred_at is null or
    p_occurred_at not between '2000-01-01'::timestamptz and now()+interval '1 day' then
  raise exception 'Invalid contact sync event' using errcode='22023';end if;
 select c.* into a from connect.channel_accounts c join connect.tenants t on t.id=c.tenant_id
 where c.provider='whatsapp' and c.external_account_id=lower(btrim(p_external_account_id))
 and c.status='active' and t.status in ('trial','active');
 if not found then raise exception 'Unregistered WhatsApp channel' using errcode='42501';end if;
 v_phone:='+'||pg_catalog.regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
 if v_phone !~ '^\+[0-9]{8,15}$' or length(coalesce(p_name,''))>150 then
  raise exception 'Invalid contact sync details' using errcode='22023';end if;
 v_at:=p_occurred_at;
 insert into connect.whatsapp_app_contacts
  (tenant_id,channel_account_id,phone,display_name,last_event_at,present_in_app)
 values(a.tenant_id,a.id,v_phone,nullif(btrim(p_name),''),v_at,p_action='add')
 on conflict(tenant_id,channel_account_id,phone) do update set
  display_name=case when excluded.present_in_app then excluded.display_name else connect.whatsapp_app_contacts.display_name end,
  present_in_app=excluded.present_in_app,last_event_at=excluded.last_event_at,updated_at=now()
 where connect.whatsapp_app_contacts.last_event_at<excluded.last_event_at;
 get diagnostics v_updated=row_count;
 if v_updated>0 and p_action='add' then
  -- Contacts appear in CRM, but never overwrite manually edited CRM identities.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.tenant_id::text||':'||v_phone,0));
  select cm.person_id into v_person from connect.contact_methods cm
  join connect.people p on p.id=cm.person_id and p.tenant_id=cm.tenant_id and p.status='active'
  where cm.tenant_id=a.tenant_id and cm.kind in ('whatsapp','mobile','phone')
  and pg_catalog.regexp_replace(cm.normalized_value,'[^0-9]','','g')=substring(v_phone from 2)
  order by cm.created_at,cm.id limit 1;
  if v_person is null then
   insert into connect.people(tenant_id,full_name)
   values(a.tenant_id,coalesce(nullif(btrim(p_name),''),'WhatsApp contact')) returning id into v_person;
   insert into connect.person_roles(tenant_id,person_id,role) values(a.tenant_id,v_person,'contact');
   insert into connect.contact_methods(tenant_id,person_id,kind,normalized_value,display_value,is_primary)
   values(a.tenant_id,v_person,'whatsapp',v_phone,v_phone,true);
  end if;
 end if;
 -- A removal never deletes an existing CRM contact or its conversations.
 return jsonb_build_object('ok',true,'applied',v_updated>0);
end $function$;

-- public.connect_revise_whatsapp_message(p_external_account_id text, p_original_message_id text, p_event_id text, p_contact_wa_id text, p_action text, p_body text, p_occurred_at timestamp with time zone)
CREATE OR REPLACE FUNCTION public.connect_revise_whatsapp_message(p_external_account_id text, p_original_message_id text, p_event_id text, p_contact_wa_id text, p_action text, p_body text, p_occurred_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare a connect.channel_accounts%rowtype;v_phone text;v_updated int;
begin
 if p_action not in ('edit','revoke') or length(coalesce(p_event_id,'')) not between 3 and 250 or
  length(coalesce(p_original_message_id,'')) not between 3 and 250 or length(coalesce(p_body,''))>3000 or
  p_occurred_at is null or p_occurred_at not between '2000-01-01'::timestamptz and now()+interval '1 day' then
  raise exception 'Invalid WhatsApp revision' using errcode='22023';end if;
 select c.* into a from connect.channel_accounts c join connect.tenants t on t.id=c.tenant_id
 where c.provider='whatsapp' and c.external_account_id=lower(btrim(p_external_account_id))
 and c.status='active' and t.status in ('trial','active');
 if not found then raise exception 'Unregistered WhatsApp channel' using errcode='42501';end if;
 v_phone:=pg_catalog.regexp_replace(coalesce(p_contact_wa_id,''),'[^0-9]','','g');
 if length(v_phone) not between 8 and 15 then raise exception 'Invalid WhatsApp contact' using errcode='22023';end if;
 update connect.messages m set
  original_body=coalesce(m.original_body,m.body),
  message_type=case when p_action='revoke' then 'revoked' else m.message_type end,
  body=case when p_action='revoke' then null else nullif(btrim(p_body),'') end,
  edited_at=case when p_action='edit' then p_occurred_at else m.edited_at end,
  revoked_at=case when p_action='revoke' then p_occurred_at else m.revoked_at end,
  last_revision_at=p_occurred_at
 from connect.conversations c where c.id=m.conversation_id and c.tenant_id=a.tenant_id
  and c.channel_account_id=a.id and c.external_thread_id=v_phone
  and m.tenant_id=a.tenant_id and m.external_message_id=p_original_message_id
  and (m.last_revision_at is null or m.last_revision_at<p_occurred_at)
  and m.revoked_at is null;
 get diagnostics v_updated=row_count;
 if v_updated=0 and not exists(
  select 1 from connect.messages m join connect.conversations c on c.id=m.conversation_id
  where m.tenant_id=a.tenant_id and c.tenant_id=a.tenant_id and c.channel_account_id=a.id
   and c.external_thread_id=v_phone and m.external_message_id=p_original_message_id
 ) then raise exception 'Original message not yet available' using errcode='P0002';end if;
 return jsonb_build_object('ok',true,'applied',v_updated>0);
end $function$;

-- public.connect_import_whatsapp_history_thread(p_external_account_id text, p_contact_wa_id text, p_messages jsonb)
CREATE OR REPLACE FUNCTION public.connect_import_whatsapp_history_thread(p_external_account_id text, p_contact_wa_id text, p_messages jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare a connect.channel_accounts%rowtype; v_phone text; v_person uuid;v_count int:=0;
 m jsonb;v_direction text;v_time timestamptz;v_id text;v_kind text;v_body text;v_result jsonb;
begin
 if jsonb_typeof(p_messages) is distinct from 'array' then
  raise exception 'Invalid history thread batch' using errcode='22023';end if;
 if jsonb_array_length(p_messages)>200 then
  raise exception 'Invalid history thread batch' using errcode='22023';end if;
 select c.* into a from connect.channel_accounts c join connect.tenants t on t.id=c.tenant_id
 where c.provider='whatsapp' and c.external_account_id=lower(btrim(p_external_account_id))
 and c.status='active' and t.status in ('trial','active');
 if not found then raise exception 'Unregistered WhatsApp channel' using errcode='42501';end if;
 v_phone:='+'||pg_catalog.regexp_replace(coalesce(p_contact_wa_id,''),'[^0-9]','','g');
 if v_phone !~ '^\+[0-9]{8,15}$' then raise exception 'Invalid history recipient' using errcode='22023';end if;
 -- Ensure a historical inbound cannot create a brand-new active sales enquiry.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.tenant_id::text||':'||v_phone,0));
 select cm.person_id into v_person from connect.contact_methods cm
 join connect.people p on p.id=cm.person_id and p.tenant_id=cm.tenant_id and p.status='active'
 where cm.tenant_id=a.tenant_id and cm.kind in ('whatsapp','mobile','phone')
 and pg_catalog.regexp_replace(cm.normalized_value,'[^0-9]','','g')=substring(v_phone from 2)
 order by cm.created_at,cm.id limit 1;
 if v_person is null then
  insert into connect.people(tenant_id,full_name) values(a.tenant_id,'WhatsApp contact') returning id into v_person;
  insert into connect.person_roles(tenant_id,person_id,role) values(a.tenant_id,v_person,'contact');
  insert into connect.contact_methods(tenant_id,person_id,kind,normalized_value,display_value,is_primary)
  values(a.tenant_id,v_person,'whatsapp',v_phone,v_phone,true);
 end if;
 for m in select value from jsonb_array_elements(p_messages) loop
  v_id:=m->>'id';v_kind:=coalesce(nullif(m->>'type',''),'unknown');
  if v_id is null or length(v_id) not between 3 and 250 or
     coalesce(m->>'timestamp','') !~ '^[0-9]{10,11}$' then
   raise exception 'Invalid historical message' using errcode='22023';end if;
  v_time:=to_timestamp((m->>'timestamp')::double precision);
  if v_time not between now()-interval '190 days' and now()+interval '1 day' then
   raise exception 'Historical message outside allowed window' using errcode='22023';end if;
  v_direction:=case when m ? 'to' then 'outbound' else 'inbound' end;
  if v_direction='inbound' and
   pg_catalog.regexp_replace(coalesce(m->>'from',''),'[^0-9]','','g')<>substring(v_phone from 2) then
   raise exception 'Historical sender mismatch' using errcode='22023';end if;
  if v_direction='outbound' and
   pg_catalog.regexp_replace(coalesce(m->>'to',''),'[^0-9]','','g')<>substring(v_phone from 2) then
   raise exception 'Historical recipient mismatch' using errcode='22023';end if;
  v_body:=case when v_kind='text' then m#>>'{text,body}' else
    coalesce(m#>>array[v_kind,'caption'],'') end;
  v_result:=public.connect_ingest_whatsapp_message(p_external_account_id,v_id,
   substring(v_phone from 2),'WhatsApp contact',v_kind,left(coalesce(v_body,''),3000),v_time,
   left(coalesce(m#>>array[v_kind,'id'],''),250),left(coalesce(m#>>array[v_kind,'mime_type'],''),150),
   left(coalesce(m#>>array[v_kind,'filename'],''),255),left(coalesce(m#>>'{context,id}',''),250),v_direction);
  if (v_result->>'messageId') is not null then
   update connect.messages set is_historical=true
   where tenant_id=a.tenant_id and id=(v_result->>'messageId')::uuid;
  end if;
  if not coalesce((v_result->>'duplicate')::boolean,false) then v_count:=v_count+1;end if;
 end loop;
 return jsonb_build_object('ok',true,'imported',v_count);
end $function$;

-- public.connect_whatsapp_connection_health(p_actor_id uuid, p_tenant_id uuid)
CREATE OR REPLACE FUNCTION public.connect_whatsapp_connection_health(p_actor_id uuid, p_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare v_result jsonb;
begin
 if not exists(select 1 from connect.memberships m join connect.tenants t on t.id=m.tenant_id
  where m.tenant_id=p_tenant_id and m.user_id=p_actor_id and m.status='active'
  and t.status in ('active','trial')) then
  raise exception 'Workspace access denied' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'channelId',a.id,'name',a.display_name,'status',a.status,
  'syncContacts',coalesce((select count(*) from connect.whatsapp_app_contacts x
   where x.tenant_id=a.tenant_id and x.channel_account_id=a.id and x.present_in_app),0),
  'historicalMessages',coalesce((select count(*) from connect.messages m
   join connect.conversations c on c.id=m.conversation_id and c.tenant_id=m.tenant_id
   where c.tenant_id=a.tenant_id and c.channel_account_id=a.id and m.is_historical),0),
  'lastMessageAt',(select max(c.last_message_at) from connect.conversations c
   where c.tenant_id=a.tenant_id and c.channel_account_id=a.id)
 ) order by a.display_name),'[]'::jsonb) into v_result
 from connect.channel_accounts a where a.tenant_id=p_tenant_id and a.provider='whatsapp';
 return v_result;
end $function$;

-- public.connect_queue_whatsapp_history(p_external_account_id text, p_fingerprint text, p_payload jsonb)
CREATE OR REPLACE FUNCTION public.connect_queue_whatsapp_history(p_external_account_id text, p_fingerprint text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare a connect.channel_accounts%rowtype;v_id uuid;v_new boolean;
begin
 if p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$' or
  jsonb_typeof(p_payload) is distinct from 'object' or
  jsonb_typeof(p_payload->'threads') is distinct from 'array' or
  jsonb_array_length(p_payload->'threads')>500 or
  octet_length(p_payload::text)>8000000 then
  raise exception 'Invalid history queue payload' using errcode='22023';end if;
 select c.* into a from connect.channel_accounts c join connect.tenants t on t.id=c.tenant_id
 where c.provider='whatsapp' and c.external_account_id=lower(btrim(p_external_account_id))
 and c.status='active' and t.status in ('active','trial');
 if not found then raise exception 'Unregistered WhatsApp channel' using errcode='42501';end if;
 insert into connect.whatsapp_history_jobs(tenant_id,channel_account_id,fingerprint,payload)
 values(a.tenant_id,a.id,p_fingerprint,p_payload)
 on conflict(tenant_id,channel_account_id,fingerprint) do nothing returning id into v_id;
 v_new:=v_id is not null;
 if not v_new then
  select id into v_id from connect.whatsapp_history_jobs where tenant_id=a.tenant_id
  and channel_account_id=a.id and fingerprint=p_fingerprint;
 end if;
 return jsonb_build_object('ok',true,'jobId',v_id,'queued',v_new);
end $function$;

-- public.connect_claim_whatsapp_history_jobs(p_limit integer)
CREATE OR REPLACE FUNCTION public.connect_claim_whatsapp_history_jobs(p_limit integer DEFAULT 2)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_jobs jsonb;
begin
 if p_limit not between 1 and 5 then raise exception 'Invalid worker batch' using errcode='22023';end if;
 with claim as (
  select j.id from connect.whatsapp_history_jobs j
  where (j.state in ('pending','retry') and j.next_attempt_at<=now())
  or (j.state='processing' and j.lease_until<now())
  order by j.created_at,j.id limit p_limit for update skip locked
 ), claimed as (
  update connect.whatsapp_history_jobs j set state='processing',
  attempts=j.attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes',
  updated_at=now() from claim where j.id=claim.id
  returning j.id,j.lease_token,j.payload,j.thread_index,j.message_index,j.processed_messages,
   (select external_account_id from connect.channel_accounts a where a.id=j.channel_account_id and a.tenant_id=j.tenant_id) phone_id
 ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'leaseToken',lease_token,
  'payload',payload,'threadIndex',thread_index,'messageIndex',message_index,
  'processedMessages',processed_messages,'phoneId',phone_id)),'[]'::jsonb)
 into v_jobs from claimed;
 return v_jobs;
end $function$;

-- public.connect_advance_whatsapp_history_job(p_id uuid, p_lease_token uuid, p_thread_index integer, p_message_index integer, p_imported integer, p_completed boolean)
CREATE OR REPLACE FUNCTION public.connect_advance_whatsapp_history_job(p_id uuid, p_lease_token uuid, p_thread_index integer, p_message_index integer, p_imported integer, p_completed boolean DEFAULT false)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_count int;
begin
 if p_thread_index<0 or p_message_index<0 or p_imported<0 then
  raise exception 'Invalid history progress' using errcode='22023';end if;
 update connect.whatsapp_history_jobs set thread_index=p_thread_index,message_index=p_message_index,
  processed_messages=processed_messages+p_imported,
  state=case when p_completed then 'completed' else 'processing' end,
  lease_until=case when p_completed then null else now()+interval '2 minutes' end,
  lease_token=case when p_completed then null else lease_token end,
  payload=case when p_completed then '{}'::jsonb else payload end,
  updated_at=now()
 where id=p_id and state='processing' and lease_token=p_lease_token and lease_until>now()
 and (thread_index<p_thread_index or (thread_index=p_thread_index and message_index<=p_message_index));
 get diagnostics v_count=row_count;
 return v_count=1;
end $function$;

-- public.connect_fail_whatsapp_history_job(p_id uuid, p_lease_token uuid, p_code text)
CREATE OR REPLACE FUNCTION public.connect_fail_whatsapp_history_job(p_id uuid, p_lease_token uuid, p_code text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_count int;
begin
 if p_code not in ('BAD_HISTORY_PAYLOAD','HISTORY_IMPORT_FAILED','HISTORY_DB_UNAVAILABLE','HISTORY_WORKER_TIMEOUT') then
  raise exception 'Invalid error code' using errcode='22023';end if;
 update connect.whatsapp_history_jobs set
  state=case when attempts>=5 then 'failed' else 'retry' end,
  next_attempt_at=now()+make_interval(mins=>least(60,2^least(attempts,5))::integer),
  lease_token=null,lease_until=null,last_error_code=p_code,updated_at=now()
 where id=p_id and state='processing' and lease_token=p_lease_token;
 get diagnostics v_count=row_count;return v_count=1;
end $function$;

-- public.connect_whatsapp_history_queue_health(p_actor_id uuid, p_tenant_id uuid)
CREATE OR REPLACE FUNCTION public.connect_whatsapp_history_queue_health(p_actor_id uuid, p_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 select coalesce(jsonb_agg(jsonb_build_object('channelId',a.id,
  'pending',coalesce(q.pending,0),'processing',coalesce(q.processing,0),
  'failed',coalesce(q.failed,0),'completed',coalesce(q.completed,0),
  'lastError',q.last_error)),'[]'::jsonb)
 from connect.channel_accounts a left join lateral (
  select count(*) filter(where state in ('pending','retry')) pending,
   count(*) filter(where state='processing') processing,
   count(*) filter(where state='failed') failed,
   count(*) filter(where state='completed') completed,
   max(last_error_code) filter(where state='failed') last_error
  from connect.whatsapp_history_jobs j where j.tenant_id=a.tenant_id and j.channel_account_id=a.id
 ) q on true
 where a.tenant_id=p_tenant_id and a.provider='whatsapp' and exists(
  select 1 from connect.memberships m join connect.tenants t on t.id=m.tenant_id
  where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active'
  and t.status in ('active','trial'))
$function$;

-- public.connect_cleanup_whatsapp_history_jobs()
CREATE OR REPLACE FUNCTION public.connect_cleanup_whatsapp_history_jobs()
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_deleted integer;
begin
 delete from connect.whatsapp_history_jobs where
  (state='completed' and updated_at<now()-interval '7 days') or
  (state='failed' and updated_at<now()-interval '30 days');
 get diagnostics v_deleted=row_count;return v_deleted;
end $function$;

-- public.connect_calendar_list(p_actor_id uuid, p_tenant_id uuid)
CREATE OR REPLACE FUNCTION public.connect_calendar_list(p_actor_id uuid, p_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare v_member uuid;v_result jsonb;
begin
 select m.id into v_member from connect.memberships m
 join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active' and t.status in ('active','trial');
 if v_member is null then raise exception 'Workspace read access denied' using errcode='42501'; end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.starts_at,x.id),'[]'::jsonb) into v_result
 from (select a.id,a.title,a.kind,a.status,a.person_id,a.opportunity_id,
 a.owner_membership_id,a.starts_at,a.ends_at,a.location,a.meeting_url,a.notes,a.programme,a.version,a.updated_at
 from connect.appointments a where a.tenant_id=p_tenant_id order by a.starts_at,a.id limit 500) x;
 return jsonb_build_object('items',v_result);
end $function$;

-- public.connect_calendar_save(p_actor_id uuid, p_tenant_id uuid, p_data jsonb)
CREATE OR REPLACE FUNCTION public.connect_calendar_save(p_actor_id uuid, p_tenant_id uuid, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_member uuid;v_role text;v_id uuid;v_person uuid;v_opportunity uuid;v_owner uuid;
 v_starts timestamptz;v_ends timestamptz;v_title text;v_kind text;v_location text;v_meeting text;v_notes text;v_programme text;
begin
 select m.id,m.role into v_member,v_role from connect.memberships m
 join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active' and t.status in ('active','trial');
 if v_member is null or v_role='viewer' then raise exception 'Calendar write access denied' using errcode='42501';end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Invalid calendar payload' using errcode='22023';end if;
 v_id:=nullif(p_data->>'id','')::uuid;
 v_title:=nullif(btrim(p_data->>'title'),'');
 v_kind:=p_data->>'kind';
 v_person:=nullif(p_data->>'personId','')::uuid;
 v_opportunity:=nullif(p_data->>'opportunityId','')::uuid;
 v_owner:=nullif(p_data->>'ownerMemberId','')::uuid;
 v_location:=nullif(btrim(p_data->>'location'),'');
 v_meeting:=nullif(btrim(p_data->>'meetingUrl'),'');
 v_notes:=nullif(btrim(p_data->>'notes'),'');
 v_programme:=nullif(btrim(p_data->>'programme'),'');
 if v_title is null or length(v_title)>250 or v_kind not in ('counselling','demo','trial','meeting') then
  raise exception 'Invalid title or appointment type' using errcode='22023';end if;
 if v_person is null and v_opportunity is null then raise exception 'Contact or admission required' using errcode='22023';end if;
 if (v_location is not null and length(v_location)>250) or (v_notes is not null and length(v_notes)>2000)
   or (v_programme is not null and length(v_programme)>160) or
   (v_meeting is not null and (length(v_meeting)>500 or v_meeting !~* '^https://[^[:space:]]+$')) then
  raise exception 'Invalid appointment details' using errcode='22023';end if;
 if v_person is not null and not exists(select 1 from connect.people where id=v_person and tenant_id=p_tenant_id and status='active') then
  raise exception 'Contact is not in this workspace' using errcode='42501';end if;
 if v_opportunity is not null and not exists(select 1 from connect.opportunities where id=v_opportunity and tenant_id=p_tenant_id) then
  raise exception 'Admission is not in this workspace' using errcode='42501';end if;
 if v_owner is not null and not exists(select 1 from connect.memberships where id=v_owner and tenant_id=p_tenant_id and status='active') then
  raise exception 'Assigned staff member is not active' using errcode='42501';end if;
 if v_owner is not null and v_owner<>v_member and v_role not in ('owner','admin','manager') then
  raise exception 'Staff assignment requires manager access' using errcode='42501';end if;
 begin
  v_starts:=(p_data->>'startsAt')::timestamptz;
  v_ends:=(p_data->>'endsAt')::timestamptz;
 exception when others then raise exception 'Invalid appointment dates' using errcode='22023';end;
 if v_starts is null or v_ends is null or v_starts>=v_ends or v_ends>v_starts+interval '24 hours' then
  raise exception 'Appointment must end after it starts, within 24 hours' using errcode='22023';end if;
 if v_id is null then
  insert into connect.appointments(tenant_id,person_id,opportunity_id,owner_membership_id,title,kind,starts_at,ends_at,
   location,meeting_url,notes,programme)
  values(p_tenant_id,v_person,v_opportunity,coalesce(v_owner,v_member),v_title,v_kind,v_starts,v_ends,
   v_location,v_meeting,v_notes,v_programme) returning id into v_id;
 else
  update connect.appointments a set person_id=v_person,opportunity_id=v_opportunity,
    owner_membership_id=coalesce(v_owner,a.owner_membership_id),title=v_title,kind=v_kind,
    starts_at=v_starts,ends_at=v_ends,location=v_location,meeting_url=v_meeting,
    notes=v_notes,programme=v_programme,version=a.version+1,updated_at=now()
  where a.id=v_id and a.tenant_id=p_tenant_id and a.status='scheduled'
   and (a.owner_membership_id=v_member or v_role in ('owner','admin','manager'))
   and a.version=(p_data->>'version')::integer;
  if not found then raise exception 'Appointment changed or unavailable' using errcode='40001';end if;
 end if;
 insert into connect.audit_events(tenant_id,actor_membership_id,event_type,entity_type,entity_id,metadata)
 values(p_tenant_id,v_member,case when p_data->>'id' is null then 'create_appointment' else 'edit_appointment' end,
 'appointment',v_id,jsonb_build_object('calendar',true));
 return jsonb_build_object('ok',true,'id',v_id);
end $function$;

-- public.connect_contacts_import(p_actor_id uuid, p_tenant_id uuid, p_action text, p_data jsonb)
CREATE OR REPLACE FUNCTION public.connect_contacts_import(p_actor_id uuid, p_tenant_id uuid, p_action text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
 v_member uuid;v_role text;v_batch connect.contact_import_batches%rowtype;
 v_item jsonb;v_items jsonb;v_row integer;v_name text;v_phone text;v_mail text;
 v_dial text;v_digits text;v_id uuid;v_phone_ids uuid[];v_mail_ids uuid[];
 v_candidates uuid[];v_result text;v_reason text;v_created integer:=0;
 v_existing integer:=0;v_skipped integer:=0;v_count integer;
begin
 select m.id,m.role into v_member,v_role from connect.memberships m
 join connect.tenants t on t.id=m.tenant_id
 where m.tenant_id=p_tenant_id and m.user_id=p_actor_id and m.status='active'
   and t.status in ('active','trial');
 if v_member is null then raise exception 'Workspace access denied' using errcode='42501';end if;
 if p_action='history' then
  return jsonb_build_object('items',coalesce((
   select jsonb_agg(to_jsonb(q) order by q.created_at desc)
   from (select b.id,b.file_name,b.source_type,b.source_label,b.status,b.created_at,
    count(i.id) as processed,
    count(i.id) filter(where i.result='created') as created,
    count(i.id) filter(where i.result='existing') as existing,
    count(i.id) filter(where i.result='skipped') as skipped
    from connect.contact_import_batches b
    left join connect.contact_import_items i on i.tenant_id=b.tenant_id and i.batch_id=b.id
    where b.tenant_id=p_tenant_id
    group by b.id order by b.created_at desc limit 20) q
  ),'[]'::jsonb));
 end if;
 if v_role not in ('owner','admin','manager') then
  raise exception 'Bulk imports require workspace management access' using errcode='42501';
 end if;
 if p_action='start' then
  if length(coalesce(p_data->>'fileName','')) not between 1 and 160 or
    length(coalesce(p_data->>'sourceLabel','')) not between 1 and 120 or
    coalesce(p_data->>'sourceType','') not in ('own','event','referral','directory','purchased','other') then
    raise exception 'Invalid import details' using errcode='22023';
  end if;
  insert into connect.contact_import_batches(tenant_id,actor_membership_id,file_name,source_type,source_label)
   values(p_tenant_id,v_member,p_data->>'fileName',p_data->>'sourceType',p_data->>'sourceLabel')
   returning * into v_batch;
  insert into connect.audit_events(tenant_id,actor_membership_id,event_type,entity_type,entity_id,metadata)
   values(p_tenant_id,v_member,'contact_import_started','contact_import',v_batch.id,jsonb_build_object('sourceType',v_batch.source_type));
  return jsonb_build_object('ok',true,'id',v_batch.id);
 end if;
 if p_action not in ('chunk','finish') then
  raise exception 'Invalid import operation' using errcode='22023';
 end if;
 select * into v_batch from connect.contact_import_batches
 where id=nullif(p_data->>'batchId','')::uuid and tenant_id=p_tenant_id for update;
 if not found then raise exception 'Import batch not found' using errcode='42501';end if;
 if p_action='finish' then
  update connect.contact_import_batches set status='finished',finished_at=now()
   where tenant_id=p_tenant_id and id=v_batch.id;
  insert into connect.audit_events(tenant_id,actor_membership_id,event_type,entity_type,entity_id,metadata)
   values(p_tenant_id,v_member,'contact_import_finished','contact_import',v_batch.id,'{}'::jsonb);
  return jsonb_build_object('ok',true,'id',v_batch.id);
 end if;
 if v_batch.status<>'open' or jsonb_typeof(p_data->'rows')<>'array' or
  jsonb_array_length(p_data->'rows') not between 1 and 50 then
  raise exception 'Invalid import chunk' using errcode='22023';
 end if;
 for v_item in select value from jsonb_array_elements(p_data->'rows') loop
  if jsonb_typeof(v_item)<>'object' or (v_item->>'rowNumber')!~'^[0-9]{1,6}$' then
   raise exception 'Invalid import row' using errcode='22023';
  end if;
  v_row:=(v_item->>'rowNumber')::integer;
  if exists(select 1 from connect.contact_import_items where tenant_id=p_tenant_id and batch_id=v_batch.id and row_number=v_row)
   then continue;end if;
  v_name:=left(btrim(coalesce(v_item->>'name','')),150);
  v_phone:=btrim(coalesce(v_item->>'phone',''));
  v_mail:=lower(btrim(coalesce(v_item->>'email','')));
  v_digits:=regexp_replace(v_phone,'[^0-9]','','g');
  v_result:='created';v_reason:=null;v_id:=null;
  if v_phone<>'' and (length(v_digits)<7 or length(v_digits)>15 or length(v_phone)>35) then
    v_result:='skipped';v_reason:='Invalid phone number';
  elsif v_mail<>'' and (length(v_mail)>254 or v_mail!~'^[^ @]+@[^ @]+\.[^ @]+$') then
    v_result:='skipped';v_reason:='Invalid email';
  elsif v_digits='' and v_mail='' then
    v_result:='skipped';v_reason:='Phone or email required';
  end if;
  v_dial:=regexp_replace(coalesce(p_data->>'countryCode','91'),'[^0-9]','','g');
  if length(v_dial) not between 1 and 4 then raise exception 'Invalid country calling code' using errcode='22023';end if;
  if v_digits<>'' and length(v_digits)=10 then v_digits:=v_dial||v_digits;end if;
  if v_name='' and v_digits<>'' then v_name:='Contact '||right(v_digits,4);
  elsif v_name='' then v_name:=split_part(v_mail,'@',1);end if;
  if v_result<>'skipped' then
   -- Match by exact normalized identifiers. Conflicting phone/email identities are not merged.
   select array_agg(distinct cm.person_id) into v_phone_ids
   from connect.contact_methods cm join connect.people p on p.id=cm.person_id and p.tenant_id=cm.tenant_id
   where cm.tenant_id=p_tenant_id and p.status='active' and cm.kind in ('mobile','phone','whatsapp')
    and regexp_replace(cm.normalized_value,'[^0-9]','','g') in (v_digits,right(v_digits,10))
    and v_digits<>'';
   select array_agg(distinct cm.person_id) into v_mail_ids
   from connect.contact_methods cm join connect.people p on p.id=cm.person_id and p.tenant_id=cm.tenant_id
   where cm.tenant_id=p_tenant_id and p.status='active' and cm.kind='email' and lower(cm.normalized_value)=v_mail and v_mail<>'';
   select array_agg(distinct id) into v_candidates from
   (select unnest(coalesce(v_phone_ids,array[]::uuid[])) as id
    union select unnest(coalesce(v_mail_ids,array[]::uuid[])) as id) q;
   if coalesce(array_length(v_candidates,1),0)>1 then
    v_result:='skipped';v_reason:='Conflicting or shared identifiers require manual review';
   elsif coalesce(array_length(v_candidates,1),0)=1 then
    v_id:=v_candidates[1];v_result:='existing';
   else
    insert into connect.people(tenant_id,full_name) values(p_tenant_id,v_name) returning id into v_id;
    insert into connect.person_roles(tenant_id,person_id,role) values(p_tenant_id,v_id,'contact');
    if v_digits<>'' then
     insert into connect.contact_methods(tenant_id,person_id,kind,normalized_value,display_value,is_primary)
      values(p_tenant_id,v_id,'mobile',v_digits,case when left(v_phone,1)='+' then v_phone else '+'||v_digits end,true);
    end if;
    if v_mail<>'' then
     insert into connect.contact_methods(tenant_id,person_id,kind,normalized_value,display_value,is_primary)
      values(p_tenant_id,v_id,'email',v_mail,v_mail,true);
    end if;
    -- A newly imported contact is not marketing-eligible without separate verified opt-in.
    insert into connect.contact_marketing_permissions(tenant_id,person_id,channel,status)
     values(p_tenant_id,v_id,'whatsapp','unknown') on conflict do nothing;
   end if;
   if v_id is not null then
    insert into connect.contact_import_details(tenant_id,person_id,source_batch_id,company,city,notes,tags,source_reference)
    values(p_tenant_id,v_id,v_batch.id,left(nullif(v_item->>'company',''),150),
     left(nullif(v_item->>'city',''),120),left(nullif(v_item->>'notes',''),1000),
     array(select left(value,50) from jsonb_array_elements_text(
      case when jsonb_typeof(v_item->'tags')='array' then v_item->'tags' else '[]'::jsonb end) limit 15),
     left(nullif(v_item->>'sourceReference',''),250))
    on conflict do nothing;
   end if;
  end if;
  insert into connect.contact_import_items(tenant_id,batch_id,row_number,person_id,result,reason)
  values(p_tenant_id,v_batch.id,v_row,v_id,v_result,v_reason);
  if v_result='created' then v_created:=v_created+1;
  elsif v_result='existing' then v_existing:=v_existing+1;
  else v_skipped:=v_skipped+1;end if;
 end loop;
 return jsonb_build_object('ok',true,'created',v_created,'existing',v_existing,'skipped',v_skipped);
end $function$;

-- public.connect_contact_import_profile(p_actor_id uuid, p_tenant_id uuid, p_person_id uuid)
CREATE OR REPLACE FUNCTION public.connect_contact_import_profile(p_actor_id uuid, p_tenant_id uuid, p_person_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare v_exists boolean;
begin
 select exists(select 1 from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.tenant_id=p_tenant_id and m.user_id=p_actor_id and m.status='active' and t.status in ('active','trial'))
 into v_exists;
 if not v_exists then raise exception 'Workspace access denied' using errcode='42501';end if;
 if not exists(select 1 from connect.people where tenant_id=p_tenant_id and id=p_person_id) then
  raise exception 'Contact not found' using errcode='42501';end if;
 return jsonb_build_object(
  'consent',coalesce((select status from connect.contact_marketing_permissions
    where tenant_id=p_tenant_id and person_id=p_person_id and channel='whatsapp'),'unknown'),
  'sources',coalesce((select jsonb_agg(to_jsonb(q) order by q.imported_at desc)
   from (select d.company,d.city,d.notes,d.tags,d.source_reference,d.imported_at,
    b.source_type,b.source_label,b.file_name
    from connect.contact_import_details d
    join connect.contact_import_batches b on b.tenant_id=d.tenant_id and b.id=d.source_batch_id
    where d.tenant_id=p_tenant_id and d.person_id=p_person_id
    order by d.imported_at desc limit 12) q),'[]'::jsonb)
 );
end $function$;

-- public.connect_contact_directory(p_actor_id uuid, p_tenant_id uuid, p_search text, p_offset integer, p_limit integer, p_sort text)
CREATE OR REPLACE FUNCTION public.connect_contact_directory(p_actor_id uuid, p_tenant_id uuid, p_search text DEFAULT ''::text, p_offset integer DEFAULT 0, p_limit integer DEFAULT 100, p_sort text DEFAULT 'name'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare v_permitted boolean;v_total bigint;v_items jsonb;v_query text;
begin
 select exists(select 1 from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active'
  and t.status in ('active','trial')) into v_permitted;
 if not v_permitted then raise exception 'Workspace access denied' using errcode='42501';end if;
 p_limit:=least(100,greatest(1,coalesce(p_limit,100)));
 p_offset:=least(100000,greatest(0,coalesce(p_offset,0)));
 p_sort:=case when p_sort='newest' then 'newest' else 'name' end;
 v_query:=left(btrim(coalesce(p_search,'')),100);
 select count(*) into v_total from connect.people p
 where p.tenant_id=p_tenant_id and p.status='active' and (
  v_query='' or p.full_name ilike '%'||v_query||'%' or exists(
   select 1 from connect.contact_methods cm
   where cm.tenant_id=p_tenant_id and cm.person_id=p.id
    and (cm.display_value ilike '%'||v_query||'%' or cm.normalized_value ilike '%'||v_query||'%')
  )
 );
 select coalesce(jsonb_agg(to_jsonb(q) order by q.sort_rank,q.full_name,q.id),'[]'::jsonb)
 into v_items from (
  select p.id,p.full_name,p.status,p.created_at,
   case when p_sort='newest' then -extract(epoch from p.created_at) else 0 end as sort_rank,
   (select coalesce(jsonb_agg(jsonb_build_object('kind',cm.kind,'value',cm.display_value,'primary',cm.is_primary)),'[]'::jsonb)
    from connect.contact_methods cm where cm.tenant_id=p_tenant_id and cm.person_id=p.id) as contact_methods,
   (select coalesce(jsonb_agg(pr.role),'[]'::jsonb) from connect.person_roles pr
    where pr.tenant_id=p_tenant_id and pr.person_id=p.id) as roles
  from connect.people p
  where p.tenant_id=p_tenant_id and p.status='active' and (
   v_query='' or p.full_name ilike '%'||v_query||'%' or exists(
    select 1 from connect.contact_methods cm where cm.tenant_id=p_tenant_id and cm.person_id=p.id
      and (cm.display_value ilike '%'||v_query||'%' or cm.normalized_value ilike '%'||v_query||'%')
   )
  )
  order by case when p_sort='newest' then p.created_at end desc nulls last,
   p.full_name,p.id limit p_limit offset p_offset
 ) q;
 -- Remove internal sort key from every item.
 select coalesce(jsonb_agg(value-'sort_rank'),'[]'::jsonb) into v_items
 from jsonb_array_elements(v_items);
 return jsonb_build_object('items',v_items,'total',v_total,'limit',p_limit,'offset',p_offset);
end $function$;

-- public.connect_contact_import_issues(p_actor_id uuid, p_tenant_id uuid, p_batch_id uuid)
CREATE OR REPLACE FUNCTION public.connect_contact_import_issues(p_actor_id uuid, p_tenant_id uuid, p_batch_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare v_allowed boolean;
begin
 select exists(select 1 from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active'
  and t.status in ('active','trial')) into v_allowed;
 if not v_allowed then raise exception 'Workspace access denied' using errcode='42501';end if;
 if not exists(select 1 from connect.contact_import_batches where tenant_id=p_tenant_id and id=p_batch_id)
 then raise exception 'Import batch unavailable' using errcode='42501';end if;
 return jsonb_build_object('items',coalesce((
   select jsonb_agg(jsonb_build_object('rowNumber',i.row_number,'reason',i.reason) order by i.row_number)
   from connect.contact_import_items i
   where i.tenant_id=p_tenant_id and i.batch_id=p_batch_id and i.result='skipped'
  ),'[]'::jsonb));
end $function$;

-- public.connect_manage_contacts(p_actor_id uuid, p_tenant_id uuid, p_action text, p_data jsonb)
CREATE OR REPLACE FUNCTION public.connect_manage_contacts(p_actor_id uuid, p_tenant_id uuid, p_action text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
 v_role text;v_member uuid;v_pid uuid;v_second uuid;v_name text;v_phone text;v_email text;
 v_number text;v_tags text[];v_tag text;v_ids uuid[];v_count int;v_status text;v_evidence text;
 v_filter jsonb;v_query text;v_city text;v_source text;v_consent text;v_offset int;v_limit int;
 v_items jsonb;v_total bigint;v_row jsonb;v_first uuid;v_last uuid;v_segment uuid;
begin
 select m.role,m.id into v_role,v_member from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active' and t.status in ('active','trial');
 if v_member is null then raise exception 'Workspace access denied' using errcode='42501';end if;
 if p_action='segments' then
  return jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at desc)
   from connect.contact_saved_segments s where s.tenant_id=p_tenant_id),'[]'::jsonb));
 end if;
 if p_action='duplicates' then
  return jsonb_build_object('items',coalesce((
   select jsonb_agg(to_jsonb(q)) from (
    select case when a.person_id<b.person_id then a.person_id else b.person_id end as first_id,
     case when a.person_id<b.person_id then b.person_id else a.person_id end as second_id,
     p1.full_name as first_name,p2.full_name as second_name,a.normalized_value as matching_value,a.kind
    from connect.contact_methods a join connect.contact_methods b on b.tenant_id=a.tenant_id
      and b.person_id<>a.person_id and ((a.kind='email' and b.kind='email') or (a.kind in ('mobile','phone','whatsapp') and b.kind in ('mobile','phone','whatsapp'))) and b.normalized_value=a.normalized_value
    join connect.people p1 on p1.id=a.person_id and p1.tenant_id=a.tenant_id and p1.status='active'
    join connect.people p2 on p2.id=b.person_id and p2.tenant_id=b.tenant_id and p2.status='active'
    where a.tenant_id=p_tenant_id and a.person_id<b.person_id and a.kind in ('mobile','phone','whatsapp','email')
      and not exists(select 1 from connect.contact_duplicate_decisions d where d.tenant_id=a.tenant_id
       and d.first_person_id=a.person_id and d.second_person_id=b.person_id)
    order by a.normalized_value limit 80
   ) q),'[]'::jsonb));
 end if;
 if p_action='list' then
  v_filter:=case when jsonb_typeof(p_data->'filters')='object' then p_data->'filters' else '{}'::jsonb end;
  v_query:=left(btrim(coalesce(v_filter->>'search','')),100);
  v_city:=left(btrim(coalesce(v_filter->>'city','')),120);
  v_source:=left(btrim(coalesce(v_filter->>'source','')),120);
  v_tag:=left(btrim(coalesce(v_filter->>'tag','')),50);
  v_consent:=coalesce(v_filter->>'consent','all');
  if v_consent not in ('all','unknown','opted_in','opted_out') then raise exception 'Invalid status filter' using errcode='22023';end if;
  v_offset:=least(100000,greatest(0,coalesce((p_data->>'offset')::int,0)));
  v_limit:=least(100,greatest(1,coalesce((p_data->>'limit')::int,50)));
  with filtered as (
   select p.id,p.full_name,p.created_at,cp.company,cp.city,coalesce(cp.tags,'{}'::text[]) as tags,cp.notes,
    coalesce(mp.status,'unknown') as consent_status,
    (select cm.display_value from connect.contact_methods cm where cm.tenant_id=p_tenant_id and cm.person_id=p.id
      and cm.kind in ('mobile','phone','whatsapp') order by cm.is_primary desc,cm.created_at desc limit 1) phone,
    (select cm.display_value from connect.contact_methods cm where cm.tenant_id=p_tenant_id and cm.person_id=p.id
      and cm.kind='email' order by cm.is_primary desc,cm.created_at desc limit 1) email,
    coalesce((select b.source_label from connect.contact_import_details cd
      join connect.contact_import_batches b on b.tenant_id=cd.tenant_id and b.id=cd.source_batch_id
      where cd.tenant_id=p_tenant_id and cd.person_id=p.id order by cd.imported_at desc limit 1),
      (select iq.source from connect.inquiries iq where iq.tenant_id=p_tenant_id and iq.person_id=p.id order by iq.received_at desc limit 1)) source
   from connect.people p left join connect.contact_profiles cp on cp.tenant_id=p.tenant_id and cp.person_id=p.id
    left join connect.contact_marketing_permissions mp on mp.tenant_id=p.tenant_id and mp.person_id=p.id and mp.channel='whatsapp'
   where p.tenant_id=p_tenant_id and p.status='active'
  ), matches as (
   select * from filtered f where
    (v_query='' or f.full_name ilike '%'||v_query||'%' or coalesce(f.phone,'') ilike '%'||v_query||'%' or
     coalesce(f.email,'') ilike '%'||v_query||'%' or coalesce(f.company,'') ilike '%'||v_query||'%')
     and (v_city='' or coalesce(f.city,'') ilike '%'||v_city||'%')
     and (v_source='' or coalesce(f.source,'') ilike '%'||v_source||'%')
     and (v_tag='' or exists(select 1 from unnest(f.tags) tag where lower(tag)=lower(v_tag)))
     and (v_consent='all' or f.consent_status=v_consent)
  )
  select count(*),coalesce((select jsonb_agg(to_jsonb(z) order by z.full_name,z.id)
    from (select * from matches order by full_name,id limit v_limit offset v_offset) z),'[]'::jsonb)
    into v_total,v_items from matches;
  return jsonb_build_object('items',v_items,'total',v_total,'offset',v_offset,'limit',v_limit);
 end if;
 if v_role not in ('owner','admin','manager') then
  raise exception 'Contact management requires a workspace manager' using errcode='42501';end if;
 if p_action='save_segment' then
  v_name:=left(btrim(coalesce(p_data->>'name','')),90);
  v_filter:=p_data->'filters';
  if length(v_name)<2 or jsonb_typeof(v_filter)<>'object' then raise exception 'Invalid segment' using errcode='22023';end if;
  insert into connect.contact_saved_segments(tenant_id,name,filters,created_by)
   values(p_tenant_id,v_name,v_filter,v_member)
   on conflict(tenant_id,name) do update set filters=excluded.filters
   returning id into v_segment;
  return jsonb_build_object('id',v_segment);
 end if;
 if p_action='delete_segment' then
  delete from connect.contact_saved_segments where tenant_id=p_tenant_id and id=(p_data->>'id')::uuid;
  return jsonb_build_object('ok',true);
 end if;
 if p_action='dismiss_duplicate' then
  v_first:=(p_data->>'firstId')::uuid;v_last:=(p_data->>'secondId')::uuid;
  if v_first=v_last or not exists(select 1 from connect.people where tenant_id=p_tenant_id and id=v_first)
   or not exists(select 1 from connect.people where tenant_id=p_tenant_id and id=v_last)
   then raise exception 'Invalid duplicate pair' using errcode='22023';end if;
  insert into connect.contact_duplicate_decisions(tenant_id,first_person_id,second_person_id,decision,actor_membership_id)
   values(p_tenant_id,least(v_first,v_last),greatest(v_first,v_last),'distinct',v_member)
   on conflict(tenant_id,first_person_id,second_person_id) do update set decision='distinct',actor_membership_id=v_member,decided_at=now();
  return jsonb_build_object('ok',true);
 end if;
 if p_action='edit' then
  v_pid:=(p_data->>'id')::uuid;
  perform 1 from connect.people where tenant_id=p_tenant_id and id=v_pid and status='active' for update;
  if not found then raise exception 'Contact not found' using errcode='42501';end if;
  v_name:=left(btrim(coalesce(p_data->>'name','')),150);
  if length(v_name)<1 then raise exception 'Contact name required' using errcode='22023';end if;
  update connect.people set full_name=v_name,updated_at=now() where tenant_id=p_tenant_id and id=v_pid;
  v_tags:=array(select distinct left(btrim(value),50) from jsonb_array_elements_text(
   case when jsonb_typeof(p_data->'tags')='array' then p_data->'tags' else '[]'::jsonb end) where length(btrim(value))>0 limit 20);
  insert into connect.contact_profiles(tenant_id,person_id,company,city,notes,tags)
   values(p_tenant_id,v_pid,left(nullif(btrim(coalesce(p_data->>'company','')),''),150),
    left(nullif(btrim(coalesce(p_data->>'city','')),''),120),
    left(nullif(btrim(coalesce(p_data->>'notes','')),''),1200),v_tags)
   on conflict(tenant_id,person_id) do update
   set company=excluded.company,city=excluded.city,notes=excluded.notes,tags=excluded.tags,updated_at=now();
  v_phone:=btrim(coalesce(p_data->>'phone',''));
  v_email:=lower(btrim(coalesce(p_data->>'email','')));
  v_number:=regexp_replace(v_phone,'[^0-9]','','g');
  if v_phone<>'' and length(v_number) not between 7 and 15 then raise exception 'Invalid phone' using errcode='22023';end if;
  if v_email<>'' and (length(v_email)>254 or v_email!~'^[^ @]+@[^ @]+\.[^ @]+$') then raise exception 'Invalid email' using errcode='22023';end if;
  if v_phone<>'' then
   -- Retain old phone identifiers for historic conversations; make selected number primary.
   update connect.contact_methods set is_primary=false where tenant_id=p_tenant_id and person_id=v_pid and kind in ('mobile','phone','whatsapp');
   insert into connect.contact_methods(tenant_id,person_id,kind,normalized_value,display_value,is_primary)
    values(p_tenant_id,v_pid,'mobile',v_number,v_phone,true)
    on conflict(tenant_id,person_id,kind,normalized_value) do update set display_value=excluded.display_value,is_primary=true;
  end if;
  if v_email<>'' then
   update connect.contact_methods set is_primary=false where tenant_id=p_tenant_id and person_id=v_pid and kind='email';
   insert into connect.contact_methods(tenant_id,person_id,kind,normalized_value,display_value,is_primary)
    values(p_tenant_id,v_pid,'email',v_email,v_email,true)
    on conflict(tenant_id,person_id,kind,normalized_value) do update set is_primary=true;
  end if;
  insert into connect.audit_events(tenant_id,actor_membership_id,event_type,entity_type,entity_id)
   values(p_tenant_id,v_member,'contact_updated','person',v_pid);
  return jsonb_build_object('ok',true);
 end if;
 if p_action='consent' then
  v_pid:=(p_data->>'id')::uuid;
  v_status:=coalesce(p_data->>'status','');v_evidence:=left(btrim(coalesce(p_data->>'evidence','')),800);
  if not exists(select 1 from connect.people where tenant_id=p_tenant_id and id=v_pid and status='active')
   or v_status not in ('unknown','opted_in','opted_out') then raise exception 'Invalid contact or status' using errcode='22023';end if;
  if v_status='opted_in' and length(v_evidence)<12 then raise exception 'Documented permission evidence required' using errcode='22023';end if;
  -- Opt-out is reversible only after independently verified consent evidence.
  if v_status='unknown' and exists(select 1 from connect.contact_marketing_permissions
   where tenant_id=p_tenant_id and person_id=v_pid and channel='whatsapp' and status='opted_out')
  then raise exception 'An opt-out cannot be reset without verified re-consent' using errcode='22023';end if;
  insert into connect.contact_marketing_permissions(tenant_id,person_id,channel,status,evidence)
   values(p_tenant_id,v_pid,'whatsapp',v_status,nullif(v_evidence,''))
   on conflict(tenant_id,person_id,channel) do update
    set status=excluded.status,evidence=excluded.evidence,updated_at=now();
  insert into connect.audit_events(tenant_id,actor_membership_id,event_type,entity_type,entity_id,metadata)
   values(p_tenant_id,v_member,'contact_marketing_permission','person',v_pid,jsonb_build_object('status',v_status));
  return jsonb_build_object('ok',true);
 end if;
 if p_action='bulk' then
  if jsonb_typeof(p_data->'ids')<>'array' or jsonb_array_length(p_data->'ids') not between 1 and 100 then
   raise exception 'Select 1 to 100 contacts' using errcode='22023';end if;
  select array_agg(distinct value::uuid) into v_ids from jsonb_array_elements_text(p_data->'ids');
  select count(*) into v_count from connect.people where tenant_id=p_tenant_id and status='active' and id=any(v_ids);
  if v_count<>cardinality(v_ids) then raise exception 'Invalid selected contact' using errcode='42501';end if;
  v_status:=p_data->>'operation';
  if v_status not in ('add_tag','remove_tag','set_city','opt_out') then raise exception 'Invalid bulk action' using errcode='22023';end if;
  if v_status in ('add_tag','remove_tag') then
   v_tag:=left(btrim(coalesce(p_data->>'value','')),50);
   if length(v_tag)<1 then raise exception 'A tag is required' using errcode='22023';end if;
  end if;
  insert into connect.contact_profiles(tenant_id,person_id)
   select p_tenant_id,id from unnest(v_ids) id on conflict do nothing;
  if v_status='add_tag' then
   update connect.contact_profiles cp set tags=array(select distinct x from unnest(cp.tags||array[v_tag]) x limit 20),updated_at=now()
    where cp.tenant_id=p_tenant_id and cp.person_id=any(v_ids);
  elsif v_status='remove_tag' then
   update connect.contact_profiles cp set tags=array_remove(cp.tags,v_tag),updated_at=now()
    where cp.tenant_id=p_tenant_id and cp.person_id=any(v_ids);
  elsif v_status='set_city' then
   update connect.contact_profiles cp set city=left(nullif(btrim(coalesce(p_data->>'value','')),''),120),updated_at=now()
    where cp.tenant_id=p_tenant_id and cp.person_id=any(v_ids);
  else
   insert into connect.contact_marketing_permissions(tenant_id,person_id,channel,status,evidence)
    select p_tenant_id,id,'whatsapp','opted_out','Bulk opt-out recorded by CRM manager' from unnest(v_ids) id
    on conflict(tenant_id,person_id,channel) do update set status='opted_out',evidence=excluded.evidence,updated_at=now();
  end if;
  insert into connect.audit_events(tenant_id,actor_membership_id,event_type,entity_type,metadata)
   values(p_tenant_id,v_member,'contacts_bulk_updated','person',jsonb_build_object('operation',v_status,'count',v_count));
  return jsonb_build_object('ok',true,'count',v_count);
 end if;
 raise exception 'Unsupported contact operation' using errcode='22023';
end $function$;

-- public.connect_merge_contacts(p_actor_id uuid, p_tenant_id uuid, p_keep_id uuid, p_merge_id uuid)
CREATE OR REPLACE FUNCTION public.connect_merge_contacts(p_actor_id uuid, p_tenant_id uuid, p_keep_id uuid, p_merge_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
 v_member uuid;v_role text;v_count int;v_table text;v_col text;
 v_source_status text;v_keep_status text;
begin
 select m.id,m.role into v_member,v_role from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active'
 and t.status in ('active','trial');
 if v_member is null or v_role not in ('owner','admin','manager') then
  raise exception 'Workspace management access required' using errcode='42501';end if;
 if p_keep_id=p_merge_id then raise exception 'Choose two different contacts' using errcode='22023';end if;
 select count(*) into v_count from connect.people p where p.tenant_id=p_tenant_id
  and p.id in (p_keep_id,p_merge_id) and p.status='active';
 if v_count<>2 then raise exception 'Both contacts must be active in this workspace' using errcode='42501';end if;
 -- Ensure no active interactions or relations would be orphaned or accidentally reassigned.
 for v_table,v_col in select * from (values
  ('activities','person_id'),('appointments','person_id'),('attribution','person_id'),
  ('consent_events','person_id'),('contact_owners','person_id'),
  ('conversations','person_id'),('household_members','person_id'),('inquiries','person_id'),
  ('opportunities','contact_id'),('opportunity_people','person_id'),
  ('organization_contacts','person_id'),('person_relations','from_person_id'),
  ('person_relations','to_person_id'),('tasks','person_id')
 ) as x(tab,col) loop
  execute format('select count(*) from connect.%I where tenant_id=$1 and %I=$2',v_table,v_col)
    into v_count using p_tenant_id,p_merge_id;
  if v_count>0 then
   raise exception 'Cannot merge: source contact has connected CRM history (%). Review records manually.',v_table using errcode='22023';
  end if;
 end loop;
 -- Preserve identifiers on the kept contact without duplicate unique records.
 insert into connect.contact_methods(tenant_id,person_id,kind,normalized_value,display_value,is_primary)
 select p_tenant_id,p_keep_id,cm.kind,cm.normalized_value,cm.display_value,false
 from connect.contact_methods cm where cm.tenant_id=p_tenant_id and cm.person_id=p_merge_id
 on conflict(tenant_id,person_id,kind,normalized_value) do nothing;
 insert into connect.person_roles(tenant_id,person_id,role)
 select p_tenant_id,p_keep_id,pr.role from connect.person_roles pr
 where pr.tenant_id=p_tenant_id and pr.person_id=p_merge_id
 on conflict do nothing;
 insert into connect.contact_profiles(tenant_id,person_id,company,city,tags,notes)
 select p_tenant_id,p_keep_id,s.company,s.city,s.tags,s.notes
 from connect.contact_profiles s where s.tenant_id=p_tenant_id and s.person_id=p_merge_id
 on conflict(tenant_id,person_id) do update set
 company=coalesce(connect.contact_profiles.company,excluded.company),
 city=coalesce(connect.contact_profiles.city,excluded.city),
 notes=coalesce(connect.contact_profiles.notes,excluded.notes),
 tags=array(select distinct x from unnest(connect.contact_profiles.tags||excluded.tags) x limit 20),updated_at=now();
 select status into v_source_status from connect.contact_marketing_permissions
 where tenant_id=p_tenant_id and person_id=p_merge_id and channel='whatsapp';
 select status into v_keep_status from connect.contact_marketing_permissions
 where tenant_id=p_tenant_id and person_id=p_keep_id and channel='whatsapp';
 -- Safest rule: an opt-out anywhere wins. Never transfer opt-in as permission for another identity.
 if v_source_status='opted_out' or v_keep_status='opted_out' then
  insert into connect.contact_marketing_permissions(tenant_id,person_id,channel,status,evidence)
   values(p_tenant_id,p_keep_id,'whatsapp','opted_out','Opt-out preserved during contact merge')
   on conflict(tenant_id,person_id,channel) do update set status='opted_out',evidence=excluded.evidence,updated_at=now();
 end if;
 insert into connect.contact_import_details(tenant_id,person_id,source_batch_id,company,city,notes,tags,source_reference)
 select p_tenant_id,p_keep_id,d.source_batch_id,d.company,d.city,d.notes,d.tags,d.source_reference
 from connect.contact_import_details d where d.tenant_id=p_tenant_id and d.person_id=p_merge_id
 on conflict do nothing;
 update connect.contact_import_items set person_id=p_keep_id where tenant_id=p_tenant_id and person_id=p_merge_id;
 -- The archived source is retained as an auditable identity. It is not deleted.
 update connect.people set status='archived',updated_at=now() where tenant_id=p_tenant_id and id=p_merge_id;
 insert into connect.contact_duplicate_decisions(tenant_id,first_person_id,second_person_id,decision,actor_membership_id)
 values(p_tenant_id,least(p_keep_id,p_merge_id),greatest(p_keep_id,p_merge_id),'merged',v_member)
 on conflict(tenant_id,first_person_id,second_person_id) do update
 set decision='merged',actor_membership_id=v_member,decided_at=now();
 insert into connect.audit_events(tenant_id,actor_membership_id,event_type,entity_type,entity_id,metadata)
 values(p_tenant_id,v_member,'contact_merged','person',p_keep_id,jsonb_build_object('archivedId',p_merge_id));
 return jsonb_build_object('ok',true,'keptId',p_keep_id,'archivedId',p_merge_id);
end $function$;

-- public.connect_contact_management_detail(p_actor_id uuid, p_tenant_id uuid, p_person_id uuid)
CREATE OR REPLACE FUNCTION public.connect_contact_management_detail(p_actor_id uuid, p_tenant_id uuid, p_person_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare v_allowed boolean;v_contact jsonb;
begin
 select exists(select 1 from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active'
 and t.status in ('active','trial')) into v_allowed;
 if not v_allowed then raise exception 'Workspace access denied' using errcode='42501';end if;
 select to_jsonb(z) into v_contact from (
  select p.id,p.full_name,p.created_at,cp.company,cp.city,cp.notes,coalesce(cp.tags,'{}'::text[]) tags,
   coalesce(mp.status,'unknown') consent_status,
   (select cm.display_value from connect.contact_methods cm where cm.tenant_id=p_tenant_id and cm.person_id=p.id
    and cm.kind in ('phone','mobile','whatsapp') order by cm.is_primary desc,cm.created_at desc limit 1) phone,
   (select cm.display_value from connect.contact_methods cm where cm.tenant_id=p_tenant_id and cm.person_id=p.id
    and cm.kind='email' order by cm.is_primary desc,cm.created_at desc limit 1) email,
   coalesce((select b.source_label from connect.contact_import_details d join connect.contact_import_batches b
    on b.tenant_id=d.tenant_id and b.id=d.source_batch_id
    where d.tenant_id=p_tenant_id and d.person_id=p.id order by d.imported_at desc limit 1),
    (select iq.source from connect.inquiries iq where iq.tenant_id=p_tenant_id and iq.person_id=p.id order by iq.received_at desc limit 1)) source
  from connect.people p
  left join connect.contact_profiles cp on cp.tenant_id=p.tenant_id and cp.person_id=p.id
  left join connect.contact_marketing_permissions mp on mp.tenant_id=p.tenant_id and mp.person_id=p.id and mp.channel='whatsapp'
  where p.tenant_id=p_tenant_id and p.id=p_person_id and p.status='active'
 ) z;
 if v_contact is null then raise exception 'Contact not found' using errcode='42501';end if;
 return jsonb_build_object('item',v_contact);
end $function$;

-- connect.contact_import_enrich_profile()
CREATE OR REPLACE FUNCTION connect.contact_import_enrich_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 insert into connect.contact_profiles(tenant_id,person_id,company,city,notes,tags)
 values(new.tenant_id,new.person_id,new.company,new.city,new.notes,coalesce(new.tags,'{}'::text[]))
 on conflict(tenant_id,person_id) do update
 set company=coalesce(connect.contact_profiles.company,excluded.company),
 city=coalesce(connect.contact_profiles.city,excluded.city),
 notes=coalesce(connect.contact_profiles.notes,excluded.notes),
 tags=array(select distinct tag from unnest(coalesce(connect.contact_profiles.tags,'{}'::text[])||excluded.tags) tag limit 20),
 updated_at=now();
 return new;
end $function$;


-- public.connect_email_attachment_context(p_actor_id uuid, p_tenant_id uuid, p_conversation_id uuid, p_message_id uuid, p_attachment_id text)
CREATE OR REPLACE FUNCTION public.connect_email_attachment_context(p_actor_id uuid, p_tenant_id uuid, p_conversation_id uuid, p_message_id uuid, p_attachment_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare v_data jsonb;
begin
 if not exists(select 1 from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active' and t.status in ('trial','active'))
 then raise exception 'Workspace access denied' using errcode='42501';end if;
 select jsonb_build_object('emailId',m.external_message_id,'attachmentId',ma.provider_attachment_id,
  'filename',ma.filename) into v_data from connect.message_attachments ma
 join connect.messages m on m.id=ma.message_id and m.tenant_id=ma.tenant_id
 join connect.conversations c on c.id=m.conversation_id and c.tenant_id=m.tenant_id
 join connect.channel_accounts a on a.id=c.channel_account_id and a.tenant_id=c.tenant_id
 where ma.tenant_id=p_tenant_id and ma.message_id=p_message_id and ma.provider_attachment_id=p_attachment_id
 and c.id=p_conversation_id and a.provider='email' and a.status='active';
 if v_data is null then raise exception 'Email attachment unavailable' using errcode='42501';end if;
 return v_data;
end $function$;

-- public.connect_enrich_inbound_email(p_mailbox text, p_event_id text, p_body text, p_attachments jsonb, p_header_message_id text, p_subject text, p_sender_email text)
CREATE OR REPLACE FUNCTION public.connect_enrich_inbound_email(p_mailbox text, p_event_id text, p_body text, p_attachments jsonb DEFAULT '[]'::jsonb, p_header_message_id text DEFAULT NULL::text, p_subject text DEFAULT NULL::text, p_sender_email text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_account connect.channel_accounts%rowtype;v_message uuid;v_conversation uuid;v_part jsonb;v_count int:=0;
begin
 if length(coalesce(p_event_id,'')) not between 3 and 250 or length(coalesce(p_body,''))>15000
 or jsonb_typeof(p_attachments)<>'array' or jsonb_array_length(p_attachments)>20 then
 raise exception 'Invalid email payload' using errcode='22023';end if;
 select a.* into v_account from connect.channel_accounts a join connect.tenants t on t.id=a.tenant_id
 where a.provider='email' and a.external_account_id=lower(btrim(p_mailbox))
 and a.status='active' and t.status in ('trial','active');
 if not found then raise exception 'Email channel unavailable' using errcode='42501';end if;
 select m.id,c.id into v_message,v_conversation from connect.messages m join connect.conversations c
 on c.id=m.conversation_id and c.tenant_id=m.tenant_id
 where m.tenant_id=v_account.tenant_id and c.channel_account_id=v_account.id
 and m.external_message_id=p_event_id and m.direction='inbound'
 order by m.occurred_at desc limit 1 for update of m;
 if v_message is null then raise exception 'Email event not ingested yet' using errcode='22023';end if;
 if p_sender_email is not null then
  if length(p_sender_email)>254 or p_sender_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
   raise exception 'Invalid sender address' using errcode='22023';end if;
  insert into connect.email_conversation_recipients(tenant_id,conversation_id,reply_to_email)
  values(v_account.tenant_id,v_conversation,lower(p_sender_email))
  on conflict(tenant_id,conversation_id) do update set reply_to_email=excluded.reply_to_email,updated_at=now();
 end if;
 if nullif(btrim(coalesce(p_body,'')),'') is not null then
  update connect.messages set body=left(p_body,15000),message_type='email'
  where tenant_id=v_account.tenant_id and id=v_message;
 end if;
 insert into connect.email_message_headers(tenant_id,message_id,message_header_id,subject)
 values(v_account.tenant_id,v_message,left(nullif(btrim(p_header_message_id),''),250),left(p_subject,250))
 on conflict(tenant_id,message_id) do update set
 message_header_id=excluded.message_header_id,subject=excluded.subject;
 for v_part in select value from jsonb_array_elements(p_attachments) loop
  if length(coalesce(v_part->>'id','')) between 3 and 250 and
    length(coalesce(v_part->>'filename',''))<=255 and
    length(coalesce(v_part->>'contentType',''))<=150 then
   insert into connect.message_attachments(tenant_id,message_id,provider_attachment_id,filename,content_type,size_bytes)
   values(v_account.tenant_id,v_message,v_part->>'id',nullif(v_part->>'filename',''),
    nullif(v_part->>'contentType',''),case when (v_part->>'size')~'^[0-9]{1,14}$'
    then (v_part->>'size')::bigint else null end)
   on conflict(tenant_id,message_id,provider_attachment_id) do update
   set filename=excluded.filename,content_type=excluded.content_type,size_bytes=excluded.size_bytes;
   v_count:=v_count+1;
  end if;
 end loop;
 return jsonb_build_object('ok',true,'attachments',v_count);
end $function$;

-- public.connect_enrich_social_attachment(p_provider text, p_account text, p_event_id text, p_attachments jsonb)
CREATE OR REPLACE FUNCTION public.connect_enrich_social_attachment(p_provider text, p_account text, p_event_id text, p_attachments jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_message uuid;v_tenant uuid;v_item jsonb;v_count int:=0;
begin
 if p_provider not in ('instagram','facebook') or length(coalesce(p_event_id,'')) not between 3 and 250
 or jsonb_typeof(p_attachments)<>'array' or jsonb_array_length(p_attachments)>10 then
  raise exception 'Invalid attachment data' using errcode='22023';end if;
 select m.id,m.tenant_id into v_message,v_tenant from connect.messages m
 join connect.conversations c on c.id=m.conversation_id and c.tenant_id=m.tenant_id
 join connect.channel_accounts a on a.id=c.channel_account_id and a.tenant_id=c.tenant_id
 where a.provider=p_provider and a.external_account_id=lower(btrim(p_account))
 and a.status='active' and m.external_message_id=p_event_id limit 1;
 if v_message is null then raise exception 'Social message not found' using errcode='22023';end if;
 for v_item in select value from jsonb_array_elements(p_attachments) loop
  if length(coalesce(v_item->>'id','')) between 3 and 250 then
   insert into connect.message_attachments(tenant_id,message_id,provider_attachment_id,filename,content_type)
   values(v_tenant,v_message,v_item->>'id',left(v_item->>'filename',255),left(v_item->>'contentType',150))
   on conflict(tenant_id,message_id,provider_attachment_id) do nothing;
   v_count:=v_count+1;
  end if;
 end loop;
 return v_count;
end $function$;

-- public.connect_ingest_email_thread(p_mailbox text, p_event_id text, p_sender_email text, p_sender_name text, p_subject text)
CREATE OR REPLACE FUNCTION public.connect_ingest_email_thread(p_mailbox text, p_event_id text, p_sender_email text, p_sender_name text, p_subject text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_account connect.channel_accounts%rowtype;v_person uuid;v_conversation uuid;v_message uuid;v_sender text;
begin
 v_sender:=lower(btrim(coalesce(p_sender_email,'')));
 if v_sender !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  or length(v_sender)>254 or length(coalesce(p_event_id,'')) not between 3 and 250
  or length(coalesce(p_subject,''))>1500 then raise exception 'Invalid inbound email' using errcode='22023';end if;
 select a.* into v_account from connect.channel_accounts a join connect.tenants t on t.id=a.tenant_id
 where a.provider='email' and a.external_account_id=lower(btrim(p_mailbox))
 and a.status='active' and t.status in ('trial','active');
 if not found then raise exception 'Email channel unavailable' using errcode='42501';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_account.id::text||':'||v_sender,0));
 select c.person_id into v_person from connect.conversations c where c.tenant_id=v_account.tenant_id
 and c.channel_account_id=v_account.id and c.external_thread_id=v_sender;
 if v_person is null then
  select cm.person_id into v_person from connect.contact_methods cm join connect.people p
  on p.id=cm.person_id and p.tenant_id=cm.tenant_id and p.status='active'
  where cm.tenant_id=v_account.tenant_id and cm.kind='email' and cm.normalized_value=v_sender limit 1;
 end if;
 if v_person is null then
  insert into connect.people(tenant_id,full_name)
  values(v_account.tenant_id,left(coalesce(nullif(btrim(p_sender_name),''),v_sender),150)) returning id into v_person;
  insert into connect.person_roles(tenant_id,person_id,role)values(v_account.tenant_id,v_person,'contact');
 end if;
 insert into connect.contact_methods(tenant_id,person_id,kind,normalized_value,display_value,is_primary)
 values(v_account.tenant_id,v_person,'email',v_sender,v_sender,false)
 on conflict(tenant_id,person_id,kind,normalized_value) do nothing;
 insert into connect.conversations(tenant_id,channel_account_id,person_id,external_thread_id)
 values(v_account.tenant_id,v_account.id,v_person,v_sender)
 on conflict(tenant_id,channel_account_id,external_thread_id) where external_thread_id is not null
 do update set person_id=coalesce(connect.conversations.person_id,excluded.person_id)
 returning id into v_conversation;
 insert into connect.messages(tenant_id,conversation_id,external_message_id,direction,body,message_type,delivery_status,occurred_at)
 values(v_account.tenant_id,v_conversation,p_event_id,'inbound',left(coalesce(nullif(p_subject,''),'Email received'),1500),
  'email_subject','received',now())
 on conflict(tenant_id,conversation_id,external_message_id) where external_message_id is not null
 do nothing returning id into v_message;
 if v_message is not null then update connect.conversations set last_message_at=now()
  where tenant_id=v_account.tenant_id and id=v_conversation;end if;
 return jsonb_build_object('ok',true,'duplicate',v_message is null);
end $function$;

-- public.connect_ingest_social_message(p_provider text, p_external_account_id text, p_event_id text, p_sender_id text, p_sender_name text, p_body text, p_occurred_at timestamp with time zone, p_direction text, p_kind text)
CREATE OR REPLACE FUNCTION public.connect_ingest_social_message(p_provider text, p_external_account_id text, p_event_id text, p_sender_id text, p_sender_name text, p_body text, p_occurred_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_direction text DEFAULT 'inbound'::text, p_kind text DEFAULT 'text'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_account connect.channel_accounts%rowtype;v_person uuid;v_conversation uuid;v_message uuid;
 v_scoped text;v_name text;v_at timestamptz;
begin
 if p_provider not in ('instagram','facebook') or p_direction not in ('inbound','outbound')
  or length(coalesce(p_event_id,'')) not between 3 and 250
  or length(coalesce(p_sender_id,'')) not between 3 and 200
  or length(coalesce(p_body,''))>3000 or length(coalesce(p_kind,''))>50 then
  raise exception 'Invalid social message' using errcode='22023';end if;
 select a.* into v_account from connect.channel_accounts a join connect.tenants t on t.id=a.tenant_id
 where a.provider=p_provider and a.external_account_id=lower(btrim(p_external_account_id))
  and a.status='active' and t.status in ('trial','active') for share of a;
 if not found then raise exception 'Social channel unavailable' using errcode='42501';end if;
 v_scoped:=btrim(p_sender_id);
 v_name:=left(coalesce(nullif(btrim(p_sender_name),''),
  case when p_provider='instagram' then 'Instagram contact' else 'Facebook contact' end),150);
 v_at:=case when p_occurred_at between '2000-01-01'::timestamptz and now()+interval '1 day'
  then p_occurred_at else now() end;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_account.id::text||':'||v_scoped,0));
 select c.person_id into v_person from connect.conversations c where c.tenant_id=v_account.tenant_id
  and c.channel_account_id=v_account.id and c.external_thread_id=v_scoped;
 if v_person is null then
  insert into connect.people(tenant_id,full_name) values(v_account.tenant_id,v_name) returning id into v_person;
  insert into connect.person_roles(tenant_id,person_id,role) values(v_account.tenant_id,v_person,'contact');
 end if;
 insert into connect.contact_methods(tenant_id,person_id,kind,normalized_value,display_value,is_primary)
 values(v_account.tenant_id,v_person,'social',p_provider||':'||v_scoped,v_scoped,false)
 on conflict(tenant_id,person_id,kind,normalized_value) do nothing;
 insert into connect.conversations(tenant_id,channel_account_id,person_id,external_thread_id)
 values(v_account.tenant_id,v_account.id,v_person,v_scoped)
 on conflict(tenant_id,channel_account_id,external_thread_id) where external_thread_id is not null
 do update set person_id=coalesce(connect.conversations.person_id,excluded.person_id)
 returning id into v_conversation;
 insert into connect.messages(tenant_id,conversation_id,external_message_id,direction,body,message_type,
  delivery_status,occurred_at,sent_at)
 values(v_account.tenant_id,v_conversation,p_event_id,p_direction,nullif(p_body,''),
  coalesce(nullif(btrim(p_kind),''),'text'),case when p_direction='inbound' then 'received' else 'sent' end,
  v_at,case when p_direction='outbound' then v_at else null end)
 on conflict(tenant_id,conversation_id,external_message_id) where external_message_id is not null
 do nothing returning id into v_message;
 if v_message is not null then update connect.conversations
  set last_message_at=greatest(coalesce(last_message_at,v_at),v_at)
  where tenant_id=v_account.tenant_id and id=v_conversation;end if;
 return jsonb_build_object('ok',true,'duplicate',v_message is null,'conversationId',v_conversation);
end $function$;

-- public.connect_social_reply(p_actor_id uuid, p_tenant_id uuid, p_conversation_id uuid, p_action text, p_request_id uuid, p_body text, p_message_id text)
CREATE OR REPLACE FUNCTION public.connect_social_reply(p_actor_id uuid, p_tenant_id uuid, p_conversation_id uuid, p_action text, p_request_id uuid DEFAULT NULL::uuid, p_body text DEFAULT NULL::text, p_message_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_member uuid;v_role text;v_account connect.channel_accounts%rowtype;v_recipient text;
 v_last timestamptz;v_reserved uuid;v_outbox connect.outbox%rowtype;
begin
 select m.id,m.role into v_member,v_role from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active' and t.status in ('active','trial');
 if v_member is null then raise exception 'Workspace access denied' using errcode='42501';end if;
 select a.* into v_account from connect.conversations c
 join connect.channel_accounts a on a.id=c.channel_account_id and a.tenant_id=c.tenant_id
 where c.tenant_id=p_tenant_id and c.id=p_conversation_id
 and a.provider in ('instagram','facebook') and a.status='active';
 if not found then raise exception 'Active social conversation unavailable' using errcode='42501';end if;
 select c.external_thread_id into v_recipient from connect.conversations c
 where c.tenant_id=p_tenant_id and c.id=p_conversation_id;
 select max(occurred_at) into v_last from connect.messages
 where tenant_id=p_tenant_id and conversation_id=p_conversation_id and direction='inbound';
 if p_action='context' then
  return jsonb_build_object('provider',v_account.provider,'accountId',v_account.external_account_id,
   'recipient',v_recipient,'canReply',v_role<>'viewer' and v_last>now()-interval '24 hours',
   'lastInboundAt',v_last);
 end if;
 if v_role='viewer' or v_last is null or v_last<=now()-interval '24 hours' then
  raise exception 'Customer-service messaging window is closed' using errcode='42501';end if;
 if p_request_id is null then raise exception 'Request ID required' using errcode='22023';end if;
 if p_action='reserve' then
  if p_body is null or length(btrim(p_body)) not between 1 and 1000 then
   raise exception 'Invalid reply text' using errcode='22023';end if;
  insert into connect.outbox(tenant_id,conversation_id,idempotency_key,body,status)
  values(p_tenant_id,p_conversation_id,p_request_id::text,btrim(p_body),'sending')
  on conflict(tenant_id,idempotency_key) do nothing returning id into v_reserved;
  if v_reserved is null then raise exception 'Message already submitted. Refresh before retrying' using errcode='23505';end if;
  return jsonb_build_object('reservationId',v_reserved,'provider',v_account.provider,
   'accountId',v_account.external_account_id,'recipient',v_recipient);
 elsif p_action='complete' then
  select * into v_outbox from connect.outbox where tenant_id=p_tenant_id
   and conversation_id=p_conversation_id and idempotency_key=p_request_id::text for update;
  if not found or v_outbox.status<>'sending' then raise exception 'Send reservation unavailable' using errcode='42501';end if;
  if p_message_id is not null and length(p_message_id) between 3 and 250 then
   update connect.outbox set status='sent' where id=v_outbox.id;
   insert into connect.messages(tenant_id,conversation_id,external_message_id,direction,body,
    message_type,delivery_status,occurred_at,sent_at)
   values(p_tenant_id,p_conversation_id,p_message_id,'outbound',v_outbox.body,'text','sent',now(),now())
   on conflict(tenant_id,conversation_id,external_message_id) where external_message_id is not null do nothing;
   update connect.conversations set last_message_at=now() where tenant_id=p_tenant_id and id=p_conversation_id;
  else
   update connect.outbox set status='failed' where id=v_outbox.id;
  end if;
  return jsonb_build_object('ok',true);
 end if;
 raise exception 'Invalid reply action' using errcode='22023';
end $function$;

-- public.connect_unified_conversation(p_actor_id uuid, p_tenant_id uuid, p_conversation_id uuid)
CREATE OR REPLACE FUNCTION public.connect_unified_conversation(p_actor_id uuid, p_tenant_id uuid, p_conversation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare v_role text;v_result jsonb;
begin
 select m.role into v_role from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active' and t.status in ('active','trial');
 if v_role is null then raise exception 'Workspace access denied' using errcode='42501';end if;
 select jsonb_build_object('personId',c.person_id,'provider',a.provider,'channelName',a.display_name,
 'externalContactId',c.external_thread_id,'status',c.status,'canWrite',v_role<>'viewer',
 'classification',coalesce(tr.classification,case when a.provider='email' then 'enquiry' else 'unreviewed' end),'inquiryId',tr.inquiry_id,
 'messages',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'body',m.body,'kind',m.message_type,
  'direction',m.direction,'occurredAt',m.occurred_at,'deliveryStatus',m.delivery_status)
  order by m.occurred_at,m.id) from (select * from connect.messages where tenant_id=p_tenant_id
  and conversation_id=p_conversation_id order by occurred_at desc,id desc limit 100) m),'[]'::jsonb)) into v_result
 from connect.conversations c join connect.channel_accounts a on a.tenant_id=c.tenant_id and a.id=c.channel_account_id
 left join connect.whatsapp_enquiry_triage tr on tr.tenant_id=c.tenant_id and tr.conversation_id=c.id
 where c.tenant_id=p_tenant_id and c.id=p_conversation_id and a.provider in ('whatsapp','instagram','facebook','email');
 if v_result is null then raise exception 'Conversation unavailable' using errcode='42501';end if;
 return v_result;
end $function$;

-- public.connect_unified_email_reply(p_actor_id uuid, p_tenant_id uuid, p_conversation_id uuid, p_action text, p_request_id uuid, p_body text, p_message_id text)
CREATE OR REPLACE FUNCTION public.connect_unified_email_reply(p_actor_id uuid, p_tenant_id uuid, p_conversation_id uuid, p_action text, p_request_id uuid DEFAULT NULL::uuid, p_body text DEFAULT NULL::text, p_message_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_member uuid;v_role text;v_account connect.channel_accounts%rowtype;v_recipient text;v_subject text;v_header text;
 v_outbox connect.outbox%rowtype;v_reserved uuid;
begin
 select m.id,m.role into v_member,v_role from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active' and t.status in ('active','trial');
 if v_member is null then raise exception 'Workspace access denied' using errcode='42501';end if;
 select a.* into v_account from connect.conversations c join connect.channel_accounts a
 on a.id=c.channel_account_id and a.tenant_id=c.tenant_id
 where c.tenant_id=p_tenant_id and c.id=p_conversation_id and a.provider='email' and a.status='active';
 if not found then raise exception 'Email channel unavailable' using errcode='42501';end if;
 select reply_to_email into v_recipient from connect.email_conversation_recipients
 where tenant_id=p_tenant_id and conversation_id=p_conversation_id;
 select eh.subject,eh.message_header_id into v_subject,v_header from connect.messages m
 join connect.email_message_headers eh on eh.tenant_id=m.tenant_id and eh.message_id=m.id
 where m.tenant_id=p_tenant_id and m.conversation_id=p_conversation_id and m.direction='inbound'
 order by m.occurred_at desc limit 1;
 if p_action='context' then
  return jsonb_build_object('canReply',v_role<>'viewer' and v_recipient is not null,
   'sender',v_account.external_account_id,'recipient',v_recipient,
   'subject',coalesce(v_subject,'Robotronix enquiry'),'inReplyTo',v_header);
 end if;
 if v_role='viewer' or v_recipient is null then raise exception 'Email reply unavailable' using errcode='42501';end if;
 if p_request_id is null then raise exception 'Request ID required' using errcode='22023';end if;
 if p_action='reserve' then
  if length(btrim(coalesce(p_body,''))) not between 1 and 12000 then
   raise exception 'Email message must be 1–12000 characters' using errcode='22023';end if;
  insert into connect.outbox(tenant_id,conversation_id,idempotency_key,body,status)
  values(p_tenant_id,p_conversation_id,p_request_id::text,btrim(p_body),'sending')
  on conflict(tenant_id,idempotency_key) do nothing returning id into v_reserved;
  if v_reserved is null then raise exception 'Email already submitted' using errcode='23505';end if;
  return jsonb_build_object('reservationId',v_reserved,'sender',v_account.external_account_id,'recipient',v_recipient);
 elsif p_action='complete' then
  select * into v_outbox from connect.outbox where tenant_id=p_tenant_id
  and conversation_id=p_conversation_id and idempotency_key=p_request_id::text for update;
  if not found or v_outbox.status<>'sending' then raise exception 'Email reservation unavailable' using errcode='42501';end if;
  if length(coalesce(p_message_id,'')) between 3 and 250 then
   update connect.outbox set status='sent' where id=v_outbox.id;
   insert into connect.messages(tenant_id,conversation_id,external_message_id,direction,body,
    message_type,delivery_status,occurred_at,sent_at)
   values(p_tenant_id,p_conversation_id,p_message_id,'outbound',v_outbox.body,'email','sent',now(),now())
   on conflict(tenant_id,conversation_id,external_message_id) where external_message_id is not null do nothing;
   update connect.conversations set last_message_at=now() where tenant_id=p_tenant_id and id=p_conversation_id;
  else update connect.outbox set status='failed' where id=v_outbox.id;end if;
  return jsonb_build_object('ok',true);
 end if;
 raise exception 'Unsupported email action' using errcode='22023';
end $function$;

-- public.connect_unified_link_contact(p_actor_id uuid, p_tenant_id uuid, p_conversation_id uuid, p_person_id uuid)
CREATE OR REPLACE FUNCTION public.connect_unified_link_contact(p_actor_id uuid, p_tenant_id uuid, p_conversation_id uuid, p_person_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_member uuid;v_previous uuid;v_provider text;
begin
 select m.id into v_member from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active' and m.role<>'viewer'
 and t.status in ('active','trial');
 if v_member is null then raise exception 'Write access denied' using errcode='42501';end if;
 if not exists(select 1 from connect.people where tenant_id=p_tenant_id and id=p_person_id and status='active')
 then raise exception 'Contact not found' using errcode='42501';end if;
 select c.person_id,a.provider into v_previous,v_provider from connect.conversations c join connect.channel_accounts a
 on a.tenant_id=c.tenant_id and a.id=c.channel_account_id
 where c.tenant_id=p_tenant_id and c.id=p_conversation_id
 and a.provider in ('whatsapp','instagram','facebook','email') for update of c;
 if not found then raise exception 'Conversation not found' using errcode='42501';end if;
 update connect.conversations set person_id=p_person_id where tenant_id=p_tenant_id and id=p_conversation_id;
 -- The conversation is the stable external-identity anchor. Historical enquiries are kept as-is.
 insert into connect.audit_events(tenant_id,actor_membership_id,event_type,entity_type,entity_id,metadata)
 values(p_tenant_id,v_member,'inbox_contact_linked','conversation',p_conversation_id,
 jsonb_build_object('previousPersonId',v_previous,'personId',p_person_id,'provider',v_provider));
 return jsonb_build_object('ok',true,'personId',p_person_id);
end $function$;

-- public.connect_unified_mark_read(p_actor_id uuid, p_tenant_id uuid, p_conversation_id uuid)
CREATE OR REPLACE FUNCTION public.connect_unified_mark_read(p_actor_id uuid, p_tenant_id uuid, p_conversation_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_member uuid;
begin
 select m.id into v_member from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active' and t.status in ('trial','active');
 if v_member is null or not exists(select 1 from connect.conversations c join connect.channel_accounts a
  on a.id=c.channel_account_id and a.tenant_id=c.tenant_id
  where c.tenant_id=p_tenant_id and c.id=p_conversation_id
  and a.provider in ('whatsapp','instagram','facebook','email')) then
  raise exception 'Conversation unavailable' using errcode='42501';end if;
 insert into connect.whatsapp_thread_state(tenant_id,conversation_id,member_id,last_read_at)
 values(p_tenant_id,p_conversation_id,v_member,now())
 on conflict(tenant_id,conversation_id,member_id) do update
  set last_read_at=greatest(coalesce(connect.whatsapp_thread_state.last_read_at,excluded.last_read_at),excluded.last_read_at),updated_at=now();
 return true;
end $function$;

-- public.connect_unified_message_attachments(p_actor_id uuid, p_tenant_id uuid, p_conversation_id uuid)
CREATE OR REPLACE FUNCTION public.connect_unified_message_attachments(p_actor_id uuid, p_tenant_id uuid, p_conversation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare v_data jsonb;
begin
 if not exists(select 1 from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.tenant_id=p_tenant_id and m.user_id=p_actor_id and m.status='active' and t.status in ('trial','active'))
 then raise exception 'Workspace access denied' using errcode='42501';end if;
 if not exists(select 1 from connect.conversations where tenant_id=p_tenant_id and id=p_conversation_id)
 then raise exception 'Conversation not found' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('messageId',ma.message_id,'id',ma.provider_attachment_id,
  'filename',ma.filename,'contentType',ma.content_type,'size',ma.size_bytes)
 order by ma.message_id,ma.provider_attachment_id),'[]'::jsonb) into v_data
 from connect.message_attachments ma join connect.messages m on m.tenant_id=ma.tenant_id and m.id=ma.message_id
 where ma.tenant_id=p_tenant_id and m.conversation_id=p_conversation_id;
 return v_data;
end $function$;

-- public.connect_unified_threads(p_actor_id uuid, p_tenant_id uuid, p_limit integer, p_before_at timestamp with time zone, p_before_id uuid)
CREATE OR REPLACE FUNCTION public.connect_unified_threads(p_actor_id uuid, p_tenant_id uuid, p_limit integer DEFAULT 50, p_before_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_before_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare v_member uuid;v_page jsonb;v_count int;v_size int:=least(100,greatest(1,coalesce(p_limit,50)));v_last jsonb;
begin
 select m.id into v_member from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active' and t.status in ('active','trial');
 if v_member is null then raise exception 'Workspace access denied' using errcode='42501';end if;
 if (p_before_at is null)<>(p_before_id is null) then raise exception 'Invalid cursor' using errcode='22023';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'provider',x.provider,'channelName',x.channel_name,
  'personId',x.person_id,'personName',x.person_name,'externalContactId',x.external_thread_id,
  'status',x.status,'lastAt',x.last_at,'lastMessage',x.last_body,'lastDirection',x.last_direction,
  'unreadCount',x.unread_count,'classification',coalesce(x.classification,case when x.provider='email' then 'enquiry' else 'unreviewed' end))
  order by x.last_at desc,x.id desc),'[]'::jsonb),count(*) into v_page,v_count from (
 select c.id,a.provider,a.display_name channel_name,c.person_id,p.full_name person_name,
  c.external_thread_id,c.status,coalesce(c.last_message_at,c.created_at) last_at,
  msg.body last_body,msg.direction last_direction,
  (select count(*)::int from connect.messages m where m.tenant_id=c.tenant_id
   and m.conversation_id=c.id and m.direction='inbound'
   and m.occurred_at>coalesce(s.last_read_at,'-infinity'::timestamptz)) unread_count,
  tri.classification from connect.conversations c join connect.channel_accounts a
  on a.id=c.channel_account_id and a.tenant_id=c.tenant_id and a.provider in ('whatsapp','instagram','facebook','email')
  left join connect.people p on p.tenant_id=c.tenant_id and p.id=c.person_id
  left join connect.whatsapp_thread_state s on s.tenant_id=c.tenant_id and s.conversation_id=c.id and s.member_id=v_member
  left join connect.whatsapp_enquiry_triage tri on tri.tenant_id=c.tenant_id and tri.conversation_id=c.id
  left join lateral (select m.body,m.direction from connect.messages m where m.tenant_id=c.tenant_id
   and m.conversation_id=c.id order by m.occurred_at desc,m.id desc limit 1) msg on true
  where c.tenant_id=p_tenant_id and (p_before_at is null or
   (coalesce(c.last_message_at,c.created_at),c.id)<(p_before_at,p_before_id))
  order by last_at desc,c.id desc limit v_size+1) x;
 if v_count>v_size then
  v_page:=(select coalesce(jsonb_agg(z.item order by z.ord),'[]'::jsonb)
   from jsonb_array_elements(v_page) with ordinality z(item,ord) where z.ord<=v_size);
  v_last:=v_page->(v_size-1);
  return jsonb_build_object('items',v_page,'nextCursor',jsonb_build_object('at',v_last->>'lastAt','id',v_last->>'id'));
 end if;
 return jsonb_build_object('items',v_page,'nextCursor',null);
end $function$;

-- public.connect_whatsapp_triage(p_actor_id uuid, p_tenant_id uuid, p_conversation_id uuid, p_action text, p_data jsonb)
CREATE OR REPLACE FUNCTION public.connect_whatsapp_triage(p_actor_id uuid, p_tenant_id uuid, p_conversation_id uuid, p_action text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_member uuid;v_role text;v_person uuid;v_channel uuid;v_provider text;v_name text;v_inquiry uuid;v_existing uuid;v_summary text;
begin
 select m.id,m.role into v_member,v_role from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active'
 and t.status in ('active','trial');
 if v_member is null or (v_role='viewer' and p_action<>'state') then
  raise exception 'Access denied' using errcode='42501';end if;
 select c.person_id,c.channel_account_id,a.provider into v_person,v_channel,v_provider from connect.conversations c
 join connect.channel_accounts a on a.tenant_id=c.tenant_id and a.id=c.channel_account_id
 where c.tenant_id=p_tenant_id and c.id=p_conversation_id and a.provider in ('whatsapp','instagram','facebook','email') for update of c;
 if not found or v_person is null then raise exception 'Messaging contact not found' using errcode='42501';end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Invalid payload' using errcode='22023';end if;
 if p_action='state' then
  return coalesce((select jsonb_build_object('classification',classification,'inquiryId',inquiry_id)
   from connect.whatsapp_enquiry_triage where tenant_id=p_tenant_id and conversation_id=p_conversation_id),
   jsonb_build_object('classification','unreviewed','inquiryId',null));
 elsif p_action='save_name' then
  v_name:=nullif(btrim(p_data->>'name'),'');
  if v_name is null or length(v_name)>150 then raise exception 'Enter a valid name' using errcode='22023';end if;
  update connect.people set full_name=v_name,updated_at=now()
  where tenant_id=p_tenant_id and id=v_person and status='active';
 elsif p_action='not_enquiry' then
  if exists(select 1 from connect.whatsapp_enquiry_triage where tenant_id=p_tenant_id
   and conversation_id=p_conversation_id and classification='enquiry') then
   raise exception 'Already linked to an enquiry; do not discard it' using errcode='22023';
  end if;
  insert into connect.whatsapp_enquiry_triage(tenant_id,conversation_id,classification)
  values(p_tenant_id,p_conversation_id,'not_enquiry')
  on conflict(tenant_id,conversation_id) do update set classification='not_enquiry',updated_at=now();
 elsif p_action='mark_enquiry' then
  v_summary:=nullif(btrim(p_data->>'summary'),'');
  if v_summary is null or length(v_summary)>2000 then raise exception 'Enquiry details required (up to 2000 characters)' using errcode='22023';end if;
  select inquiry_id into v_existing from connect.whatsapp_enquiry_triage
  where tenant_id=p_tenant_id and conversation_id=p_conversation_id and classification='enquiry';
  if v_existing is not null then return jsonb_build_object('ok',true,'inquiryId',v_existing,'alreadyLinked',true);end if;
  insert into connect.inquiries(tenant_id,person_id,channel_account_id,source,summary)
  values(p_tenant_id,v_person,v_channel,v_provider,v_summary) returning id into v_inquiry;
  insert into connect.whatsapp_enquiry_triage(tenant_id,conversation_id,classification,inquiry_id)
  values(p_tenant_id,p_conversation_id,'enquiry',v_inquiry)
  on conflict(tenant_id,conversation_id) do update set classification='enquiry',inquiry_id=excluded.inquiry_id,updated_at=now();
 else raise exception 'Unsupported triage action' using errcode='22023';end if;
 insert into connect.audit_events(tenant_id,actor_membership_id,event_type,entity_type,entity_id,metadata)
 values(p_tenant_id,v_member,'whatsapp_'||p_action,'conversation',p_conversation_id,
  jsonb_build_object('inquiryId',v_inquiry));
 return jsonb_build_object('ok',true,'inquiryId',v_inquiry);
end $function$;

-- Only trusted server may invoke Connect/Portal integration service functions.
DO $connect_rpc_acl$ DECLARE r record; BEGIN FOR r IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='connect' OR (n.nspname='public' AND (p.proname LIKE 'connect_%' OR p.proname LIKE 'portal_admission_%' OR p.proname LIKE 'portal_demo_%')) LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',r.oid::regprocedure); EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',r.oid::regprocedure); END LOOP; END $connect_rpc_acl$;
COMMIT;
