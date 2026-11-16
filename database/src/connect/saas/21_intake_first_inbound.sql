-- Admission-safe inbound policy. All inbound messages are enquiries, not automatically admissions.
-- Apply after base ingestion migration (12) and preference migration (20).
create or replace function connect.ingest_event(
 p_account_id uuid,p_event_id text,p_name text,p_email text,p_phone text,p_source text,p_summary text
) returns jsonb language plpgsql volatile security invoker set search_path=''
as $fn$
declare v_account connect.channel_accounts%rowtype;v_person uuid;v_inquiry uuid;v_opp uuid;
 v_pipeline uuid;v_stage uuid;v_email text;v_phone text;v_name text;v_receipt uuid;v_conversation uuid;
begin
 select * into v_account from connect.channel_accounts c
  where c.id=p_account_id and c.status='active' for share;
 if not found then raise exception 'Inactive or unknown channel' using errcode='42501';end if;
 if not exists(select 1 from connect.tenants where id=v_account.tenant_id and status in ('trial','active'))
 then raise exception 'Workspace unavailable' using errcode='42501';end if;
 if p_event_id is null or length(p_event_id) not between 3 and 250
    or p_source is null or length(p_source) not between 2 and 80
 then raise exception 'Invalid event identity' using errcode='22023';end if;
 v_name:=nullif(btrim(coalesce(p_name,'')),'');
 v_email:=nullif(lower(btrim(coalesce(p_email,''))),'');
 v_phone:=nullif(regexp_replace(coalesce(p_phone,''),'[^0-9+]','','g'),'');
 if v_name is null then v_name:='Unknown contact';end if;
 if length(v_name)>150 or length(coalesce(v_email,''))>254
    or (v_email is not null and v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
    or length(coalesce(v_phone,''))>35 or length(coalesce(p_summary,''))>3000
    or (v_email is null and v_phone is null)
 then raise exception 'Invalid lead details' using errcode='22023';end if;

 -- A duplicate provider delivery must be a no-op, including concurrent retries.
 insert into connect.webhook_receipts(
  tenant_id,channel_account_id,external_event_id,event_type,payload,status,attempts)
 values(v_account.tenant_id,v_account.id,p_event_id,'lead_ingest',
    jsonb_build_object('source',p_source), 'pending',1)
 on conflict(tenant_id,channel_account_id,external_event_id) do nothing
 returning id into v_receipt;
 if v_receipt is null then return jsonb_build_object('ok',true,'duplicate',true);end if;

 -- Serialize matching lead contact identity within a tenant; no cross-institute sharing.
 perform pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(v_account.tenant_id::text||':'||coalesce(v_email,v_phone),0));
 if v_email is not null then
  select c.person_id into v_person from connect.contact_methods c
  join connect.people p on p.tenant_id=c.tenant_id and p.id=c.person_id and p.status='active'
  where c.tenant_id=v_account.tenant_id and c.kind='email' and c.normalized_value=v_email
  order by c.created_at,c.id limit 1;
 end if;
 if v_person is null and v_phone is not null then
  select c.person_id into v_person from connect.contact_methods c
  join connect.people p on p.tenant_id=c.tenant_id and p.id=c.person_id and p.status='active'
  where c.tenant_id=v_account.tenant_id and c.kind in ('mobile','phone','whatsapp')
   and c.normalized_value=v_phone
  order by c.created_at,c.id limit 1;
 end if;
 if v_person is null then
  insert into connect.people(tenant_id,full_name) values(v_account.tenant_id,v_name)
    returning id into v_person;
  insert into connect.person_roles(tenant_id,person_id,role)
    values(v_account.tenant_id,v_person,'contact');
 end if;
 if v_email is not null and not exists(
   select 1 from connect.contact_methods where tenant_id=v_account.tenant_id
   and person_id=v_person and kind='email' and normalized_value=v_email
 ) then
  insert into connect.contact_methods(tenant_id,person_id,kind,normalized_value,display_value,is_primary)
   values(v_account.tenant_id,v_person,'email',v_email,v_email,
    not exists(select 1 from connect.contact_methods where tenant_id=v_account.tenant_id
      and person_id=v_person and kind='email'));
 end if;
 if v_phone is not null and not exists(
   select 1 from connect.contact_methods where tenant_id=v_account.tenant_id
   and person_id=v_person and kind='mobile' and normalized_value=v_phone
 ) then
  insert into connect.contact_methods(tenant_id,person_id,kind,normalized_value,display_value,is_primary)
   values(v_account.tenant_id,v_person,'mobile',v_phone,v_phone,
    not exists(select 1 from connect.contact_methods where tenant_id=v_account.tenant_id
      and person_id=v_person and kind='mobile'));
 end if;

 -- Intake-first policy: a message from a trainer, supplier or collaborator is not an admission.
 -- Review/classify the enquiry before opening any pipeline opportunity.
 -- Deliberately do not create or reuse an admissions deal during channel ingestion.
 if v_account.provider in ('whatsapp','email') then
  insert into connect.conversations(tenant_id,channel_account_id,person_id,external_thread_id)
  values(v_account.tenant_id,v_account.id,v_person,v_person::text)
  on conflict(tenant_id,channel_account_id,external_thread_id) where external_thread_id is not null
    do update set person_id=excluded.person_id
  returning id into v_conversation;
  insert into connect.messages(tenant_id,conversation_id,external_message_id,direction,body)
  values(v_account.tenant_id,v_conversation,p_event_id,'inbound',left(p_summary,2000))
  on conflict(tenant_id,conversation_id,external_message_id) where external_message_id is not null do nothing;
 end if;
 insert into connect.inquiries(tenant_id,person_id,opportunity_id,
  channel_account_id,external_event_id,source,summary)
 values(v_account.tenant_id,v_person,v_opp,v_account.id,p_event_id,p_source,left(p_summary,2000))
 returning id into v_inquiry;
 update connect.webhook_receipts set status='processed',processed_at=now()
 where id=v_receipt;
 insert into connect.audit_events(tenant_id,event_type,entity_type,entity_id,metadata)
 values(v_account.tenant_id,'external_lead_ingested','inquiry',v_inquiry,
  jsonb_build_object('provider',v_account.provider,'channelAccountId',v_account.id));
 return jsonb_build_object('ok',true,'duplicate',false,'inquiryId',v_inquiry,'personId',v_person,'opportunityId',v_opp);
end $fn$;
