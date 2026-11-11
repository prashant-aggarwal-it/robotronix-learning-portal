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
