-- Rollback-only Dev QA for classification and safe provider intake.
begin;
select pg_catalog.set_config('qa.owner',(select id::text from auth.users where email is not null order by created_at limit 1),true);
select pg_catalog.set_config('qa.other',(select id::text from auth.users where email is not null and id<>current_setting('qa.owner')::uuid order by created_at limit 1),true);
set local role service_role;
select pg_catalog.set_config('qa.tenant',public.connect_create_workspace(current_setting('qa.owner')::uuid,'qa-simple-mode-new','QA Simple Mode New')::text,true);
do $qa$
declare t uuid:=current_setting('qa.tenant')::uuid;actor uuid:=current_setting('qa.owner')::uuid;other_actor uuid:=current_setting('qa.other')::uuid;
 c uuid;category uuid;item uuid;result jsonb;settings jsonb;
begin
 settings:=public.connect_enquiry_preferences(actor,t);
 if settings->>'mode'<>'simple' or jsonb_array_length(settings->'categories')<>9 then raise exception 'Invalid workspace defaults';end if;
 category:=(select id from connect.enquiry_categories where tenant_id=t and label='Trainer / Job Applicant');
 result:=public.connect_crm_write(actor,t,'capture_lead',jsonb_build_object('name','Sample Contact','source','phone','categoryId',category));
 item:=(result->>'id')::uuid;
 if (select category_id from connect.inquiries where tenant_id=t and id=item)<>category then raise exception 'Missing captured category';end if;
 if result->>'opportunityId' is not null then raise exception 'Unwanted admissions opportunity';end if;
 perform public.connect_enquiry_preferences(actor,t,'set_mode','{"mode":"advanced"}');
 if (public.connect_enquiry_preferences(actor,t))->>'mode'<>'advanced' then raise exception 'Mode not saved';end if;
 perform public.connect_enquiry_preferences(actor,t,'set_mode','{"mode":"simple"}');
 c:=public.connect_register_channel(actor,t,'whatsapp','qa-simple-test-1','Test Channel');
 perform public.connect_set_channel_status(actor,t,c,'active');
 result:=public.connect_ingest_channel('whatsapp','qa-simple-test-1','qa-message-001','Applicant',null,'+910000000123','Seeking an instructor position');
 if result->>'opportunityId' is not null then raise exception 'Inbound created an admissions opportunity';end if;
 if (select count(*) from connect.inquiries where tenant_id=t)<>2 then raise exception 'Expected 2 enquiries';end if;
 if (select count(*) from connect.tasks where tenant_id=t and status='open')<>2 then
  raise exception 'Expected follow-up tasks for both people';end if;
 perform public.connect_ingest_channel('whatsapp','qa-simple-test-1','qa-message-002','Applicant',null,'+910000000123','Following up on enquiry');
 if (select count(*) from connect.tasks where tenant_id=t and status='open')<>2 then
  raise exception 'Repeated message created a duplicate follow-up';end if;
 begin
  perform public.connect_enquiry_preferences(other_actor,t,'set_mode','{"mode":"advanced"}');
  raise exception 'Cross-workspace mode change not blocked';
 exception when insufficient_privilege then null;end;
 begin
  perform public.connect_enquiry_preferences(other_actor,t,'classify_inquiry',jsonb_build_object('inquiryId',item,'categoryId',category));
  raise exception 'Cross-workspace classification not blocked';
 exception when insufficient_privilege then null;end;
 raise notice 'PASS: defaults, mode persistence, safe intake, category integrity, tenant isolation';
end $qa$;
rollback;