-- Robotronix PRODUCTION INSTALL BUNDLE: 08 Unified Facebook/Instagram/Email messaging and WhatsApp triage.
-- Source: observed DEV schema definitions 2026-11-11 for changes absent from historical saas SQL.
-- Run after 07_connect_portal_integrations.sql. Fresh Connect installation only.
BEGIN;
CREATE TABLE connect.email_conversation_recipients (
 tenant_id uuid NOT NULL,
 conversation_id uuid NOT NULL,
 reply_to_email text NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT email_conversation_recipients_pkey PRIMARY KEY (tenant_id,conversation_id),
 CONSTRAINT email_conversation_recipients_tenant_id_conversation_id_fkey FOREIGN KEY (tenant_id,conversation_id) REFERENCES connect.conversations(tenant_id,id) ON DELETE CASCADE
);
CREATE TABLE connect.email_message_headers (
 tenant_id uuid NOT NULL,
 message_id uuid NOT NULL,
 message_header_id text,
 subject text,
 CONSTRAINT email_message_headers_pkey PRIMARY KEY (tenant_id,message_id),
 CONSTRAINT email_message_headers_tenant_id_message_id_fkey FOREIGN KEY (tenant_id,message_id) REFERENCES connect.messages(tenant_id,id) ON DELETE CASCADE
);
CREATE TABLE connect.message_attachments (
 tenant_id uuid NOT NULL,
 message_id uuid NOT NULL,
 provider_attachment_id text NOT NULL,
 filename text,
 content_type text,
 size_bytes bigint CHECK(size_bytes IS NULL OR size_bytes>=0),
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT message_attachments_pkey PRIMARY KEY (tenant_id,message_id,provider_attachment_id),
 CONSTRAINT message_attachments_tenant_id_message_id_fkey FOREIGN KEY (tenant_id,message_id) REFERENCES connect.messages(tenant_id,id) ON DELETE CASCADE
);
CREATE TABLE connect.whatsapp_enquiry_triage (
 tenant_id uuid NOT NULL,
 conversation_id uuid NOT NULL,
 classification text NOT NULL CHECK (classification IN ('enquiry','not_enquiry')),
 inquiry_id uuid,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT whatsapp_enquiry_triage_pkey PRIMARY KEY (tenant_id,conversation_id),
 CONSTRAINT whatsapp_enquiry_triage_check CHECK ((classification='enquiry' and inquiry_id IS NOT NULL) OR (classification='not_enquiry' and inquiry_id IS NULL)),
 CONSTRAINT whatsapp_enquiry_triage_tenant_id_conversation_id_fkey FOREIGN KEY (tenant_id,conversation_id) REFERENCES connect.conversations(tenant_id,id) ON DELETE CASCADE,
 CONSTRAINT whatsapp_enquiry_triage_tenant_id_inquiry_id_fkey FOREIGN KEY (tenant_id,inquiry_id) REFERENCES connect.inquiries(tenant_id,id) ON DELETE RESTRICT
);
DO $security$ DECLARE x text; BEGIN
 FOREACH x IN ARRAY ARRAY['email_conversation_recipients','email_message_headers','message_attachments','whatsapp_enquiry_triage'] LOOP
  EXECUTE format('alter table connect.%I enable row level security',x);
  EXECUTE format('revoke all on table connect.%I from public,anon,authenticated',x);
  EXECUTE format('grant select,insert,update,delete on table connect.%I to service_role',x);
 END LOOP;
END $security$;
-- DEV canonical function: connect_email_attachment_context
CREATE OR REPLACE FUNCTION public.connect_email_attachment_context(p_actor_id uuid, p_tenant_id uuid, p_conversation_id uuid, p_message_id uuid, p_attachment_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare v_data jsonb;
begin
 if not exists(select 1 from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active' and t.status in ('trial','active'))
 then raise exception 'Workspace access denied' using errcode='42501';end if;
 select jsonb_build_object('emailId',m.external_message_id,'attachmentId',ma.provider_attachment_id,
  'filename',ma.filename) into v_data from connect.message_attachments ma
 join connect.messages m on m.id=ma.message_id and m.tenant_id=ma.tenant_id
 join connect.conversations c on c.id=m.conversation_id and c.tenant_id=m.tenant_id
 join connect.channel_accounts a on a.id=c.channel_account_id and a.tenant_id=c.tenant_id
 where ma.tenant_id=p_tenant_id and ma.message_id=p_message_id and ma.provider_attachment_id=p_attachment_id
 and c.id=p_conversation_id and a.provider='email' and a.status='active';
 if v_data is null then raise exception 'Email attachment unavailable' using errcode='42501';end if;
 return v_data;
end $function$;

-- DEV canonical function: connect_enrich_inbound_email
CREATE OR REPLACE FUNCTION public.connect_enrich_inbound_email(p_mailbox text, p_event_id text, p_body text, p_attachments jsonb DEFAULT '[]'::jsonb, p_header_message_id text DEFAULT NULL::text, p_subject text DEFAULT NULL::text, p_sender_email text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_account connect.channel_accounts%rowtype;v_message uuid;v_conversation uuid;v_part jsonb;v_count int:=0;
begin
 if length(coalesce(p_event_id,'')) not between 3 and 250 or length(coalesce(p_body,''))>15000
 or jsonb_typeof(p_attachments)<>'array' or jsonb_array_length(p_attachments)>20 then
 raise exception 'Invalid email payload' using errcode='22023';end if;
 select a.* into v_account from connect.channel_accounts a join connect.tenants t on t.id=a.tenant_id
 where a.provider='email' and a.external_account_id=lower(btrim(p_mailbox))
 and a.status='active' and t.status in ('trial','active');
 if not found then raise exception 'Email channel unavailable' using errcode='42501';end if;
 select m.id,c.id into v_message,v_conversation from connect.messages m join connect.conversations c
 on c.id=m.conversation_id and c.tenant_id=m.tenant_id
 where m.tenant_id=v_account.tenant_id and c.channel_account_id=v_account.id
 and m.external_message_id=p_event_id and m.direction='inbound'
 order by m.occurred_at desc limit 1 for update of m;
 if v_message is null then raise exception 'Email event not ingested yet' using errcode='22023';end if;
 if p_sender_email is not null then
  if length(p_sender_email)>254 or p_sender_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
   raise exception 'Invalid sender address' using errcode='22023';end if;
  insert into connect.email_conversation_recipients(tenant_id,conversation_id,reply_to_email)
  values(v_account.tenant_id,v_conversation,lower(p_sender_email))
  on conflict(tenant_id,conversation_id) do update set reply_to_email=excluded.reply_to_email,updated_at=now();
 end if;
 if nullif(btrim(coalesce(p_body,'')),'') is not null then
  update connect.messages set body=left(p_body,15000),message_type='email'
  where tenant_id=v_account.tenant_id and id=v_message;
 end if;
 insert into connect.email_message_headers(tenant_id,message_id,message_header_id,subject)
 values(v_account.tenant_id,v_message,left(nullif(btrim(p_header_message_id),''),250),left(p_subject,250))
 on conflict(tenant_id,message_id) do update set
 message_header_id=excluded.message_header_id,subject=excluded.subject;
 for v_part in select value from jsonb_array_elements(p_attachments) loop
  if length(coalesce(v_part->>'id','')) between 3 and 250 and
    length(coalesce(v_part->>'filename',''))<=255 and
    length(coalesce(v_part->>'contentType',''))<=150 then
   insert into connect.message_attachments(tenant_id,message_id,provider_attachment_id,filename,content_type,size_bytes)
   values(v_account.tenant_id,v_message,v_part->>'id',nullif(v_part->>'filename',''),
    nullif(v_part->>'contentType',''),case when (v_part->>'size')~'^[0-9]{1,14}$'
    then (v_part->>'size')::bigint else null end)
   on conflict(tenant_id,message_id,provider_attachment_id) do update
   set filename=excluded.filename,content_type=excluded.content_type,size_bytes=excluded.size_bytes;
   v_count:=v_count+1;
  end if;
 end loop;
 return jsonb_build_object('ok',true,'attachments',v_count);
end $function$;

-- DEV canonical function: connect_enrich_social_attachment
CREATE OR REPLACE FUNCTION public.connect_enrich_social_attachment(p_provider text, p_account text, p_event_id text, p_attachments jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_message uuid;v_tenant uuid;v_item jsonb;v_count int:=0;
begin
 if p_provider not in ('instagram','facebook') or length(coalesce(p_event_id,'')) not between 3 and 250
 or jsonb_typeof(p_attachments)<>'array' or jsonb_array_length(p_attachments)>10 then
  raise exception 'Invalid attachment data' using errcode='22023';end if;
 select m.id,m.tenant_id into v_message,v_tenant from connect.messages m
 join connect.conversations c on c.id=m.conversation_id and c.tenant_id=m.tenant_id
 join connect.channel_accounts a on a.id=c.channel_account_id and a.tenant_id=c.tenant_id
 where a.provider=p_provider and a.external_account_id=lower(btrim(p_account))
 and a.status='active' and m.external_message_id=p_event_id limit 1;
 if v_message is null then raise exception 'Social message not found' using errcode='22023';end if;
 for v_item in select value from jsonb_array_elements(p_attachments) loop
  if length(coalesce(v_item->>'id','')) between 3 and 250 then
   insert into connect.message_attachments(tenant_id,message_id,provider_attachment_id,filename,content_type)
   values(v_tenant,v_message,v_item->>'id',left(v_item->>'filename',255),left(v_item->>'contentType',150))
   on conflict(tenant_id,message_id,provider_attachment_id) do nothing;
   v_count:=v_count+1;
  end if;
 end loop;
 return v_count;
end $function$;

-- DEV canonical function: connect_ingest_email_thread
CREATE OR REPLACE FUNCTION public.connect_ingest_email_thread(p_mailbox text, p_event_id text, p_sender_email text, p_sender_name text, p_subject text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_account connect.channel_accounts%rowtype;v_person uuid;v_conversation uuid;v_message uuid;v_sender text;
begin
 v_sender:=lower(btrim(coalesce(p_sender_email,'')));
 if v_sender !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  or length(v_sender)>254 or length(coalesce(p_event_id,'')) not between 3 and 250
  or length(coalesce(p_subject,''))>1500 then raise exception 'Invalid inbound email' using errcode='22023';end if;
 select a.* into v_account from connect.channel_accounts a join connect.tenants t on t.id=a.tenant_id
 where a.provider='email' and a.external_account_id=lower(btrim(p_mailbox))
 and a.status='active' and t.status in ('trial','active');
 if not found then raise exception 'Email channel unavailable' using errcode='42501';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_account.id::text||':'||v_sender,0));
 select c.person_id into v_person from connect.conversations c where c.tenant_id=v_account.tenant_id
 and c.channel_account_id=v_account.id and c.external_thread_id=v_sender;
 if v_person is null then
  select cm.person_id into v_person from connect.contact_methods cm join connect.people p
  on p.id=cm.person_id and p.tenant_id=cm.tenant_id and p.status='active'
  where cm.tenant_id=v_account.tenant_id and cm.kind='email' and cm.normalized_value=v_sender limit 1;
 end if;
 if v_person is null then
  insert into connect.people(tenant_id,full_name)
  values(v_account.tenant_id,left(coalesce(nullif(btrim(p_sender_name),''),v_sender),150)) returning id into v_person;
  insert into connect.person_roles(tenant_id,person_id,role)values(v_account.tenant_id,v_person,'contact');
 end if;
 insert into connect.contact_methods(tenant_id,person_id,kind,normalized_value,display_value,is_primary)
 values(v_account.tenant_id,v_person,'email',v_sender,v_sender,false)
 on conflict(tenant_id,person_id,kind,normalized_value) do nothing;
 insert into connect.conversations(tenant_id,channel_account_id,person_id,external_thread_id)
 values(v_account.tenant_id,v_account.id,v_person,v_sender)
 on conflict(tenant_id,channel_account_id,external_thread_id) where external_thread_id is not null
 do update set person_id=coalesce(connect.conversations.person_id,excluded.person_id)
 returning id into v_conversation;
 insert into connect.messages(tenant_id,conversation_id,external_message_id,direction,body,message_type,delivery_status,occurred_at)
 values(v_account.tenant_id,v_conversation,p_event_id,'inbound',left(coalesce(nullif(p_subject,''),'Email received'),1500),
  'email_subject','received',now())
 on conflict(tenant_id,conversation_id,external_message_id) where external_message_id is not null
 do nothing returning id into v_message;
 if v_message is not null then update connect.conversations set last_message_at=now()
  where tenant_id=v_account.tenant_id and id=v_conversation;end if;
 return jsonb_build_object('ok',true,'duplicate',v_message is null);
end $function$;

-- DEV canonical function: connect_ingest_social_message
CREATE OR REPLACE FUNCTION public.connect_ingest_social_message(p_provider text, p_external_account_id text, p_event_id text, p_sender_id text, p_sender_name text, p_body text, p_occurred_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_direction text DEFAULT 'inbound'::text, p_kind text DEFAULT 'text'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_account connect.channel_accounts%rowtype;v_person uuid;v_conversation uuid;v_message uuid;
 v_scoped text;v_name text;v_at timestamptz;
begin
 if p_provider not in ('instagram','facebook') or p_direction not in ('inbound','outbound')
  or length(coalesce(p_event_id,'')) not between 3 and 250
  or length(coalesce(p_sender_id,'')) not between 3 and 200
  or length(coalesce(p_body,''))>3000 or length(coalesce(p_kind,''))>50 then
  raise exception 'Invalid social message' using errcode='22023';end if;
 select a.* into v_account from connect.channel_accounts a join connect.tenants t on t.id=a.tenant_id
 where a.provider=p_provider and a.external_account_id=lower(btrim(p_external_account_id))
  and a.status='active' and t.status in ('trial','active') for share of a;
 if not found then raise exception 'Social channel unavailable' using errcode='42501';end if;
 v_scoped:=btrim(p_sender_id);
 v_name:=left(coalesce(nullif(btrim(p_sender_name),''),
  case when p_provider='instagram' then 'Instagram contact' else 'Facebook contact' end),150);
 v_at:=case when p_occurred_at between '2000-01-01'::timestamptz and now()+interval '1 day'
  then p_occurred_at else now() end;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_account.id::text||':'||v_scoped,0));
 select c.person_id into v_person from connect.conversations c where c.tenant_id=v_account.tenant_id
  and c.channel_account_id=v_account.id and c.external_thread_id=v_scoped;
 if v_person is null then
  insert into connect.people(tenant_id,full_name) values(v_account.tenant_id,v_name) returning id into v_person;
  insert into connect.person_roles(tenant_id,person_id,role) values(v_account.tenant_id,v_person,'contact');
 end if;
 insert into connect.contact_methods(tenant_id,person_id,kind,normalized_value,display_value,is_primary)
 values(v_account.tenant_id,v_person,'social',p_provider||':'||v_scoped,v_scoped,false)
 on conflict(tenant_id,person_id,kind,normalized_value) do nothing;
 insert into connect.conversations(tenant_id,channel_account_id,person_id,external_thread_id)
 values(v_account.tenant_id,v_account.id,v_person,v_scoped)
 on conflict(tenant_id,channel_account_id,external_thread_id) where external_thread_id is not null
 do update set person_id=coalesce(connect.conversations.person_id,excluded.person_id)
 returning id into v_conversation;
 insert into connect.messages(tenant_id,conversation_id,external_message_id,direction,body,message_type,
  delivery_status,occurred_at,sent_at)
 values(v_account.tenant_id,v_conversation,p_event_id,p_direction,nullif(p_body,''),
  coalesce(nullif(btrim(p_kind),''),'text'),case when p_direction='inbound' then 'received' else 'sent' end,
  v_at,case when p_direction='outbound' then v_at else null end)
 on conflict(tenant_id,conversation_id,external_message_id) where external_message_id is not null
 do nothing returning id into v_message;
 if v_message is not null then update connect.conversations
  set last_message_at=greatest(coalesce(last_message_at,v_at),v_at)
  where tenant_id=v_account.tenant_id and id=v_conversation;end if;
 return jsonb_build_object('ok',true,'duplicate',v_message is null,'conversationId',v_conversation);
end $function$;

-- DEV canonical function: connect_social_reply
CREATE OR REPLACE FUNCTION public.connect_social_reply(p_actor_id uuid, p_tenant_id uuid, p_conversation_id uuid, p_action text, p_request_id uuid DEFAULT NULL::uuid, p_body text DEFAULT NULL::text, p_message_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_member uuid;v_role text;v_account connect.channel_accounts%rowtype;v_recipient text;
 v_last timestamptz;v_reserved uuid;v_outbox connect.outbox%rowtype;
begin
 select m.id,m.role into v_member,v_role from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active' and t.status in ('active','trial');
 if v_member is null then raise exception 'Workspace access denied' using errcode='42501';end if;
 select a.* into v_account from connect.conversations c
 join connect.channel_accounts a on a.id=c.channel_account_id and a.tenant_id=c.tenant_id
 where c.tenant_id=p_tenant_id and c.id=p_conversation_id
 and a.provider in ('instagram','facebook') and a.status='active';
 if not found then raise exception 'Active social conversation unavailable' using errcode='42501';end if;
 select c.external_thread_id into v_recipient from connect.conversations c
 where c.tenant_id=p_tenant_id and c.id=p_conversation_id;
 select max(occurred_at) into v_last from connect.messages
 where tenant_id=p_tenant_id and conversation_id=p_conversation_id and direction='inbound';
 if p_action='context' then
  return jsonb_build_object('provider',v_account.provider,'accountId',v_account.external_account_id,
   'recipient',v_recipient,'canReply',v_role<>'viewer' and v_last>now()-interval '24 hours',
   'lastInboundAt',v_last);
 end if;
 if v_role='viewer' or v_last is null or v_last<=now()-interval '24 hours' then
  raise exception 'Customer-service messaging window is closed' using errcode='42501';end if;
 if p_request_id is null then raise exception 'Request ID required' using errcode='22023';end if;
 if p_action='reserve' then
  if p_body is null or length(btrim(p_body)) not between 1 and 1000 then
   raise exception 'Invalid reply text' using errcode='22023';end if;
  insert into connect.outbox(tenant_id,conversation_id,idempotency_key,body,status)
  values(p_tenant_id,p_conversation_id,p_request_id::text,btrim(p_body),'sending')
  on conflict(tenant_id,idempotency_key) do nothing returning id into v_reserved;
  if v_reserved is null then raise exception 'Message already submitted. Refresh before retrying' using errcode='23505';end if;
  return jsonb_build_object('reservationId',v_reserved,'provider',v_account.provider,
   'accountId',v_account.external_account_id,'recipient',v_recipient);
 elsif p_action='complete' then
  select * into v_outbox from connect.outbox where tenant_id=p_tenant_id
   and conversation_id=p_conversation_id and idempotency_key=p_request_id::text for update;
  if not found or v_outbox.status<>'sending' then raise exception 'Send reservation unavailable' using errcode='42501';end if;
  if p_message_id is not null and length(p_message_id) between 3 and 250 then
   update connect.outbox set status='sent' where id=v_outbox.id;
   insert into connect.messages(tenant_id,conversation_id,external_message_id,direction,body,
    message_type,delivery_status,occurred_at,sent_at)
   values(p_tenant_id,p_conversation_id,p_message_id,'outbound',v_outbox.body,'text','sent',now(),now())
   on conflict(tenant_id,conversation_id,external_message_id) where external_message_id is not null do nothing;
   update connect.conversations set last_message_at=now() where tenant_id=p_tenant_id and id=p_conversation_id;
  else
   update connect.outbox set status='failed' where id=v_outbox.id;
  end if;
  return jsonb_build_object('ok',true);
 end if;
 raise exception 'Invalid reply action' using errcode='22023';
end $function$;

-- DEV canonical function: connect_unified_conversation
CREATE OR REPLACE FUNCTION public.connect_unified_conversation(p_actor_id uuid, p_tenant_id uuid, p_conversation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare v_role text;v_result jsonb;
begin
 select m.role into v_role from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active' and t.status in ('active','trial');
 if v_role is null then raise exception 'Workspace access denied' using errcode='42501';end if;
 select jsonb_build_object('personId',c.person_id,'provider',a.provider,'channelName',a.display_name,
 'externalContactId',c.external_thread_id,'status',c.status,'canWrite',v_role<>'viewer',
 'classification',coalesce(tr.classification,case when a.provider='email' then 'enquiry' else 'unreviewed' end),'inquiryId',tr.inquiry_id,
 'messages',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'body',m.body,'kind',m.message_type,
  'direction',m.direction,'occurredAt',m.occurred_at,'deliveryStatus',m.delivery_status)
  order by m.occurred_at,m.id) from (select * from connect.messages where tenant_id=p_tenant_id
  and conversation_id=p_conversation_id order by occurred_at desc,id desc limit 100) m),'[]'::jsonb)) into v_result
 from connect.conversations c join connect.channel_accounts a on a.tenant_id=c.tenant_id and a.id=c.channel_account_id
 left join connect.whatsapp_enquiry_triage tr on tr.tenant_id=c.tenant_id and tr.conversation_id=c.id
 where c.tenant_id=p_tenant_id and c.id=p_conversation_id and a.provider in ('whatsapp','instagram','facebook','email');
 if v_result is null then raise exception 'Conversation unavailable' using errcode='42501';end if;
 return v_result;
end $function$;

-- DEV canonical function: connect_unified_email_reply
CREATE OR REPLACE FUNCTION public.connect_unified_email_reply(p_actor_id uuid, p_tenant_id uuid, p_conversation_id uuid, p_action text, p_request_id uuid DEFAULT NULL::uuid, p_body text DEFAULT NULL::text, p_message_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_member uuid;v_role text;v_account connect.channel_accounts%rowtype;v_recipient text;v_subject text;v_header text;
 v_outbox connect.outbox%rowtype;v_reserved uuid;
begin
 select m.id,m.role into v_member,v_role from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active' and t.status in ('active','trial');
 if v_member is null then raise exception 'Workspace access denied' using errcode='42501';end if;
 select a.* into v_account from connect.conversations c join connect.channel_accounts a
 on a.id=c.channel_account_id and a.tenant_id=c.tenant_id
 where c.tenant_id=p_tenant_id and c.id=p_conversation_id and a.provider='email' and a.status='active';
 if not found then raise exception 'Email channel unavailable' using errcode='42501';end if;
 select reply_to_email into v_recipient from connect.email_conversation_recipients
 where tenant_id=p_tenant_id and conversation_id=p_conversation_id;
 select eh.subject,eh.message_header_id into v_subject,v_header from connect.messages m
 join connect.email_message_headers eh on eh.tenant_id=m.tenant_id and eh.message_id=m.id
 where m.tenant_id=p_tenant_id and m.conversation_id=p_conversation_id and m.direction='inbound'
 order by m.occurred_at desc limit 1;
 if p_action='context' then
  return jsonb_build_object('canReply',v_role<>'viewer' and v_recipient is not null,
   'sender',v_account.external_account_id,'recipient',v_recipient,
   'subject',coalesce(v_subject,'Robotronix enquiry'),'inReplyTo',v_header);
 end if;
 if v_role='viewer' or v_recipient is null then raise exception 'Email reply unavailable' using errcode='42501';end if;
 if p_request_id is null then raise exception 'Request ID required' using errcode='22023';end if;
 if p_action='reserve' then
  if length(btrim(coalesce(p_body,''))) not between 1 and 12000 then
   raise exception 'Email message must be 1–12000 characters' using errcode='22023';end if;
  insert into connect.outbox(tenant_id,conversation_id,idempotency_key,body,status)
  values(p_tenant_id,p_conversation_id,p_request_id::text,btrim(p_body),'sending')
  on conflict(tenant_id,idempotency_key) do nothing returning id into v_reserved;
  if v_reserved is null then raise exception 'Email already submitted' using errcode='23505';end if;
  return jsonb_build_object('reservationId',v_reserved,'sender',v_account.external_account_id,'recipient',v_recipient);
 elsif p_action='complete' then
  select * into v_outbox from connect.outbox where tenant_id=p_tenant_id
  and conversation_id=p_conversation_id and idempotency_key=p_request_id::text for update;
  if not found or v_outbox.status<>'sending' then raise exception 'Email reservation unavailable' using errcode='42501';end if;
  if length(coalesce(p_message_id,'')) between 3 and 250 then
   update connect.outbox set status='sent' where id=v_outbox.id;
   insert into connect.messages(tenant_id,conversation_id,external_message_id,direction,body,
    message_type,delivery_status,occurred_at,sent_at)
   values(p_tenant_id,p_conversation_id,p_message_id,'outbound',v_outbox.body,'email','sent',now(),now())
   on conflict(tenant_id,conversation_id,external_message_id) where external_message_id is not null do nothing;
   update connect.conversations set last_message_at=now() where tenant_id=p_tenant_id and id=p_conversation_id;
  else update connect.outbox set status='failed' where id=v_outbox.id;end if;
  return jsonb_build_object('ok',true);
 end if;
 raise exception 'Unsupported email action' using errcode='22023';
end $function$;

-- DEV canonical function: connect_unified_link_contact
CREATE OR REPLACE FUNCTION public.connect_unified_link_contact(p_actor_id uuid, p_tenant_id uuid, p_conversation_id uuid, p_person_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_member uuid;v_previous uuid;v_provider text;
begin
 select m.id into v_member from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active' and m.role<>'viewer'
 and t.status in ('active','trial');
 if v_member is null then raise exception 'Write access denied' using errcode='42501';end if;
 if not exists(select 1 from connect.people where tenant_id=p_tenant_id and id=p_person_id and status='active')
 then raise exception 'Contact not found' using errcode='42501';end if;
 select c.person_id,a.provider into v_previous,v_provider from connect.conversations c join connect.channel_accounts a
 on a.tenant_id=c.tenant_id and a.id=c.channel_account_id
 where c.tenant_id=p_tenant_id and c.id=p_conversation_id
 and a.provider in ('whatsapp','instagram','facebook','email') for update of c;
 if not found then raise exception 'Conversation not found' using errcode='42501';end if;
 update connect.conversations set person_id=p_person_id where tenant_id=p_tenant_id and id=p_conversation_id;
 -- The conversation is the stable external-identity anchor. Historical enquiries are kept as-is.
 insert into connect.audit_events(tenant_id,actor_membership_id,event_type,entity_type,entity_id,metadata)
 values(p_tenant_id,v_member,'inbox_contact_linked','conversation',p_conversation_id,
 jsonb_build_object('previousPersonId',v_previous,'personId',p_person_id,'provider',v_provider));
 return jsonb_build_object('ok',true,'personId',p_person_id);
end $function$;

-- DEV canonical function: connect_unified_mark_read
CREATE OR REPLACE FUNCTION public.connect_unified_mark_read(p_actor_id uuid, p_tenant_id uuid, p_conversation_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_member uuid;
begin
 select m.id into v_member from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active' and t.status in ('trial','active');
 if v_member is null or not exists(select 1 from connect.conversations c join connect.channel_accounts a
  on a.id=c.channel_account_id and a.tenant_id=c.tenant_id
  where c.tenant_id=p_tenant_id and c.id=p_conversation_id
  and a.provider in ('whatsapp','instagram','facebook','email')) then
  raise exception 'Conversation unavailable' using errcode='42501';end if;
 insert into connect.whatsapp_thread_state(tenant_id,conversation_id,member_id,last_read_at)
 values(p_tenant_id,p_conversation_id,v_member,now())
 on conflict(tenant_id,conversation_id,member_id) do update
  set last_read_at=greatest(coalesce(connect.whatsapp_thread_state.last_read_at,excluded.last_read_at),excluded.last_read_at),updated_at=now();
 return true;
end $function$;

-- DEV canonical function: connect_unified_message_attachments
CREATE OR REPLACE FUNCTION public.connect_unified_message_attachments(p_actor_id uuid, p_tenant_id uuid, p_conversation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare v_data jsonb;
begin
 if not exists(select 1 from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.tenant_id=p_tenant_id and m.user_id=p_actor_id and m.status='active' and t.status in ('trial','active'))
 then raise exception 'Workspace access denied' using errcode='42501';end if;
 if not exists(select 1 from connect.conversations where tenant_id=p_tenant_id and id=p_conversation_id)
 then raise exception 'Conversation not found' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('messageId',ma.message_id,'id',ma.provider_attachment_id,
  'filename',ma.filename,'contentType',ma.content_type,'size',ma.size_bytes)
 order by ma.message_id,ma.provider_attachment_id),'[]'::jsonb) into v_data
 from connect.message_attachments ma join connect.messages m on m.tenant_id=ma.tenant_id and m.id=ma.message_id
 where ma.tenant_id=p_tenant_id and m.conversation_id=p_conversation_id;
 return v_data;
end $function$;

-- DEV canonical function: connect_unified_threads
CREATE OR REPLACE FUNCTION public.connect_unified_threads(p_actor_id uuid, p_tenant_id uuid, p_limit integer DEFAULT 50, p_before_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_before_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare v_member uuid;v_page jsonb;v_count int;v_size int:=least(100,greatest(1,coalesce(p_limit,50)));v_last jsonb;
begin
 select m.id into v_member from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active' and t.status in ('active','trial');
 if v_member is null then raise exception 'Workspace access denied' using errcode='42501';end if;
 if (p_before_at is null)<>(p_before_id is null) then raise exception 'Invalid cursor' using errcode='22023';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'provider',x.provider,'channelName',x.channel_name,
  'personId',x.person_id,'personName',x.person_name,'externalContactId',x.external_thread_id,
  'status',x.status,'lastAt',x.last_at,'lastMessage',x.last_body,'lastDirection',x.last_direction,
  'unreadCount',x.unread_count,'classification',coalesce(x.classification,case when x.provider='email' then 'enquiry' else 'unreviewed' end))
  order by x.last_at desc,x.id desc),'[]'::jsonb),count(*) into v_page,v_count from (
 select c.id,a.provider,a.display_name channel_name,c.person_id,p.full_name person_name,
  c.external_thread_id,c.status,coalesce(c.last_message_at,c.created_at) last_at,
  msg.body last_body,msg.direction last_direction,
  (select count(*)::int from connect.messages m where m.tenant_id=c.tenant_id
   and m.conversation_id=c.id and m.direction='inbound'
   and m.occurred_at>coalesce(s.last_read_at,'-infinity'::timestamptz)) unread_count,
  tri.classification from connect.conversations c join connect.channel_accounts a
  on a.id=c.channel_account_id and a.tenant_id=c.tenant_id and a.provider in ('whatsapp','instagram','facebook','email')
  left join connect.people p on p.tenant_id=c.tenant_id and p.id=c.person_id
  left join connect.whatsapp_thread_state s on s.tenant_id=c.tenant_id and s.conversation_id=c.id and s.member_id=v_member
  left join connect.whatsapp_enquiry_triage tri on tri.tenant_id=c.tenant_id and tri.conversation_id=c.id
  left join lateral (select m.body,m.direction from connect.messages m where m.tenant_id=c.tenant_id
   and m.conversation_id=c.id order by m.occurred_at desc,m.id desc limit 1) msg on true
  where c.tenant_id=p_tenant_id and (p_before_at is null or
   (coalesce(c.last_message_at,c.created_at),c.id)<(p_before_at,p_before_id))
  order by last_at desc,c.id desc limit v_size+1) x;
 if v_count>v_size then
  v_page:=(select coalesce(jsonb_agg(z.item order by z.ord),'[]'::jsonb)
   from jsonb_array_elements(v_page) with ordinality z(item,ord) where z.ord<=v_size);
  v_last:=v_page->(v_size-1);
  return jsonb_build_object('items',v_page,'nextCursor',jsonb_build_object('at',v_last->>'lastAt','id',v_last->>'id'));
 end if;
 return jsonb_build_object('items',v_page,'nextCursor',null);
end $function$;

-- DEV canonical function: connect_whatsapp_triage
CREATE OR REPLACE FUNCTION public.connect_whatsapp_triage(p_actor_id uuid, p_tenant_id uuid, p_conversation_id uuid, p_action text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_member uuid;v_role text;v_person uuid;v_channel uuid;v_provider text;v_name text;v_inquiry uuid;v_existing uuid;v_summary text;
begin
 select m.id,m.role into v_member,v_role from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active'
 and t.status in ('active','trial');
 if v_member is null or (v_role='viewer' and p_action<>'state') then
  raise exception 'Access denied' using errcode='42501';end if;
 select c.person_id,c.channel_account_id,a.provider into v_person,v_channel,v_provider from connect.conversations c
 join connect.channel_accounts a on a.tenant_id=c.tenant_id and a.id=c.channel_account_id
 where c.tenant_id=p_tenant_id and c.id=p_conversation_id and a.provider in ('whatsapp','instagram','facebook','email') for update of c;
 if not found or v_person is null then raise exception 'Messaging contact not found' using errcode='42501';end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Invalid payload' using errcode='22023';end if;
 if p_action='state' then
  return coalesce((select jsonb_build_object('classification',classification,'inquiryId',inquiry_id)
   from connect.whatsapp_enquiry_triage where tenant_id=p_tenant_id and conversation_id=p_conversation_id),
   jsonb_build_object('classification','unreviewed','inquiryId',null));
 elsif p_action='save_name' then
  v_name:=nullif(btrim(p_data->>'name'),'');
  if v_name is null or length(v_name)>150 then raise exception 'Enter a valid name' using errcode='22023';end if;
  update connect.people set full_name=v_name,updated_at=now()
  where tenant_id=p_tenant_id and id=v_person and status='active';
 elsif p_action='not_enquiry' then
  if exists(select 1 from connect.whatsapp_enquiry_triage where tenant_id=p_tenant_id
   and conversation_id=p_conversation_id and classification='enquiry') then
   raise exception 'Already linked to an enquiry; do not discard it' using errcode='22023';
  end if;
  insert into connect.whatsapp_enquiry_triage(tenant_id,conversation_id,classification)
  values(p_tenant_id,p_conversation_id,'not_enquiry')
  on conflict(tenant_id,conversation_id) do update set classification='not_enquiry',updated_at=now();
 elsif p_action='mark_enquiry' then
  v_summary:=nullif(btrim(p_data->>'summary'),'');
  if v_summary is null or length(v_summary)>2000 then raise exception 'Enquiry details required (up to 2000 characters)' using errcode='22023';end if;
  select inquiry_id into v_existing from connect.whatsapp_enquiry_triage
  where tenant_id=p_tenant_id and conversation_id=p_conversation_id and classification='enquiry';
  if v_existing is not null then return jsonb_build_object('ok',true,'inquiryId',v_existing,'alreadyLinked',true);end if;
  insert into connect.inquiries(tenant_id,person_id,channel_account_id,source,summary)
  values(p_tenant_id,v_person,v_channel,v_provider,v_summary) returning id into v_inquiry;
  insert into connect.whatsapp_enquiry_triage(tenant_id,conversation_id,classification,inquiry_id)
  values(p_tenant_id,p_conversation_id,'enquiry',v_inquiry)
  on conflict(tenant_id,conversation_id) do update set classification='enquiry',inquiry_id=excluded.inquiry_id,updated_at=now();
 else raise exception 'Unsupported triage action' using errcode='22023';end if;
 insert into connect.audit_events(tenant_id,actor_membership_id,event_type,entity_type,entity_id,metadata)
 values(p_tenant_id,v_member,'whatsapp_'||p_action,'conversation',p_conversation_id,
  jsonb_build_object('inquiryId',v_inquiry));
 return jsonb_build_object('ok',true,'inquiryId',v_inquiry);
end $function$;
DO $acl$ DECLARE r record; BEGIN FOR r IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('connect_email_attachment_context','connect_enrich_inbound_email','connect_enrich_social_attachment','connect_ingest_email_thread','connect_ingest_social_message','connect_social_reply','connect_unified_conversation','connect_unified_email_reply','connect_unified_link_contact','connect_unified_mark_read','connect_unified_message_attachments','connect_unified_threads','connect_whatsapp_triage') LOOP EXECUTE format('revoke all on function %s from public,anon,authenticated',r.oid::regprocedure); EXECUTE format('grant execute on function %s to service_role',r.oid::regprocedure); END LOOP; END $acl$;
COMMIT;
