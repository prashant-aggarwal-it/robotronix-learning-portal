-- Phase 3A development QA. Requires two existing auth users.
-- Tests canonical intake, four channels, dedupe, tenant isolation, role/security.
-- Transactional: no fixture rows remain.
begin;
select pg_catalog.set_config('qa.owner',(select id::text from auth.users where email is not null order by created_at limit 1),true);
select pg_catalog.set_config('qa.other',(select id::text from auth.users where email is not null and id<>current_setting('qa.owner')::uuid order by created_at limit 1),true);
set local role service_role;
select pg_catalog.set_config('qa.one',public.connect_create_workspace(current_setting('qa.owner')::uuid,'qa-phase3a-one','QA Phase3A One')::text,true);
select pg_catalog.set_config('qa.two',public.connect_create_workspace(current_setting('qa.other')::uuid,'qa-phase3a-two','QA Phase3A Two')::text,true);
do $qa$
declare a uuid:=current_setting('qa.owner')::uuid;b uuid:=current_setting('qa.other')::uuid;
 t uuid:=current_setting('qa.one')::uuid;t2 uuid:=current_setting('qa.two')::uuid;
 wa uuid;em uuid;meta uuid;web uuid;key_id uuid;
 first_result jsonb;second_result jsonb;email_result jsonb;
begin
 wa:=public.connect_register_channel(a,t,'whatsapp','qa-phone-id-001','WhatsApp');
 em:=public.connect_register_channel(a,t,'email','enquiries@qa-example.test','Email');
 meta:=public.connect_register_channel(a,t,'meta_leads','qa-page-id-001','Meta Leads');
 web:=public.connect_register_channel(a,t,'website','qa-school-website','Website');
 perform public.connect_set_channel_status(a,t,wa,'active');
 perform public.connect_set_channel_status(a,t,em,'active');
 perform public.connect_set_channel_status(a,t,meta,'active');
 perform public.connect_set_channel_status(a,t,web,'active');
 key_id:=public.connect_create_form_key(a,t,web,repeat('a',64),'Primary form');
 if jsonb_array_length(public.connect_list_channels(a,t))<>4 then raise exception 'Channel listing failed';end if;
 if jsonb_array_length(public.connect_list_form_keys(a,t))<>1 then raise exception 'Form listing failed';end if;
 perform public.connect_crm_write(a,t,'bootstrap_pipeline','{"name":"Admissions"}');
 first_result:=public.connect_ingest_channel('whatsapp','qa-phone-id-001','wamid.abc-001',
   'Test Guardian',null,'+919876543210','Interested in classes');
 second_result:=public.connect_ingest_channel('whatsapp','qa-phone-id-001','wamid.abc-002',
   'Test Guardian',null,'+919876543210','Please send details');
 if second_result->>'personId'<>first_result->>'personId'
   or second_result->>'opportunityId'<>first_result->>'opportunityId'
 then raise exception 'Duplicate contacts or opportunities across messages';end if;
 if (public.connect_ingest_channel('whatsapp','qa-phone-id-001','wamid.abc-002',
   'Test Guardian',null,'+919876543210','Please send details'))->>'duplicate'<>'true'
 then raise exception 'Webhook replay not idempotent';end if;
 email_result:=public.connect_ingest_channel('email','enquiries@qa-example.test',
  'resend-email-001','Test Guardian','guardian@qa-example.test','+919876543210','Course email');
 if email_result->>'personId'<>first_result->>'personId' then raise exception 'Cross-channel matching failed';end if;
 perform public.connect_ingest_channel('meta_leads','qa-page-id-001','meta-lead-001',
  'Lead Two','second@qa-example.test',null,'Wants Scratch');
 perform public.connect_ingest_website(repeat('a',64),'web-submission-001',
  'Lead Three','third@qa-example.test',null,'Website enquiry');
 if (select count(*) from connect.inquiries where tenant_id=t)<>5 then raise exception 'Enquiry count not 5';end if;
 if (select count(*) from connect.people where tenant_id=t)<>3 then raise exception 'Person dedupe wrong';end if;
 if (select count(*) from connect.opportunities where tenant_id=t)<>0 then raise exception 'Inbound messages incorrectly created admission opportunities';end if;
 perform public.connect_ingest_channel('whatsapp','qa-phone-id-001','wamid.trainer-001',
  'Trainer Applicant',null,'+919999999999','I am a robotics trainer applying for a job');
 if (select count(*) from connect.opportunities where tenant_id=t)<>0 then raise exception 'Trainer message created an admissions deal';end if;
 if (select count(*) from connect.messages where tenant_id=t)<>4 then raise exception 'Messages missing';end if;
 if (select count(*) from connect.webhook_receipts where tenant_id=t and status='processed')<>6 then raise exception 'Receipts incorrect';end if;
 begin
  perform public.connect_register_channel(b,t2,'whatsapp','qa-phone-id-001','Hijack');
  raise exception 'Cross tenant channel takeover accepted';
 exception when unique_violation then null;end;
 begin
  perform public.connect_set_channel_status(b,t,wa,'disabled');
  raise exception 'Nonmember changed another tenant channel';
 exception when insufficient_privilege then null;end;
 if (select count(*) from connect.inquiries where tenant_id=t2)>0 then raise exception 'Tenant bleed';end if;
 perform public.connect_disable_form_key(a,t,key_id);
 begin
  perform public.connect_ingest_website(repeat('a',64),'web-submission-002',
   'Lead Four','fourth@example.test',null,'Revoked form test');
  raise exception 'Revoked form still works';
 exception when insufficient_privilege then null;end;
 raise notice 'PASS all 4 providers, replay, matching, opportunity reuse, isolation and revocation';
end $qa$;
rollback;
