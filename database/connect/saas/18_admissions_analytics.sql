-- Phase 3C reporting ledger and tenant-isolated analytics.
-- Financial ROI only uses recorded realized revenue and recorded campaign spend,
-- in the same institute base currency and reporting date range.
begin;
create table connect.campaign_spend (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references connect.tenants(id) on delete restrict,
 campaign_id uuid not null,
 spent_on date not null,
 amount numeric(14,2) not null check(amount>=0 and amount<=999999999999.99),
 currency text not null check(currency ~ '^[A-Z]{3}$'),
 note text,
 recorded_by uuid,
 recorded_at timestamptz not null default now(),
 foreign key(tenant_id,campaign_id) references connect.campaigns(tenant_id,id) on delete restrict,
 foreign key(tenant_id,recorded_by) references connect.memberships(tenant_id,id) on delete restrict,
 unique(tenant_id,id)
);
create index connect_campaign_spend_period on connect.campaign_spend(tenant_id,spent_on,campaign_id);
create table connect.realized_revenue (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references connect.tenants(id) on delete restrict,
 opportunity_id uuid not null,
 received_on date not null,
 amount numeric(14,2) not null check(amount>0 and amount<=999999999999.99),
 currency text not null check(currency ~ '^[A-Z]{3}$'),
 external_reference text,
 note text,
 recorded_by uuid,
 recorded_at timestamptz not null default now(),
 foreign key(tenant_id,opportunity_id) references connect.opportunities(tenant_id,id) on delete restrict,
 foreign key(tenant_id,recorded_by) references connect.memberships(tenant_id,id) on delete restrict,
 unique(tenant_id,id)
);
create unique index connect_revenue_external_unique on connect.realized_revenue(tenant_id,external_reference) where external_reference is not null;
create index connect_realized_revenue_period on connect.realized_revenue(tenant_id,received_on,opportunity_id);
-- Exactly one campaign attribution per opportunity for single-touch reporting.
-- Do not force campaign attribution where attribution is unknown.
create unique index connect_one_campaign_per_opportunity
 on connect.attribution(tenant_id,opportunity_id)
 where opportunity_id is not null and campaign_id is not null;
alter table connect.campaign_spend enable row level security;
alter table connect.realized_revenue enable row level security;
revoke all on connect.campaign_spend,connect.realized_revenue from public,anon,authenticated;
grant select,insert,update,delete on connect.campaign_spend,connect.realized_revenue to service_role;

create or replace function public.connect_report_write(
 p_actor_id uuid,p_tenant_id uuid,p_action text,p_data jsonb
) returns jsonb language plpgsql security invoker set search_path=''
as $fn$
declare v_role text;v_member uuid;v_currency text;v_id uuid;v_amount numeric;v_campaign uuid;
begin
 select m.role,m.id,t.default_currency into v_role,v_member,v_currency
 from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.tenant_id=p_tenant_id and m.user_id=p_actor_id
  and m.status='active' and t.status in ('trial','active');
 if v_role not in ('owner','admin','manager') then
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
   if length(coalesce(p_data->>'reference',''))>180 then
    raise exception 'Invalid payment reference' using errcode='22023';end if;
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
end $fn$;

create or replace function public.connect_report_read(
 p_actor_id uuid,p_tenant_id uuid,p_from date,p_to date,
 p_pipeline_id uuid default null
) returns jsonb language plpgsql stable security invoker set search_path=''
as $fn$
declare v_member uuid;v_role text;v_tz text;v_currency text;v_start timestamptz;v_end timestamptz;
 v_summary jsonb;v_funnel jsonb;v_staff jsonb;v_sources jsonb;v_campaigns jsonb;
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
  'spend',sp.amount,'revenue',rv.amount,'opportunities',coalesce(pf.opportunities,0),
  'won',coalesce(pf.won,0),
  'costPerAcquisition',case when coalesce(pf.won,0)=0 or sp.amount is null then null
   else round(sp.amount/pf.won,2) end,
  'roiPercent',case when coalesce(sp.amount,0)<=0 then null
   else round(100*(coalesce(rv.amount,0)-sp.amount)/sp.amount,2) end)
 order by c.name),'[]'::jsonb) into v_campaigns
 from connect.campaigns c
 left join spend sp on sp.campaign_id=c.id
 left join revenue rv on rv.campaign_id=c.id
 left join performance pf on pf.campaign_id=c.id
 where c.tenant_id=p_tenant_id;

 return jsonb_build_object('summary',v_summary,'funnel',v_funnel,'staff',v_staff,
  'sources',v_sources,'campaigns',v_campaigns,
  'definitions',jsonb_build_object(
    'conversion','Currently-won opportunities created during selected period / all opportunities created during that period',
    'staff','Current opportunity owner, not historical closer',
    'funnel','Current stage of opportunities created in selected period, not historical funnel stage-entry counts',
    'sources','Earliest linked enquiry per opportunity; missing source is Unattributed',
    'roi','(Recorded paid revenue minus recorded campaign spend) / campaign spend, by ledger dates',
    'revenue','Only manually recorded receipts; expected pipeline value is not paid revenue',
    'currency',v_currency,'pipelineSpend','Spend is not allocated across pipelines; source ROI is suppressed for pipeline-specific reports'
  ));
end $fn$;
revoke all on function public.connect_report_write(uuid,uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.connect_report_read(uuid,uuid,date,date,uuid) from public,anon,authenticated;
grant execute on function public.connect_report_write(uuid,uuid,text,jsonb) to service_role;
grant execute on function public.connect_report_read(uuid,uuid,date,date,uuid) to service_role;
commit;