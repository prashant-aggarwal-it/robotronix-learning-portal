-- Phase D: a minimal, permission-filtered CRM projection of Portal-owned facts.
-- Only confirmed handoffs for an installed integration are eligible.
create table if not exists connect.portal_lifecycle_summaries (
 tenant_id uuid not null references connect.tenants(id) on delete cascade,
 enrollment_id uuid not null,
 opportunity_id uuid not null,
 learner_person_id uuid not null,
 student_id uuid not null,
 course_title text not null,
 enrollment_status text not null,
 sessions_completed int not null default 0,
 planned_sessions int,
 progress_percent numeric,
 attendance_count int not null default 0,
 last_class_date date,
 package_id uuid,
 package_name text,
 billing_model text,
 paid_session_balance int,
 package_end_date date,
 payment_attention boolean not null default false,
 renewal_reason text,
 refreshed_at timestamptz not null default now(),
 primary key (tenant_id,enrollment_id)
);
create index if not exists portal_lifecycle_tenant_renewal_idx on connect.portal_lifecycle_summaries(tenant_id,renewal_reason);
alter table connect.portal_lifecycle_summaries enable row level security;
revoke all on connect.portal_lifecycle_summaries from public,anon,authenticated;

create table if not exists connect.portal_renewal_signals (
 tenant_id uuid not null references connect.tenants(id) on delete cascade,
 enrollment_id uuid not null,
 cycle_key uuid not null,
 reason text not null,
 status text not null default 'open' check(status in ('open','contacted','dismissed')),
 first_seen_at timestamptz not null default now(),
 last_seen_at timestamptz not null default now(),
 active boolean not null default true,
 handled_by uuid,
 handled_at timestamptz,
 primary key (tenant_id,enrollment_id,cycle_key)
);
create index if not exists portal_renewal_signals_open_idx on connect.portal_renewal_signals(tenant_id,active,status);
alter table connect.portal_renewal_signals enable row level security;
revoke all on connect.portal_renewal_signals from public,anon,authenticated;

-- Cron/service-role sync; never accepts a caller-selected tenant or record ID.
create or replace function public.connect_sync_portal_lifecycle(p_batch_size int default 200)
returns jsonb language plpgsql security invoker set search_path='' as $fn$
declare v record;v_count int:=0;v_reason text;v_package record;v_attendance int;v_last date;v_attention boolean;
begin
 for v in
  select h.tenant_id,h.opportunity_id,h.learner_person_id,h.portal_enrollment_id as enrollment_id,
   h.portal_student_id as student_id,e.status,e.sessions_completed,e.planned_sessions,e.progress_percent,
   e.paid_session_balance,e.planned_end_date,c.title as course_title
  from connect.portal_admission_handoffs h
  join connect.portal_demo_integrations i on i.tenant_id=h.tenant_id and i.status='active'
  join public.enrollments e on e.id=h.portal_enrollment_id and e.student_id=h.portal_student_id
  join public.courses c on c.id=e.course_id
  where h.status='enrollment_confirmed' and h.verified_at is not null and h.guardian_consent_attested=true
  order by h.confirmed_at desc limit least(greatest(p_batch_size,1),1000)
 loop
  select p.id,p.name,p.billing_model,p.sessions,p.end_date into v_package
   from public.student_fee_packages p where p.enrollment_id=v.enrollment_id
   order by p.start_date desc nulls last,p.created_at desc limit 1;
  select count(*)::int,max(s.date) into v_attendance,v_last
   from public.class_attendance a join public.schedule_events s on s.id=a.schedule_event_id
   where a.enrollment_id=v.enrollment_id and a.status in ('present','attended');
  select exists(select 1 from public.student_invoices inv
   where inv.enrollment_id=v.enrollment_id and inv.status not in ('paid','cancelled','void','draft')
    and inv.due_date<current_date and coalesce(inv.amount_due,0)>0) into v_attention;
  v_reason:=case
   when v.status in ('completed','ended') then 'course_completed'
   when v.status in ('paused','on_hold','hold') then 'learning_paused'
   when v.status='active' and v_package.id is not null and v_package.sessions is not null
    and v.paid_session_balance is not null and v.paid_session_balance<=2 then 'package_sessions_low'
   when v.status='active' and v_package.end_date is not null and v_package.end_date<=current_date+14 then 'package_ending'
   when v.status='active' and v.planned_end_date is not null and v.planned_end_date<=current_date+14 then 'course_ending'
   else null end;
  insert into connect.portal_lifecycle_summaries(tenant_id,enrollment_id,opportunity_id,learner_person_id,student_id,
   course_title,enrollment_status,sessions_completed,planned_sessions,progress_percent,attendance_count,last_class_date,
   package_id,package_name,billing_model,paid_session_balance,package_end_date,payment_attention,renewal_reason,refreshed_at)
  values(v.tenant_id,v.enrollment_id,v.opportunity_id,v.learner_person_id,v.student_id,
   v.course_title,v.status,coalesce(v.sessions_completed,0),v.planned_sessions,v.progress_percent,v_attendance,v_last,
   v_package.id,v_package.name,v_package.billing_model,v.paid_session_balance,v_package.end_date,v_attention,v_reason,now())
  on conflict(tenant_id,enrollment_id) do update set
   opportunity_id=excluded.opportunity_id,learner_person_id=excluded.learner_person_id,student_id=excluded.student_id,
   course_title=excluded.course_title,enrollment_status=excluded.enrollment_status,
   sessions_completed=excluded.sessions_completed,planned_sessions=excluded.planned_sessions,
   progress_percent=excluded.progress_percent,attendance_count=excluded.attendance_count,last_class_date=excluded.last_class_date,
   package_id=excluded.package_id,package_name=excluded.package_name,billing_model=excluded.billing_model,
   paid_session_balance=excluded.paid_session_balance,package_end_date=excluded.package_end_date,
   payment_attention=excluded.payment_attention,renewal_reason=excluded.renewal_reason,refreshed_at=now();
  update connect.portal_renewal_signals set active=false,last_seen_at=now()
   where tenant_id=v.tenant_id and enrollment_id=v.enrollment_id and active
    and (v_reason is null or cycle_key is distinct from coalesce(v_package.id,v.enrollment_id));
  if v_reason is not null then
   insert into connect.portal_renewal_signals(tenant_id,enrollment_id,cycle_key,reason)
   values(v.tenant_id,v.enrollment_id,coalesce(v_package.id,v.enrollment_id),v_reason)
   on conflict(tenant_id,enrollment_id,cycle_key) do update set active=true,last_seen_at=now(),reason=excluded.reason;
  end if;
  v_count:=v_count+1;
  v_package:=null;
 end loop;
 return jsonb_build_object('synced',v_count);
end $fn$;
revoke all on function public.connect_sync_portal_lifecycle(int) from public,anon,authenticated;
grant execute on function public.connect_sync_portal_lifecycle(int) to service_role;

-- Server-authenticated actor is checked against the tenant membership on every call.
create or replace function public.connect_portal_lifecycle(
 p_actor_id uuid,p_tenant_id uuid,p_action text default 'list',p_data jsonb default '{}'::jsonb
) returns jsonb language plpgsql security invoker set search_path='' as $fn$
declare v_role text;v_member uuid;v_id uuid;v_status text;v_result jsonb;
begin
 select m.role,m.id into v_role,v_member from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active' and t.status in ('active','trial');
 if v_role is null then raise exception 'Access denied' using errcode='42501';end if;
 if not exists(select 1 from connect.portal_demo_integrations i where i.tenant_id=p_tenant_id and i.status='active')
 then return jsonb_build_object('items','[]'::jsonb,'connected',false);end if;
 if p_action='list' then
  if v_role='viewer' then return jsonb_build_object('items','[]'::jsonb,'connected',true);end if;
  select coalesce(jsonb_agg(to_jsonb(q) order by q.refreshed_at desc),'[]'::jsonb) into v_result from (
   select l.enrollment_id,l.opportunity_id,l.learner_person_id,l.course_title,l.enrollment_status,
    l.sessions_completed,l.planned_sessions,l.progress_percent,l.attendance_count,l.last_class_date,
    l.package_name,l.billing_model,l.paid_session_balance,l.package_end_date,l.renewal_reason,l.refreshed_at,
    s.status as renewal_status,s.active as renewal_active,
    case when v_role in ('owner','admin','manager') then l.payment_attention else null end as payment_attention
   from connect.portal_lifecycle_summaries l
   join connect.opportunities o on o.id=l.opportunity_id and o.tenant_id=l.tenant_id
   left join connect.portal_renewal_signals s on s.tenant_id=l.tenant_id and s.enrollment_id=l.enrollment_id
     and s.cycle_key=coalesce(l.package_id,l.enrollment_id)
   where l.tenant_id=p_tenant_id and (v_role in ('owner','admin','manager') or o.owner_membership_id=v_member)
   order by l.refreshed_at desc limit 200
  ) q;
  return jsonb_build_object('items',v_result,'connected',true);
 end if;
 if p_action='mark_renewal' then
  if v_role not in ('owner','admin','manager','counsellor') then raise exception 'Access denied' using errcode='42501';end if;
  if coalesce(p_data->>'status','') not in ('contacted','dismissed','open') then raise exception 'Invalid status' using errcode='22023';end if;
  v_id:=(p_data->>'enrollmentId')::uuid;
  update connect.portal_renewal_signals s set status=p_data->>'status',handled_by=p_actor_id,handled_at=now()
   from connect.portal_lifecycle_summaries l join connect.opportunities o on o.id=l.opportunity_id and o.tenant_id=l.tenant_id
   where s.tenant_id=p_tenant_id and s.enrollment_id=v_id and s.active=true
    and l.tenant_id=s.tenant_id and l.enrollment_id=s.enrollment_id and s.cycle_key=coalesce(l.package_id,l.enrollment_id)
    and (v_role in ('owner','admin','manager') or o.owner_membership_id=v_member);
  if not found then raise exception 'Renewal not available' using errcode='22023';end if;
  insert into connect.audit_events(tenant_id,actor_membership_id,event_type,entity_type,entity_id,metadata)
   values(p_tenant_id,v_member,'portal_renewal_updated','opportunity',
    (select opportunity_id from connect.portal_lifecycle_summaries where tenant_id=p_tenant_id and enrollment_id=v_id),
    jsonb_build_object('enrollmentId',v_id,'status',p_data->>'status'));
  return jsonb_build_object('ok',true);
 end if;
 raise exception 'Invalid lifecycle action' using errcode='22023';
end $fn$;
revoke all on function public.connect_portal_lifecycle(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.connect_portal_lifecycle(uuid,uuid,text,jsonb) to service_role;
