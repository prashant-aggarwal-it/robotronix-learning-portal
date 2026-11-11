-- Repeatable job: published trainer outcomes and no-shows create one sales follow-up each.
create table if not exists connect.portal_demo_followup_receipts (
 tenant_id uuid not null references connect.tenants(id) on delete restrict,
 portal_participant_id uuid not null,
 outcome_kind text not null check(outcome_kind in ('demo_feedback','demo_no_show')),
 task_id uuid,
 synced_at timestamptz not null default now(),
 primary key(tenant_id,portal_participant_id,outcome_kind)
);
alter table connect.portal_demo_followup_receipts enable row level security;
revoke all on connect.portal_demo_followup_receipts from public,anon,authenticated;
grant select,insert,update on connect.portal_demo_followup_receipts to service_role;

create or replace function public.connect_process_portal_demo_followups(p_batch_size int default 100)
returns jsonb language plpgsql security invoker set search_path='' as $fn$
declare v record;v_task uuid;v_new int:=0;v_kind text;v_title text;
begin
 for v in select l.tenant_id,l.opportunity_id,l.person_id,o.owner_membership_id,
   p.id as participant_id,p.attendance,p.summary_published_at
  from connect.portal_demo_links l
  join connect.portal_demo_integrations i on i.tenant_id=l.tenant_id and i.status='active'
  join connect.opportunities o on o.tenant_id=l.tenant_id and o.id=l.opportunity_id
  join public.demo_session_participants p on p.demo_session_id=l.portal_session_id
  where l.status='scheduled' and (p.summary_published_at is not null or p.attendance='no_show')
  and not exists(select 1 from connect.portal_demo_followup_receipts r
   where r.tenant_id=l.tenant_id and r.portal_participant_id=p.id
   and r.outcome_kind=case when p.attendance='no_show' then 'demo_no_show' else 'demo_feedback' end)
  order by p.updated_at limit least(greatest(p_batch_size,1),500)
 loop
  v_kind:=case when v.attendance='no_show' then 'demo_no_show' else 'demo_feedback' end;
  v_title:=case when v_kind='demo_no_show' then 'Follow up after missed discovery demo' else 'Follow up after trainer demo feedback' end;
  insert into connect.portal_demo_followup_receipts(tenant_id,portal_participant_id,outcome_kind)
  values(v.tenant_id,v.participant_id,v_kind) on conflict do nothing;
  if not found then continue;end if;
  insert into connect.tasks(tenant_id,opportunity_id,person_id,assignee_membership_id,title,due_at)
  values(v.tenant_id,v.opportunity_id,v.person_id,v.owner_membership_id,v_title,now()+interval '1 day') returning id into v_task;
  update connect.portal_demo_followup_receipts set task_id=v_task
   where tenant_id=v.tenant_id and portal_participant_id=v.participant_id and outcome_kind=v_kind;
  v_new:=v_new+1;
 end loop;
 return jsonb_build_object('created',v_new);
end $fn$;
revoke all on function public.connect_process_portal_demo_followups(int) from public,anon,authenticated;
grant execute on function public.connect_process_portal_demo_followups(int) to service_role;
