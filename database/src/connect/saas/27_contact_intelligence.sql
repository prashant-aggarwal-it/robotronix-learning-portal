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
