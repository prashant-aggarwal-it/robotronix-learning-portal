-- Connect Phase 2B paginated, tenant-scoped CRM reads.
begin;
create or replace function public.connect_crm_read(
 p_actor_id uuid,p_tenant_id uuid,p_resource text,p_options jsonb default '{}'::jsonb
) returns jsonb language plpgsql stable security invoker set search_path=''
as $fn$
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
  from (select i.id,i.person_id,i.opportunity_id,i.source,i.summary,i.received_at,
    p.full_name as contact_name,
    (select cm.display_value from connect.contact_methods cm
     where cm.tenant_id=i.tenant_id and cm.person_id=i.person_id
     order by cm.is_primary desc,cm.created_at limit 1) as contact_detail,
    o.title as opportunity_title,o.stage_id,s.name as stage_name,s.outcome
    from connect.inquiries i
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
end $fn$;
revoke all on function public.connect_crm_read(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.connect_crm_read(uuid,uuid,text,jsonb) to service_role;
commit;