-- Robotronix PRODUCTION INSTALL BUNDLE: 07 Portal-to-CRM demos, admissions, reconciliation RPCs and lifecycle.
-- Run once after 06_connect_calendar_imports.sql. NO recurring cron jobs are scheduled here.
-- Portal and CRM must share the same Auth/project and required public Portal tables must already exist.
BEGIN;
DO $guard$ BEGIN IF to_regclass('connect.people') IS NULL OR to_regclass('public.onboarding_submissions') IS NULL THEN RAISE EXCEPTION 'Connect foundation or Learning Portal schema missing'; END IF; END $guard$;

-- ===== SOURCE: database/connect/saas/48_portal_demo_bridge.sql =====
-- Phase B: optional, tenant-scoped mapping to the Portal demo domain.
-- No cross-product FK: Connect and Portal can move to separate databases later.
create table if not exists connect.portal_demo_integrations (
 tenant_id uuid primary key references connect.tenants(id) on delete restrict,
 status text not null default 'active' check(status in ('active','disabled')),
 installed_by uuid not null references auth.users(id),
 installed_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists connect.portal_demo_links (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references connect.tenants(id) on delete restrict,
 request_id uuid not null,
 payload_hash text not null,
 opportunity_id uuid not null,
 person_id uuid not null,
 portal_session_id uuid,
 portal_schedule_event_id uuid,
 portal_participant_id uuid,
 status text not null default 'requested' check(status in ('requested','provisioning','scheduled','cancelled','failed')),
 version integer not null default 1 check(version>0),
 failure_code text,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key(tenant_id,opportunity_id) references connect.opportunities(tenant_id,id) on delete restrict,
 foreign key(tenant_id,person_id) references connect.people(tenant_id,id) on delete restrict,
 unique(tenant_id,request_id),unique(tenant_id,portal_session_id)
);
create index if not exists portal_demo_links_tenant_opportunity_idx
 on connect.portal_demo_links(tenant_id,opportunity_id,created_at desc);
alter table connect.portal_demo_integrations enable row level security;
alter table connect.portal_demo_links enable row level security;
revoke all on connect.portal_demo_integrations,connect.portal_demo_links from public,anon,authenticated;
grant select,insert,update on connect.portal_demo_integrations,connect.portal_demo_links to service_role;

-- A database-serialized slot reservation prevents simultaneous conflicting bookings.
-- Existing Portal schedule entries remain the authoritative availability source.
create or replace function public.portal_demo_reserve_slot(
 p_trainer_id uuid,p_title text,p_date date,p_start time,p_end time,p_timezone text,p_mode text
) returns uuid language plpgsql security invoker set search_path to '' as $fn$
declare v_id uuid;v_start timestamptz;v_end timestamptz;
begin
 if p_trainer_id is null or p_title is null or length(btrim(p_title)) not between 1 and 160
   or p_date is null or p_start is null or p_end is null or p_start>=p_end
   or p_mode not in ('one_to_one','small_group') then
  raise exception 'Invalid demo slot' using errcode='22023';
 end if;
 if not exists(select 1 from public.trainers where id=p_trainer_id) then
  raise exception 'Trainer is unavailable' using errcode='22023';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_trainer_id::text,0));
 v_start:=(p_date+p_start) at time zone p_timezone;
 v_end:=(p_date+p_end) at time zone p_timezone;
 if v_start < now() or v_end<=v_start then raise exception 'Demo slot is no longer available' using errcode='22023';end if;
 if exists (
  select 1 from public.schedule_events e
  where e.trainer_id=p_trainer_id and e.status not in ('cancelled','rescheduled')
    and (e.date+e.start_time) at time zone e.timezone < v_end
    and (e.date+e.end_time) at time zone e.timezone > v_start
 ) then raise exception 'Demo slot is already booked' using errcode='23P01';end if;
 insert into public.schedule_events(trainer_id,title,date,start_time,end_time,timezone,event_type,delivery_mode,status,notes)
 values(p_trainer_id,p_title,p_date,p_start,p_end,p_timezone,'demo',p_mode,'scheduled','Connect CRM demo booking')
 returning id into v_id;
 return v_id;
end $fn$;
revoke all on function public.portal_demo_reserve_slot(uuid,text,date,time,time,text,text) from public,anon,authenticated;
grant execute on function public.portal_demo_reserve_slot(uuid,text,date,time,time,text,text) to service_role;


-- ===== SOURCE: database/connect/saas/49_portal_demo_move_slot.sql =====
create or replace function public.portal_demo_move_slot(
 p_event_id uuid,p_trainer_id uuid,p_date date,p_start time,p_end time,p_timezone text
) returns void language plpgsql security invoker set search_path to '' as $fn$
declare v_event record;v_start timestamptz;v_end timestamptz;
begin
 select e.id,e.status,e.event_type into v_event from public.schedule_events e where e.id=p_event_id for update;
 if not found or v_event.status<>'scheduled' or v_event.event_type<>'demo' then
  raise exception 'Demo cannot be rescheduled' using errcode='22023';end if;
 if p_date is null or p_start is null or p_end is null or p_start>=p_end or
  not exists(select 1 from public.trainers where id=p_trainer_id and record_status='active') then
  raise exception 'Invalid trainer or slot' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_trainer_id::text,0));
 v_start:=(p_date+p_start) at time zone p_timezone;
 v_end:=(p_date+p_end) at time zone p_timezone;
 if v_start<now() or v_end<=v_start then raise exception 'Slot is no longer available' using errcode='22023';end if;
 if exists(select 1 from public.schedule_events e where e.trainer_id=p_trainer_id and e.id<>p_event_id
  and e.status not in ('cancelled','rescheduled') and
  (e.date+e.start_time) at time zone e.timezone<v_end and (e.date+e.end_time) at time zone e.timezone>v_start)
 then raise exception 'Trainer conflict' using errcode='23P01';end if;
 update public.schedule_events set trainer_id=p_trainer_id,date=p_date,start_time=p_start,end_time=p_end,
  timezone=p_timezone,updated_at=now() where id=p_event_id;
end $fn$;
revoke all on function public.portal_demo_move_slot(uuid,uuid,date,time,time,text) from public,anon,authenticated;
grant execute on function public.portal_demo_move_slot(uuid,uuid,date,time,time,text) to service_role;


-- ===== SOURCE: database/connect/saas/50_portal_single_institution_guard.sql =====
-- The current Learning Portal has one institutional data boundary.
-- Until it exposes a verifiable institute ID, do not connect two unrelated CRM tenants
-- to the same trainer/student database. Replace this guard when per-institution isolation ships.
create unique index if not exists connect_portal_single_active_integration
 on connect.portal_demo_integrations(status) where status='active';


-- ===== SOURCE: database/connect/saas/51_portal_demo_private_rpc.sql =====
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


-- ===== SOURCE: database/connect/saas/52_portal_admissions_handoffs.sql =====
-- Phase C — accepted offers and verifiable parent-owned onboarding handoff.
create table if not exists connect.portal_admission_handoffs (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references connect.tenants(id) on delete restrict,
 opportunity_id uuid not null,
 learner_person_id uuid not null,
 request_id uuid not null,
 payload_hash text not null,
 token_hash text not null unique,
 token_expires_at timestamptz not null,
 offer_snapshot jsonb not null,
 acceptance_recorded_at timestamptz not null default now(),
 acceptance_recorded_by uuid not null references auth.users(id),
 guardian_consent_attested boolean not null default false,
 status text not null default 'invited' check(status in ('invited','onboarding_pending','review_required','enrollment_confirmed','revoked')),
 onboarding_submission_id uuid,
 portal_enrollment_id uuid,
 portal_student_id uuid,
 verified_at timestamptz,
 verified_by uuid,
 confirmed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(tenant_id,request_id),
 foreign key(tenant_id,opportunity_id) references connect.opportunities(tenant_id,id) on delete restrict,
 foreign key(tenant_id,learner_person_id) references connect.people(tenant_id,id) on delete restrict,
 check(jsonb_typeof(offer_snapshot)='object')
);
create unique index if not exists connect_handoff_submission_unique on connect.portal_admission_handoffs(onboarding_submission_id) where onboarding_submission_id is not null;
create unique index if not exists connect_handoff_enrollment_unique on connect.portal_admission_handoffs(portal_enrollment_id) where portal_enrollment_id is not null;
create unique index if not exists connect_handoff_one_active_offer on connect.portal_admission_handoffs(tenant_id,opportunity_id) where status<>'revoked';
create index if not exists connect_handoff_opportunity_idx on connect.portal_admission_handoffs(tenant_id,opportunity_id,created_at desc);
alter table connect.portal_admission_handoffs enable row level security;
revoke all on connect.portal_admission_handoffs from public,anon,authenticated;
grant select,insert,update on connect.portal_admission_handoffs to service_role;

-- A connected CRM opportunity cannot be prematurely marked Won by dragging a card.
create or replace function connect.guard_portal_enrollment_won() returns trigger
language plpgsql security invoker set search_path='' as $fn$
begin
 if new.stage_id is distinct from old.stage_id and exists(
  select 1 from connect.portal_demo_integrations i where i.tenant_id=new.tenant_id and i.status='active'
 ) and exists(select 1 from connect.pipeline_stages s where s.tenant_id=new.tenant_id and s.id=new.stage_id and s.outcome='won')
 and not exists(select 1 from connect.portal_admission_handoffs h where h.tenant_id=new.tenant_id
  and h.opportunity_id=new.id and h.status='enrollment_confirmed' and h.portal_enrollment_id is not null)
 then raise exception 'Portal enrollment confirmation required before Won' using errcode='23514';end if;
 return new;
end $fn$;
drop trigger if exists guard_portal_enrollment_won on connect.opportunities;
create trigger guard_portal_enrollment_won before update on connect.opportunities
for each row execute function connect.guard_portal_enrollment_won();
revoke all on function connect.guard_portal_enrollment_won() from public,anon,authenticated;


-- ===== SOURCE: database/connect/saas/53_portal_admissions_rpc.sql =====
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


-- ===== SOURCE: database/connect/saas/54_portal_admission_token_rpc.sql =====
-- Token possession permits only limited prefill. Binding requires an authenticated parent,
-- consented onboarding and independently verified parent email or manual admin review.
create or replace function public.portal_admission_handoff_token(
 p_token_hash text,p_action text,p_user_id uuid default null,p_submission_id uuid default null,p_confirmed_email text default null
) returns jsonb language plpgsql security invoker set search_path='' as $fn$
declare v_h record;v_guardian record;v_learner record;v_onb record;
 v_email text;v_verified boolean:=false;
begin
 select * into v_h from connect.portal_admission_handoffs
 where token_hash=p_token_hash and token_expires_at>now() and status in ('invited','onboarding_pending','review_required') for update;
 if not found then raise exception 'Handoff link expired or unavailable' using errcode='22023';end if;
 select p.id,p.full_name into v_learner from connect.people p where p.tenant_id=v_h.tenant_id and p.id=v_h.learner_person_id;
 select p.id,p.full_name into v_guardian from connect.opportunities o join connect.people p on p.tenant_id=o.tenant_id and p.id=o.contact_id
 where o.tenant_id=v_h.tenant_id and o.id=v_h.opportunity_id;
 if v_guardian.id is null or v_learner.id is null then raise exception 'Handoff contact missing' using errcode='22023';end if;
 select display_value into v_email from connect.contact_methods where tenant_id=v_h.tenant_id and person_id=v_guardian.id
  and kind='email' order by is_primary desc limit 1;
 if p_action='preview' then
  return jsonb_build_object('parentName',v_guardian.full_name,'childName',v_learner.full_name,
   'parentEmail',coalesce(v_email,''),'source','CRM admission','offerCurrency',v_h.offer_snapshot->>'currency',
   'offerSessions',v_h.offer_snapshot->>'sessions');
 end if;
 if p_action<>'bind' or p_user_id is null or p_submission_id is null then raise exception 'Invalid handoff request' using errcode='22023';end if;
 if v_h.onboarding_submission_id is not null then
  if v_h.onboarding_submission_id=p_submission_id then return jsonb_build_object('ok',true,'status',v_h.status);end if;
  raise exception 'Handoff already bound to another onboarding' using errcode='23505';
 end if;
 select * into v_onb from public.onboarding_submissions where id=p_submission_id and user_id=p_user_id and data_consent=true;
 if not found or lower(btrim(v_onb.child_name))<>lower(btrim(v_learner.full_name)) then
  raise exception 'Consent or learner identity mismatch' using errcode='42501';end if;
 -- Caller is the authenticated server; only service_role can execute this RPC.
 -- The server uses Supabase Auth getUser(token) to supply an email only if confirmed.
 v_verified:=p_confirmed_email is not null and v_email is not null and
  lower(btrim(p_confirmed_email))=lower(btrim(v_email));
 update connect.portal_admission_handoffs set onboarding_submission_id=p_submission_id,
  verified_at=case when v_verified then now() else null end,
  verified_by=null,status=case when v_verified then 'onboarding_pending' else 'review_required' end,
  updated_at=now() where id=v_h.id;
 return jsonb_build_object('ok',true,'status',case when v_verified then 'onboarding_pending' else 'review_required' end);
end $fn$;
revoke all on function public.portal_admission_handoff_token(text,text,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.portal_admission_handoff_token(text,text,uuid,uuid,text) to service_role;


-- ===== SOURCE: database/connect/saas/55_portal_demo_followup_sync.sql =====
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


-- ===== SOURCE: database/connect/saas/57_auto_reconcile_portal_enrollments_dev.sql =====
-- Automatic once-only confirmation after Portal has truly activated enrolment.
-- Rechecks verified guardian binding, consent, active onboarding and active enrolment.
create or replace function public.connect_reconcile_portal_enrollments(p_batch_size int default 100)
returns jsonb language plpgsql security invoker set search_path='' as $fn$
declare v record;v_count int:=0;v_stage uuid;v_current uuid;
begin
 for v in select h.id,h.tenant_id,h.opportunity_id,h.onboarding_submission_id,
    ob.activated_student_id,ob.activated_enrollment_id
   from connect.portal_admission_handoffs h
   join connect.portal_demo_integrations i on i.tenant_id=h.tenant_id and i.status='active'
   join public.onboarding_submissions ob on ob.id=h.onboarding_submission_id and ob.status='active'
    and ob.data_consent=true and ob.activated_student_id is not null and ob.activated_enrollment_id is not null
   join public.enrollments en on en.id=ob.activated_enrollment_id and en.student_id=ob.activated_student_id and en.status='active'
   where h.status='onboarding_pending' and h.verified_at is not null
   order by h.created_at for update of h skip locked limit least(greatest(p_batch_size,1),500)
 loop
  select o.stage_id into v_current from connect.opportunities o where o.id=v.opportunity_id and o.tenant_id=v.tenant_id for update;
  select s.id into v_stage from connect.pipeline_stages s join connect.opportunities o on o.tenant_id=s.tenant_id and o.pipeline_id=s.pipeline_id
    where o.id=v.opportunity_id and o.tenant_id=v.tenant_id and s.outcome='won' order by s.sort_order limit 1;
  if v_stage is null then continue;end if;
  update connect.portal_admission_handoffs set status='enrollment_confirmed',portal_enrollment_id=v.activated_enrollment_id,
   portal_student_id=v.activated_student_id,confirmed_at=now(),updated_at=now() where id=v.id;
  if v_current is distinct from v_stage then
   update connect.opportunities set stage_id=v_stage,closed_at=now(),version=version+1,updated_at=now()
    where tenant_id=v.tenant_id and id=v.opportunity_id;
   insert into connect.stage_events(tenant_id,opportunity_id,pipeline_id,from_stage_id,to_stage_id,note)
    select v.tenant_id,v.opportunity_id,o.pipeline_id,v_current,v_stage,'Portal enrollment confirmed automatically'
    from connect.opportunities o where o.tenant_id=v.tenant_id and o.id=v.opportunity_id;
  end if;
  v_count:=v_count+1;
 end loop;
 return jsonb_build_object('confirmed',v_count);
end $fn$;
revoke all on function public.connect_reconcile_portal_enrollments(int) from public,anon,authenticated;
grant execute on function public.connect_reconcile_portal_enrollments(int) to service_role;
-- Production scheduling intentionally omitted from this install bundle.


-- ===== SOURCE: database/connect/saas/58_portal_lifecycle_renewals.sql =====
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

COMMIT;
