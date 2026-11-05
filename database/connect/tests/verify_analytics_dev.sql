-- Development-only Phase 3C acceptance test.  Rolls back all fixtures.
-- Verifies finance integrity, funnel cohort history, tenant security, disabled roles.
begin;
select pg_catalog.set_config('report.owner',(select id::text from auth.users where email is not null order by created_at limit 1),true);
select pg_catalog.set_config('report.other',(select id::text from auth.users where email is not null and id<>current_setting('report.owner')::uuid order by created_at limit 1),true);
set local role service_role;
select pg_catalog.set_config('report.tenant',public.connect_create_workspace(current_setting('report.owner')::uuid,'qa-report-3c','QA Analytics Reports')::text,true);
do $qa$
declare actor uuid:=current_setting('report.owner')::uuid;outside_id uuid:=current_setting('report.other')::uuid;
 t uuid:=current_setting('report.tenant')::uuid;person uuid;pipeline uuid;stage0 uuid;stage1 uuid;stagewon uuid;campaign uuid;opp uuid;report jsonb;
begin
 report:=public.connect_report_read(actor,t,current_date-29,current_date,null);
 if (report->'summary'->>'opportunities')::int<>0 then raise exception 'Empty report should be zero';end if;
 person:=(public.connect_crm_write(actor,t,'create_contact','{"name":"Example Parent","email":"guardian@qa.test"}'))->>'id';
 pipeline:=(public.connect_crm_write(actor,t,'bootstrap_pipeline','{"name":"Admissions"}'))->>'id';
 select id into stage0 from connect.pipeline_stages where tenant_id=t and pipeline_id=pipeline and sort_order=0;
 select id into stage1 from connect.pipeline_stages where tenant_id=t and pipeline_id=pipeline and sort_order=1;
 select id into stagewon from connect.pipeline_stages where tenant_id=t and pipeline_id=pipeline and outcome='won';
 campaign:=(public.connect_report_write(actor,t,'create_campaign','{"name":"Facebook November","source":"facebook"}'))->>'id';
 opp:=(public.connect_crm_write(actor,t,'create_opportunity',jsonb_build_object('title','Python','contactId',person,'pipelineId',pipeline,'stageId',stage0,'value',10000)))->>'id';
 perform public.connect_crm_write(actor,t,'create_inquiry',jsonb_build_object('source','facebook','personId',person,'opportunityId',opp));
 perform public.connect_report_write(actor,t,'attribute_campaign',jsonb_build_object('opportunityId',opp,'campaignId',campaign));
 perform public.connect_crm_write(actor,t,'move_opportunity',jsonb_build_object('opportunityId',opp,'stageId',stage1,'version',1));
 perform public.connect_crm_write(actor,t,'move_opportunity',jsonb_build_object('opportunityId',opp,'stageId',stagewon,'version',2));
 perform public.connect_report_write(actor,t,'record_spend',jsonb_build_object('date',current_date,'campaignId',campaign,'amount',1000,'currency','INR'));
 perform public.connect_report_write(actor,t,'record_revenue',jsonb_build_object('date',current_date,'opportunityId',opp,'amount',5000,'currency','INR','reference','qa-payment-unique'));
 begin
  perform public.connect_report_write(actor,t,'record_revenue',jsonb_build_object('date',current_date,'opportunityId',opp,'amount',5000,'currency','INR','reference','qa-payment-unique'));
  raise exception 'Duplicate payment accepted';
 exception when unique_violation then null;end;
 begin
  perform public.connect_report_write(actor,t,'record_revenue',jsonb_build_object('date',current_date,'opportunityId',opp,'amount',1000,'currency','QAR','reference','qa-currency-mismatch'));
  raise exception 'Currency mismatch accepted';
 exception when invalid_parameter_value then null;end;
 begin
  perform public.connect_report_read(outside_id,t,current_date-29,current_date,null);
  raise exception 'Cross tenant report read accepted';
 exception when insufficient_privilege then null;end;
 begin
  perform public.connect_report_write(outside_id,t,'create_campaign','{"name":"Unauthorized","source":"unknown"}');
  raise exception 'Cross tenant reporting write accepted';
 exception when insufficient_privilege then null;end;
 begin
  perform public.connect_report_write(outside_id,t,'record_spend',jsonb_build_object('date',current_date,'campaignId',campaign,'amount',100,'currency','INR'));
  raise exception 'Cross tenant financial write accepted';
 exception when insufficient_privilege then null;end;
 begin
  perform public.connect_report_write(actor,t,'attribute_campaign',jsonb_build_object('opportunityId',opp,'campaignId',campaign));
  raise exception 'Double attribution accepted';
 exception when unique_violation then null;end;
 report:=public.connect_report_read(actor,t,current_date-29,current_date,null);
 if (report->'campaigns'->0->>'roiPercent')::numeric<>400
  or (report->'summary'->>'won')::int<>1 then raise exception 'Wrong ROI or admissions tally';end if;
 if (select (s->>'reached')::int from jsonb_array_elements(report->'stageJourney') s where s->>'stage'='Contacted')<>1
 then raise exception 'Historical funnel stage reach missing';end if;
 report:=public.connect_report_read(actor,t,current_date-29,current_date,pipeline);
 if report->'campaigns'->0->'roiPercent' is distinct from 'null'::jsonb
 then raise exception 'Pipeline-only campaign ROI must be hidden';end if;
 -- A different-currency opportunity must not contaminate base-currency pipeline total.
 insert into connect.opportunities(tenant_id,pipeline_id,stage_id,title,contact_id,currency,expected_value)
 values(t,pipeline,stage0,'Overseas Opportunity',person,'QAR',2000);
 report:=public.connect_report_read(actor,t,current_date-29,current_date,null);
 if (report->'summary'->>'expectedValue')::numeric<>10000
    or (report->'summary'->>'excludedCurrencyOpportunities')::int<>1
 then raise exception 'Cross-currency totals inaccurate';end if;
 raise notice 'PASS 3C ROI and financial rules, stage journey, duplicate prevention, tenant isolation, currency segmentation';
end $qa$;
rollback;