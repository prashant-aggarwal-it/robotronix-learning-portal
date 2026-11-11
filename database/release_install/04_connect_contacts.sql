-- Robotronix PRODUCTION INSTALL BUNDLE: 04 Contact 360, relationships, ownership and intelligence.
-- Run once after 03_connect_foundation.sql.
BEGIN;
DO $guard$ BEGIN IF to_regclass('connect.people') IS NULL THEN RAISE EXCEPTION 'Connect foundation missing'; END IF; END $guard$;

-- ===== SOURCE: database/connect/saas/24_contact_360_timeline_PENDING.sql =====
-- Applied to DEV project fflejkqcspivnhsmkdtn on 2026-11-06 (migration: connect_contact_360_unified_timeline).\n-- Do not apply to Production without a separate approval.
-- Contact 360 unified timeline: keyset pagination, strict tenant membership, cross-opportunity history.
create or replace function public.connect_contact_timeline(
 p_actor_id uuid,p_tenant_id uuid,p_person_id uuid,
 p_before_at timestamptz default null,p_before_key text default null,p_limit int default 40
) returns jsonb language plpgsql stable set search_path = '' as $function$
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
revoke all on function public.connect_contact_timeline(uuid,uuid,uuid,timestamptz,text,int) from public,anon,authenticated;
grant execute on function public.connect_contact_timeline(uuid,uuid,uuid,timestamptz,text,int) to service_role;

-- Refresh PostgREST RPC discovery after installing this function in an approved environment.
notify pgrst, 'reload schema';


-- ===== SOURCE: database/connect/saas/25_contact_relationships.sql =====
-- DEV-only Phase 3: contact relationships and explicit contact owner.
-- Existing person_relations and organization_contacts remain canonical.
create table if not exists connect.contact_owners (
 tenant_id uuid not null,
 person_id uuid not null,
 owner_membership_id uuid not null,
 assigned_at timestamptz not null default now(),
 assigned_by_membership_id uuid,
 primary key (tenant_id,person_id),
 foreign key (tenant_id,person_id) references connect.people(tenant_id,id) on delete cascade,
 foreign key (tenant_id,owner_membership_id) references connect.memberships(tenant_id,id) on delete restrict,
 foreign key (tenant_id,assigned_by_membership_id) references connect.memberships(tenant_id,id) on delete set null (assigned_by_membership_id)
);
create index if not exists idx_connect_contact_owners_owner on connect.contact_owners(tenant_id,owner_membership_id);
revoke all on connect.contact_owners from public,anon,authenticated;
grant select,insert,update,delete on connect.contact_owners to service_role;

create or replace function public.connect_contact_relations(
 p_actor_id uuid,p_tenant_id uuid,p_person_id uuid
) returns jsonb language plpgsql stable set search_path='' as $fn$
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
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'role',m.role,'label',coalesce(u.email,'Team member'))
 order by u.email),'[]'::jsonb) into v_members
 from connect.memberships m join auth.users u on u.id=m.user_id
 where m.tenant_id=p_tenant_id and m.status='active' and m.role<>'viewer';
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'category',o.category) order by o.name),'[]'::jsonb)
 into v_org_options from connect.organizations o where o.tenant_id=p_tenant_id;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.full_name) order by p.full_name),'[]'::jsonb)
 into v_people_options from connect.people p where p.tenant_id=p_tenant_id and p.status='active' and p.id<>p_person_id;
 return jsonb_build_object('people',v_people,'organizations',v_orgs,'owner',v_owner,'members',v_members,
 'organizationOptions',v_org_options,'peopleOptions',v_people_options);
end $fn$;

create or replace function public.connect_contact_relation_command(
 p_actor_id uuid,p_tenant_id uuid,p_person_id uuid,p_action text,p_data jsonb
) returns jsonb language plpgsql set search_path='' as $fn$
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
end $fn$;
revoke all on function public.connect_contact_relations(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.connect_contact_relation_command(uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.connect_contact_relations(uuid,uuid,uuid) to service_role;
grant execute on function public.connect_contact_relation_command(uuid,uuid,uuid,text,jsonb) to service_role;
notify pgrst,'reload schema';


-- ===== SOURCE: database/connect/saas/26_contact_owners_rls.sql =====
-- DEV Phase 3 defense in depth: private table access is service role only.
alter table connect.contact_owners enable row level security;
create index if not exists idx_connect_contact_owners_assigned_by
 on connect.contact_owners(tenant_id,assigned_by_membership_id);
revoke all on connect.contact_owners from public,anon,authenticated;


-- ===== SOURCE: database/connect/saas/27_contact_intelligence.sql =====
-- Phase 4: factual, explainable contact intelligence. No model inference or personal profiling.
-- Server-only function with strict active workspace membership and fixed result caps.
create or replace function public.connect_contact_insights(
 p_actor_id uuid,p_tenant_id uuid,p_person_id uuid default null,p_limit integer default 30
) returns jsonb language plpgsql stable set search_path='' as $fn$
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
end $fn$;
revoke all on function public.connect_contact_insights(uuid,uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.connect_contact_insights(uuid,uuid,uuid,integer) to service_role;
notify pgrst,'reload schema';

COMMIT;
