-- Robotronix PRODUCTION INSTALL BUNDLE: 05 WhatsApp messaging, inbox, history and coexistence schema.
-- Run once after 04_connect_contacts.sql. This DOES NOT register numbers or enable live messaging.
-- No Meta credentials, jobs or sample data are installed.
BEGIN;
DO $guard$ BEGIN IF to_regclass('connect.people') IS NULL THEN RAISE EXCEPTION 'Connect foundation missing'; END IF; END $guard$;

-- ===== SOURCE: database/connect/saas/28_whatsapp_messaging_foundation.sql =====
-- WhatsApp Foundation Phase 1 (DEV): preserve messages separately from enquiries.
-- All persisted data belongs to the private connect schema. Only service_role may invoke RPCs.
alter table connect.messages add column if not exists message_type text not null default 'text';
alter table connect.messages add column if not exists media_id text;
alter table connect.messages add column if not exists media_mime_type text;
alter table connect.messages add column if not exists media_filename text;
alter table connect.messages add column if not exists reply_to_external_message_id text;
alter table connect.messages add column if not exists sent_at timestamptz;
alter table connect.messages add column if not exists delivered_at timestamptz;
alter table connect.messages add column if not exists read_at timestamptz;
alter table connect.messages add column if not exists failed_at timestamptz;
alter table connect.messages add column if not exists failure_reason text;
alter table connect.conversations add column if not exists last_message_at timestamptz;
create unique index if not exists idx_connect_whatsapp_active_number_global
 on connect.channel_accounts(provider,external_account_id)
 where provider='whatsapp' and status='active' and external_account_id is not null;
create unique index if not exists idx_connect_msg_external_id
 on connect.messages(tenant_id,conversation_id,external_message_id) where external_message_id is not null;
create index if not exists idx_connect_conv_recent
 on connect.conversations(tenant_id,channel_account_id,last_message_at desc nulls last);
create index if not exists idx_connect_msg_recent
 on connect.messages(tenant_id,conversation_id,occurred_at desc);

create table if not exists connect.whatsapp_delivery_events(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null,
 channel_account_id uuid not null,
 external_message_id text not null,
 status text not null check(status in ('sent','delivered','read','failed')),
 occurred_at timestamptz not null,
 failure_reason text,
 created_at timestamptz not null default now(),
 unique(tenant_id,channel_account_id,external_message_id,status),
 foreign key (tenant_id,channel_account_id) references connect.channel_accounts(tenant_id,id) on delete restrict
);
create index if not exists idx_connect_wa_delivery_pending
 on connect.whatsapp_delivery_events(tenant_id,channel_account_id,external_message_id);
alter table connect.whatsapp_delivery_events enable row level security;
revoke all on connect.whatsapp_delivery_events from public,anon,authenticated;
grant select,insert,update,delete on connect.whatsapp_delivery_events to service_role;

create or replace function public.connect_ingest_whatsapp_message(
 p_external_account_id text,p_message_id text,p_contact_wa_id text,p_contact_name text,
 p_kind text,p_body text,p_occurred_at timestamptz default null,
 p_media_id text default null,p_media_mime_type text default null,p_media_filename text default null,
 p_reply_to_id text default null,p_direction text default 'inbound'
) returns jsonb language plpgsql set search_path='' as $fn$
declare v_account connect.channel_accounts%rowtype; v_phone text;v_person uuid;v_conv uuid;
 v_msg uuid;v_inquiry uuid;v_created boolean:=false;v_count int;v_type text;
 v_at timestamptz;v_name text;
begin
 if p_message_id is null or length(p_message_id) not between 3 and 250 or
    p_direction not in ('inbound','outbound') then
  raise exception 'Invalid WhatsApp event' using errcode='22023';
 end if;
 v_type:=coalesce(nullif(btrim(p_kind),''),'unknown');
 if v_type not in ('text','image','video','audio','document','sticker','location','contacts','button','interactive','reaction','unknown')
 then v_type:='unknown';end if;
 if length(coalesce(p_body,''))>3000 or length(coalesce(p_media_id,''))>250 or
  length(coalesce(p_media_mime_type,''))>150 or length(coalesce(p_media_filename,''))>255 or
  length(coalesce(p_reply_to_id,''))>250 then
  raise exception 'WhatsApp content too long' using errcode='22023';
 end if;
 select count(*) into v_count from connect.channel_accounts a
 where a.provider='whatsapp' and a.external_account_id=lower(btrim(p_external_account_id))
 and a.status='active';
 if v_count<>1 then raise exception 'WhatsApp channel unavailable or ambiguous' using errcode='42501';end if;
 select a.* into v_account from connect.channel_accounts a join connect.tenants t on t.id=a.tenant_id
 where a.provider='whatsapp' and a.external_account_id=lower(btrim(p_external_account_id))
 and a.status='active' and t.status in ('trial','active') for share of a;
 if not found then raise exception 'WhatsApp channel unavailable' using errcode='42501';end if;
 v_phone:=pg_catalog.regexp_replace(coalesce(p_contact_wa_id,''),'[^0-9]','','g');
 if length(v_phone) not between 8 and 15 then raise exception 'Invalid sender number' using errcode='22023';end if;
 v_phone:='+'||v_phone;
 v_at:=case when p_occurred_at between '2000-01-01'::timestamptz and now()+interval '1 day'
 then p_occurred_at else now() end;
 v_name:=nullif(btrim(p_contact_name),'');
 if v_name is null then v_name:='WhatsApp contact';end if;
 v_name:=left(v_name,150);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_account.tenant_id::text||':'||v_phone,0));
 select c.person_id into v_person from connect.contact_methods c
 join connect.people p on p.tenant_id=c.tenant_id and p.id=c.person_id and p.status='active'
 where c.tenant_id=v_account.tenant_id and c.kind in ('whatsapp','mobile','phone')
 and pg_catalog.regexp_replace(c.normalized_value,'[^0-9]','','g')=substring(v_phone from 2)
 order by c.created_at,c.id limit 1;
 if v_person is null then
  insert into connect.people(tenant_id,full_name) values(v_account.tenant_id,v_name)
  returning id into v_person;
  insert into connect.person_roles(tenant_id,person_id,role)
  values(v_account.tenant_id,v_person,'contact');
  v_created:=true;
 end if;
 insert into connect.contact_methods(tenant_id,person_id,kind,normalized_value,display_value,is_primary)
 values(v_account.tenant_id,v_person,'whatsapp',v_phone,v_phone,
  not exists(select 1 from connect.contact_methods where tenant_id=v_account.tenant_id and person_id=v_person and kind='whatsapp'))
 on conflict(tenant_id,person_id,kind,normalized_value) do nothing;
 insert into connect.conversations(tenant_id,channel_account_id,person_id,external_thread_id)
 values(v_account.tenant_id,v_account.id,v_person,substring(v_phone from 2))
 on conflict(tenant_id,channel_account_id,external_thread_id) where external_thread_id is not null
 do update set person_id=excluded.person_id
 returning id into v_conv;
 insert into connect.messages(tenant_id,conversation_id,external_message_id,direction,body,
  message_type,media_id,media_mime_type,media_filename,reply_to_external_message_id,
  delivery_status,occurred_at,sent_at)
 values(v_account.tenant_id,v_conv,p_message_id,p_direction,nullif(p_body,''),
  v_type,nullif(p_media_id,''),nullif(p_media_mime_type,''),nullif(p_media_filename,''),nullif(p_reply_to_id,''),
  case when p_direction='inbound' then 'received' else 'sent' end,v_at,
  case when p_direction='outbound' then v_at else null end)
 on conflict(tenant_id,conversation_id,external_message_id) where external_message_id is not null do nothing
 returning id into v_msg;
 if v_msg is null then return jsonb_build_object('ok',true,'duplicate',true,'contactId',v_person,'conversationId',v_conv);end if;
 update connect.conversations set last_message_at=greatest(coalesce(last_message_at,v_at),v_at)
 where tenant_id=v_account.tenant_id and id=v_conv;
 -- Create a single unclassified enquiry only on FIRST inbound contact creation.
 -- Repeated chat messages never create new enquiries.
 if v_created and p_direction='inbound' then
  insert into connect.inquiries(tenant_id,person_id,channel_account_id,external_event_id,source,summary)
  values(v_account.tenant_id,v_person,v_account.id,p_message_id,'whatsapp',left(coalesce(nullif(p_body,''),'WhatsApp message received'),2000))
  returning id into v_inquiry;
 end if;
 -- Status callbacks can arrive before the outbound message has been persisted.
 if p_direction='outbound' then
  update connect.messages m set
   sent_at=coalesce((select min(e.occurred_at) from connect.whatsapp_delivery_events e where
     e.tenant_id=v_account.tenant_id and e.channel_account_id=v_account.id and e.external_message_id=p_message_id and e.status='sent'),m.sent_at),
   delivered_at=(select min(e.occurred_at) from connect.whatsapp_delivery_events e where
     e.tenant_id=v_account.tenant_id and e.channel_account_id=v_account.id and e.external_message_id=p_message_id and e.status='delivered'),
   read_at=(select min(e.occurred_at) from connect.whatsapp_delivery_events e where
     e.tenant_id=v_account.tenant_id and e.channel_account_id=v_account.id and e.external_message_id=p_message_id and e.status='read')
  where m.id=v_msg and m.tenant_id=v_account.tenant_id;
  update connect.messages m set delivery_status=
   case when m.read_at is not null then 'read' when m.delivered_at is not null then 'delivered'
   else 'sent' end where m.id=v_msg and m.tenant_id=v_account.tenant_id;
 end if;
 return jsonb_build_object('ok',true,'duplicate',false,'contactId',v_person,
  'conversationId',v_conv,'messageId',v_msg,'enquiryId',v_inquiry);
end $fn$;

create or replace function public.connect_ingest_whatsapp_status(
 p_external_account_id text,p_message_id text,p_status text,p_occurred_at timestamptz default null,
 p_failure_reason text default null
) returns jsonb language plpgsql set search_path='' as $fn$
declare v_account connect.channel_accounts%rowtype;v_at timestamptz;v_updated int;
begin
 if p_message_id is null or length(p_message_id) not between 3 and 250 or
 p_status not in ('sent','delivered','read','failed') or length(coalesce(p_failure_reason,''))>500
 then raise exception 'Invalid WhatsApp status event' using errcode='22023';end if;
 select a.* into v_account from connect.channel_accounts a join connect.tenants t on t.id=a.tenant_id
 where a.provider='whatsapp' and a.external_account_id=lower(btrim(p_external_account_id))
 and a.status='active' and t.status in ('trial','active');
 if not found then raise exception 'WhatsApp channel unavailable' using errcode='42501';end if;
 if (select count(*) from connect.channel_accounts where provider='whatsapp' and
  external_account_id=lower(btrim(p_external_account_id)) and status='active')<>1 then
 raise exception 'Ambiguous WhatsApp channel' using errcode='42501';end if;
 v_at:=case when p_occurred_at between '2000-01-01'::timestamptz and now()+interval '1 day'
 then p_occurred_at else now() end;
 insert into connect.whatsapp_delivery_events(tenant_id,channel_account_id,external_message_id,status,occurred_at,failure_reason)
 values(v_account.tenant_id,v_account.id,p_message_id,p_status,v_at,left(p_failure_reason,500))
 on conflict(tenant_id,channel_account_id,external_message_id,status)
 do update set occurred_at=least(connect.whatsapp_delivery_events.occurred_at,excluded.occurred_at),
 failure_reason=coalesce(connect.whatsapp_delivery_events.failure_reason,excluded.failure_reason);
 update connect.messages m set
  sent_at=case when p_status='sent' then coalesce(least(m.sent_at,v_at),v_at) else m.sent_at end,
  delivered_at=case when p_status='delivered' then coalesce(least(m.delivered_at,v_at),v_at) else m.delivered_at end,
  read_at=case when p_status='read' then coalesce(least(m.read_at,v_at),v_at) else m.read_at end,
  failed_at=case when p_status='failed' then coalesce(m.failed_at,v_at) else m.failed_at end,
  failure_reason=case when p_status='failed' then left(p_failure_reason,500) else m.failure_reason end,
  delivery_status=case when p_status='read' then 'read'
   when p_status='delivered' then case when m.delivery_status='read' then 'read' else 'delivered' end
   when p_status='sent' then case when m.delivery_status in ('read','delivered') then m.delivery_status else 'sent' end
   when p_status='failed' then case when m.delivery_status in ('read','delivered') then m.delivery_status else 'failed' end
   else m.delivery_status end
 from connect.conversations c
 where m.tenant_id=v_account.tenant_id and m.conversation_id=c.id
 and c.tenant_id=v_account.tenant_id and c.channel_account_id=v_account.id
 and m.external_message_id=p_message_id and m.direction='outbound';
 get diagnostics v_updated=row_count;
 return jsonb_build_object('ok',true,'matched',v_updated>0,'status',p_status);
end $fn$;

-- Compatibility: other signed inbound adapters may still call the older generic RPC.
-- Explicitly route WhatsApp through the message-only path; retain old behaviour for other providers.
create or replace function public.connect_ingest_channel(
 p_provider text,p_external_account_id text,p_event_id text,p_name text,
 p_email text,p_phone text,p_summary text
) returns jsonb language plpgsql set search_path='' as $fn$
declare v_id uuid;
begin
 if p_provider='whatsapp' then
  return public.connect_ingest_whatsapp_message(p_external_account_id,p_event_id,p_phone,
   p_name,'text',p_summary);
 end if;
 select c.id into v_id from connect.channel_accounts c
 where c.provider=p_provider and c.external_account_id=lower(btrim(p_external_account_id))
 and c.status='active';
 if v_id is null then raise exception 'Unregistered channel' using errcode='42501';end if;
 return connect.ingest_event(v_id,p_event_id,p_name,p_email,p_phone,p_provider,p_summary);
end $fn$;

revoke all on function public.connect_ingest_whatsapp_message(text,text,text,text,text,text,timestamptz,text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.connect_ingest_whatsapp_status(text,text,text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.connect_ingest_whatsapp_message(text,text,text,text,text,text,timestamptz,text,text,text,text,text) to service_role;
grant execute on function public.connect_ingest_whatsapp_status(text,text,text,timestamptz,text) to service_role;
notify pgrst,'reload schema';


-- ===== SOURCE: database/connect/saas/29_whatsapp_inbox_read_apis.sql =====
-- WhatsApp foundation (DEV): tenant-scoped read APIs for the future unified inbox.
-- Thread and message lists use stable keyset pagination; private schema stays unexposed.
create or replace function public.connect_whatsapp_threads(
 p_actor_id uuid,p_tenant_id uuid,p_limit integer default 40,
 p_before_at timestamptz default null,p_before_id uuid default null
) returns jsonb language plpgsql stable set search_path='' as $fn$
declare v_page jsonb;v_last jsonb;v_size int:=least(100,greatest(1,coalesce(p_limit,40)));v_count int;
begin
 if not exists(select 1 from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active'
 and t.status in ('active','trial')) then raise exception 'Workspace access denied' using errcode='42501';end if;
 if (p_before_at is null)<>(p_before_id is null) then raise exception 'Invalid cursor' using errcode='22023';end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',x.id,'channelId',x.channel_id,'channelName',x.channel_name,
  'personId',x.person_id,'personName',x.person_name,'phone',x.phone,
  'status',x.status,'lastAt',x.last_at,'lastMessage',x.last_body,
  'lastType',x.last_type,'lastDirection',x.last_direction,
  'lastDeliveryStatus',x.last_delivery_status
 ) order by x.last_at desc,x.id desc),'[]'::jsonb),count(*) into v_page,v_count
 from (
  select c.id,a.id channel_id,a.display_name channel_name,c.person_id,
  coalesce(p.full_name,'Unknown contact') person_name,c.external_thread_id phone,c.status,
  coalesce(c.last_message_at,c.created_at) last_at,
  m.body last_body,m.message_type last_type,m.direction last_direction,m.delivery_status last_delivery_status
  from connect.conversations c join connect.channel_accounts a
   on a.tenant_id=c.tenant_id and a.id=c.channel_account_id and a.provider='whatsapp'
  left join connect.people p on p.tenant_id=c.tenant_id and p.id=c.person_id
  left join lateral (select body,message_type,direction,delivery_status from connect.messages m
   where m.tenant_id=c.tenant_id and m.conversation_id=c.id
   order by m.occurred_at desc,m.id desc limit 1) m on true
  where c.tenant_id=p_tenant_id and (p_before_at is null or
   (coalesce(c.last_message_at,c.created_at),c.id)<(p_before_at,p_before_id))
  order by last_at desc,c.id desc limit v_size+1
 ) x;
 if v_count>v_size then
  v_page:=(select coalesce(jsonb_agg(z.item order by z.ord),'[]'::jsonb)
   from jsonb_array_elements(v_page) with ordinality as z(item,ord) where z.ord<=v_size);
  v_last:=v_page->(v_size-1);
  return jsonb_build_object('items',v_page,'nextCursor',
    jsonb_build_object('at',v_last->>'lastAt','id',v_last->>'id'));
 end if;
 return jsonb_build_object('items',v_page,'nextCursor',null);
end $fn$;

create or replace function public.connect_whatsapp_conversation_messages(
 p_actor_id uuid,p_tenant_id uuid,p_conversation_id uuid,
 p_limit integer default 50,p_before_at timestamptz default null,p_before_id uuid default null
) returns jsonb language plpgsql stable set search_path='' as $fn$
declare v_page jsonb;v_last jsonb;v_size int:=least(100,greatest(1,coalesce(p_limit,50)));v_count int;
begin
 if not exists(select 1 from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active'
 and t.status in ('active','trial')) then raise exception 'Workspace access denied' using errcode='42501';end if;
 if not exists(select 1 from connect.conversations c join connect.channel_accounts a
 on a.tenant_id=c.tenant_id and a.id=c.channel_account_id and a.provider='whatsapp'
 where c.tenant_id=p_tenant_id and c.id=p_conversation_id)
 then raise exception 'Conversation unavailable' using errcode='42501';end if;
 if (p_before_at is null)<>(p_before_id is null) then raise exception 'Invalid cursor' using errcode='22023';end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',x.id,'externalId',x.external_message_id,'direction',x.direction,
  'body',x.body,'kind',x.message_type,'mediaId',x.media_id,
  'mediaMimeType',x.media_mime_type,'mediaFilename',x.media_filename,
  'replyTo',x.reply_to_external_message_id,'deliveryStatus',x.delivery_status,
  'occurredAt',x.occurred_at,'sentAt',x.sent_at,'deliveredAt',x.delivered_at,
  'readAt',x.read_at,'failedAt',x.failed_at,'failureReason',x.failure_reason
 ) order by x.occurred_at desc,x.id desc),'[]'::jsonb),count(*) into v_page,v_count
 from (
  select m.* from connect.messages m where m.tenant_id=p_tenant_id and m.conversation_id=p_conversation_id
  and (p_before_at is null or (m.occurred_at,m.id)<(p_before_at,p_before_id))
  order by m.occurred_at desc,m.id desc limit v_size+1
 ) x;
 if v_count>v_size then
  v_page:=(select coalesce(jsonb_agg(z.item order by z.ord),'[]'::jsonb)
   from jsonb_array_elements(v_page) with ordinality as z(item,ord) where z.ord<=v_size);
  v_last:=v_page->(v_size-1);
  return jsonb_build_object('items',v_page,'nextCursor',
   jsonb_build_object('at',v_last->>'occurredAt','id',v_last->>'id'));
 end if;
 return jsonb_build_object('items',v_page,'nextCursor',null);
end $fn$;
revoke all on function public.connect_whatsapp_threads(uuid,uuid,integer,timestamptz,uuid) from public,anon,authenticated;
revoke all on function public.connect_whatsapp_conversation_messages(uuid,uuid,uuid,integer,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.connect_whatsapp_threads(uuid,uuid,integer,timestamptz,uuid) to service_role;
grant execute on function public.connect_whatsapp_conversation_messages(uuid,uuid,uuid,integer,timestamptz,uuid) to service_role;
notify pgrst,'reload schema';


-- ===== SOURCE: database/connect/saas/30_whatsapp_inbox_workflow.sql =====
-- Phase 2 WhatsApp inbox: read state, conversation assignment, CRM linking and saved drafts.
-- No outbound Meta API calls; the composer stores drafts until live sending is configured.
alter table connect.conversations add column if not exists assigned_membership_id uuid;
do $ddl$ begin
 if not exists(select 1 from pg_constraint where conrelid='connect.conversations'::regclass and conname='conversations_assigned_membership_fk') then
 alter table connect.conversations add constraint conversations_assigned_membership_fk
 foreign key (tenant_id,assigned_membership_id) references connect.memberships(tenant_id,id) on delete restrict;
 end if;
end $ddl$;
create index if not exists idx_connect_wa_conversation_assignee on connect.conversations(tenant_id,assigned_membership_id);

create table if not exists connect.whatsapp_thread_state(
 tenant_id uuid not null,
 conversation_id uuid not null,
 member_id uuid not null,
 last_read_at timestamptz,
 draft_text text not null default '' check(length(draft_text)<=3000),
 updated_at timestamptz not null default now(),
 primary key(tenant_id,conversation_id,member_id),
 foreign key(tenant_id,conversation_id) references connect.conversations(tenant_id,id) on delete cascade,
 foreign key(tenant_id,member_id) references connect.memberships(tenant_id,id) on delete cascade
);
create index if not exists idx_connect_wa_state_member on connect.whatsapp_thread_state(tenant_id,member_id);
alter table connect.whatsapp_thread_state enable row level security;
revoke all on connect.whatsapp_thread_state from public,anon,authenticated;
grant select,insert,update,delete on connect.whatsapp_thread_state to service_role;

create or replace function public.connect_whatsapp_manage_thread(
 p_actor_id uuid,p_tenant_id uuid,p_conversation_id uuid,p_action text,p_data jsonb default '{}'::jsonb
) returns jsonb language plpgsql set search_path='' as $fn$
declare v_member uuid;v_role text;v_target uuid;v_value text;v_link_person uuid;
begin
 select m.id,m.role into v_member,v_role from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active' and t.status in ('active','trial');
 if v_member is null then raise exception 'Workspace access denied' using errcode='42501';end if;
 if not exists(select 1 from connect.conversations c join connect.channel_accounts a
  on a.id=c.channel_account_id and a.tenant_id=c.tenant_id and a.provider='whatsapp'
  where c.tenant_id=p_tenant_id and c.id=p_conversation_id) then
  raise exception 'Conversation unavailable' using errcode='42501';end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Invalid request' using errcode='22023';end if;
 case p_action
 when 'mark_read' then
  insert into connect.whatsapp_thread_state(tenant_id,conversation_id,member_id,last_read_at)
  values(p_tenant_id,p_conversation_id,v_member,now())
  on conflict(tenant_id,conversation_id,member_id) do update
   set last_read_at=greatest(coalesce(connect.whatsapp_thread_state.last_read_at,excluded.last_read_at),excluded.last_read_at),
       updated_at=now();
 when 'save_draft' then
  if v_role='viewer' then raise exception 'Write access denied' using errcode='42501';end if;
  v_value:=coalesce(p_data->>'text','');
  if length(v_value)>3000 then raise exception 'Draft exceeds limit' using errcode='22023';end if;
  insert into connect.whatsapp_thread_state(tenant_id,conversation_id,member_id,draft_text)
  values(p_tenant_id,p_conversation_id,v_member,v_value)
  on conflict(tenant_id,conversation_id,member_id) do update
   set draft_text=excluded.draft_text,updated_at=now();
 when 'set_status' then
  if v_role='viewer' then raise exception 'Write access denied' using errcode='42501';end if;
  v_value:=p_data->>'status';
  if v_value not in ('open','pending','closed') then raise exception 'Invalid conversation status' using errcode='22023';end if;
  update connect.conversations set status=v_value where tenant_id=p_tenant_id and id=p_conversation_id;
 when 'assign' then
  if v_role not in ('owner','admin','manager') then raise exception 'Manager access required' using errcode='42501';end if;
  v_target:=nullif(p_data->>'memberId','')::uuid;
  if v_target is not null and not exists(select 1 from connect.memberships where
   tenant_id=p_tenant_id and id=v_target and status='active' and role<>'viewer') then
   raise exception 'Invalid assignee' using errcode='42501';
  end if;
  update connect.conversations set assigned_membership_id=v_target
  where tenant_id=p_tenant_id and id=p_conversation_id;
 when 'link_contact' then
  if v_role='viewer' then raise exception 'Write access denied' using errcode='42501';end if;
  v_link_person:=nullif(p_data->>'personId','')::uuid;
  if v_link_person is null or not exists(select 1 from connect.people
   where tenant_id=p_tenant_id and id=v_link_person and status='active') then
   raise exception 'Invalid contact' using errcode='22023';
  end if;
  update connect.conversations set person_id=v_link_person
  where tenant_id=p_tenant_id and id=p_conversation_id;
 else raise exception 'Unsupported action' using errcode='22023';
 end case;
 if p_action in ('assign','link_contact','set_status') then
  insert into connect.audit_events(tenant_id,actor_membership_id,event_type,entity_type,entity_id,metadata)
  values(p_tenant_id,v_member,'whatsapp_'||p_action,'conversation',p_conversation_id,
   jsonb_build_object('action',p_action));
 end if;
 return jsonb_build_object('ok',true);
end $fn$;

create or replace function public.connect_whatsapp_thread_details(
 p_actor_id uuid,p_tenant_id uuid,p_conversation_id uuid
) returns jsonb language plpgsql stable set search_path='' as $fn$
declare v_member uuid;v_result jsonb;
begin
 select m.id into v_member from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active' and t.status in ('active','trial');
 if v_member is null then raise exception 'Workspace access denied' using errcode='42501';end if;
 select jsonb_build_object('conversationId',c.id,'personId',c.person_id,
  'status',c.status,'assignedMemberId',c.assigned_membership_id,
  'draft',coalesce(s.draft_text,''),'lastReadAt',s.last_read_at,
  'canWrite',m.role<>'viewer',
  'canAssign',m.role in ('owner','admin','manager'),
  'team',coalesce((select jsonb_agg(jsonb_build_object('id',tm.id,'label',coalesce(u.full_name,'Team member'),'role',tm.role)
    order by u.full_name) from connect.memberships tm join public.profiles u on u.id=tm.user_id
   where tm.tenant_id=p_tenant_id and tm.status='active' and tm.role<>'viewer'),'[]'::jsonb)
 ) into v_result from connect.conversations c
 join connect.channel_accounts a on a.tenant_id=c.tenant_id and a.id=c.channel_account_id and a.provider='whatsapp'
 join connect.memberships m on m.id=v_member
 left join connect.whatsapp_thread_state s on s.tenant_id=c.tenant_id and s.conversation_id=c.id and s.member_id=v_member
 where c.tenant_id=p_tenant_id and c.id=p_conversation_id;
 if v_result is null then raise exception 'Conversation unavailable' using errcode='42501';end if;
 return v_result;
end $fn$;

create or replace function public.connect_whatsapp_contact_search(
 p_actor_id uuid,p_tenant_id uuid,p_query text default '',p_limit integer default 25
) returns jsonb language plpgsql stable set search_path='' as $fn$
declare v_result jsonb;v_query text:=left(btrim(coalesce(p_query,'')),100);
begin
 if not exists(select 1 from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active' and t.status in ('active','trial'))
 then raise exception 'Workspace access denied' using errcode='42501';end if;
 if length(v_query)<2 then return '[]'::jsonb;end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'name',x.full_name,'phone',x.phone)
  order by x.full_name,x.id),'[]'::jsonb) into v_result
 from (select p.id,p.full_name,
  (select cm.display_value from connect.contact_methods cm where cm.tenant_id=p_tenant_id and cm.person_id=p.id
   and cm.kind in ('whatsapp','mobile','phone') order by cm.is_primary desc,cm.created_at limit 1) phone
  from connect.people p where p.tenant_id=p_tenant_id and p.status='active'
  and (p.full_name ilike '%'||v_query||'%' or exists(
   select 1 from connect.contact_methods cm where cm.tenant_id=p_tenant_id and cm.person_id=p.id
   and cm.normalized_value ilike '%'||v_query||'%'))
  order by p.full_name,p.id limit least(50,greatest(1,coalesce(p_limit,25)))) x;
 return v_result;
end $fn$;

-- Enhanced thread list preserves the Phase 1 pagination contract.
create or replace function public.connect_whatsapp_threads(
 p_actor_id uuid,p_tenant_id uuid,p_limit integer default 40,
 p_before_at timestamptz default null,p_before_id uuid default null
) returns jsonb language plpgsql stable set search_path='' as $fn$
declare v_page jsonb;v_last jsonb;v_size int:=least(100,greatest(1,coalesce(p_limit,40)));v_count int;v_member uuid;
begin
 select m.id into v_member from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active' and t.status in ('active','trial');
 if v_member is null then raise exception 'Workspace access denied' using errcode='42501';end if;
 if (p_before_at is null)<>(p_before_id is null) then raise exception 'Invalid cursor' using errcode='22023';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',x.id,
  'channelId',x.channel_id,'channelName',x.channel_name,'personId',x.person_id,
  'personName',x.person_name,'phone',x.phone,'status',x.status,'assignedMemberId',x.assigned_member,
  'lastAt',x.last_at,'lastMessage',x.last_body,'lastType',x.last_type,'lastDirection',x.last_direction,
  'lastDeliveryStatus',x.last_delivery_status,'unreadCount',x.unread_count
 ) order by x.last_at desc,x.id desc),'[]'::jsonb),count(*) into v_page,v_count
 from (
  select c.id,a.id channel_id,a.display_name channel_name,c.person_id,
   coalesce(p.full_name,'Unknown contact') person_name,c.external_thread_id phone,c.status,
   c.assigned_membership_id assigned_member,
   coalesce(c.last_message_at,c.created_at) last_at,
   recent.body last_body,recent.message_type last_type,recent.direction last_direction,
   recent.delivery_status last_delivery_status,
   (select count(*)::int from connect.messages m where m.tenant_id=p_tenant_id and m.conversation_id=c.id
    and m.direction='inbound' and m.occurred_at>coalesce(state.last_read_at,'-infinity'::timestamptz)) unread_count
  from connect.conversations c join connect.channel_accounts a
   on a.tenant_id=c.tenant_id and a.id=c.channel_account_id and a.provider='whatsapp'
  left join connect.people p on p.tenant_id=c.tenant_id and p.id=c.person_id
  left join connect.whatsapp_thread_state state on state.tenant_id=c.tenant_id
   and state.conversation_id=c.id and state.member_id=v_member
  left join lateral (select m.body,m.message_type,m.direction,m.delivery_status from connect.messages m
   where m.tenant_id=c.tenant_id and m.conversation_id=c.id
   order by m.occurred_at desc,m.id desc limit 1) recent on true
  where c.tenant_id=p_tenant_id and (p_before_at is null or
   (coalesce(c.last_message_at,c.created_at),c.id)<(p_before_at,p_before_id))
  order by last_at desc,c.id desc limit v_size+1
 ) x;
 if v_count>v_size then
  v_page:=(select coalesce(jsonb_agg(z.item order by z.ord),'[]'::jsonb)
   from jsonb_array_elements(v_page) with ordinality as z(item,ord) where z.ord<=v_size);
  v_last:=v_page->(v_size-1);
  return jsonb_build_object('items',v_page,'nextCursor',
   jsonb_build_object('at',v_last->>'lastAt','id',v_last->>'id'));
 end if;
 return jsonb_build_object('items',v_page,'nextCursor',null);
end $fn$;

revoke all on function public.connect_whatsapp_manage_thread(uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.connect_whatsapp_thread_details(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.connect_whatsapp_contact_search(uuid,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.connect_whatsapp_manage_thread(uuid,uuid,uuid,text,jsonb) to service_role;
grant execute on function public.connect_whatsapp_thread_details(uuid,uuid,uuid) to service_role;
grant execute on function public.connect_whatsapp_contact_search(uuid,uuid,text,integer) to service_role;
notify pgrst,'reload schema';


-- ===== SOURCE: database/connect/saas/31_whatsapp_preserve_contact_links.sql =====
-- Preserve manually linked CRM identity on all future messages on a WhatsApp thread.
create or replace function public.connect_ingest_whatsapp_message(
 p_external_account_id text,p_message_id text,p_contact_wa_id text,p_contact_name text,
 p_kind text,p_body text,p_occurred_at timestamptz default null,
 p_media_id text default null,p_media_mime_type text default null,p_media_filename text default null,
 p_reply_to_id text default null,p_direction text default 'inbound'
) returns jsonb language plpgsql set search_path='' as $fn$
declare v_account connect.channel_accounts%rowtype; v_phone text;v_person uuid;v_conv uuid;
 v_msg uuid;v_inquiry uuid;v_created boolean:=false;v_count int;v_type text;
 v_at timestamptz;v_name text;
begin
 if p_message_id is null or length(p_message_id) not between 3 and 250 or
    p_direction not in ('inbound','outbound') then
  raise exception 'Invalid WhatsApp event' using errcode='22023';
 end if;
 v_type:=coalesce(nullif(btrim(p_kind),''),'unknown');
 if v_type not in ('text','image','video','audio','document','sticker','location','contacts','button','interactive','reaction','unknown')
 then v_type:='unknown';end if;
 if length(coalesce(p_body,''))>3000 or length(coalesce(p_media_id,''))>250 or
  length(coalesce(p_media_mime_type,''))>150 or length(coalesce(p_media_filename,''))>255 or
  length(coalesce(p_reply_to_id,''))>250 then
  raise exception 'WhatsApp content too long' using errcode='22023';
 end if;
 select count(*) into v_count from connect.channel_accounts a
 where a.provider='whatsapp' and a.external_account_id=lower(btrim(p_external_account_id))
 and a.status='active';
 if v_count<>1 then raise exception 'WhatsApp channel unavailable or ambiguous' using errcode='42501';end if;
 select a.* into v_account from connect.channel_accounts a join connect.tenants t on t.id=a.tenant_id
 where a.provider='whatsapp' and a.external_account_id=lower(btrim(p_external_account_id))
 and a.status='active' and t.status in ('trial','active') for share of a;
 if not found then raise exception 'WhatsApp channel unavailable' using errcode='42501';end if;
 v_phone:=pg_catalog.regexp_replace(coalesce(p_contact_wa_id,''),'[^0-9]','','g');
 if length(v_phone) not between 8 and 15 then raise exception 'Invalid sender number' using errcode='22023';end if;
 v_phone:='+'||v_phone;
 v_at:=case when p_occurred_at between '2000-01-01'::timestamptz and now()+interval '1 day'
 then p_occurred_at else now() end;
 v_name:=nullif(btrim(p_contact_name),'');
 if v_name is null then v_name:='WhatsApp contact';end if;
 v_name:=left(v_name,150);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_account.tenant_id::text||':'||v_phone,0));
 -- Preserve explicitly linked CRM contact on existing channel-specific conversation.
 select c.person_id into v_person from connect.conversations c
 where c.tenant_id=v_account.tenant_id and c.channel_account_id=v_account.id
 and c.external_thread_id=substring(v_phone from 2);
 if v_person is null then
 select c.person_id into v_person from connect.contact_methods c
 join connect.people p on p.tenant_id=c.tenant_id and p.id=c.person_id and p.status='active'
 where c.tenant_id=v_account.tenant_id and c.kind in ('whatsapp','mobile','phone')
 and pg_catalog.regexp_replace(c.normalized_value,'[^0-9]','','g')=substring(v_phone from 2)
 order by c.created_at,c.id limit 1;
 end if;
 if v_person is null then
  insert into connect.people(tenant_id,full_name) values(v_account.tenant_id,v_name)
  returning id into v_person;
  insert into connect.person_roles(tenant_id,person_id,role)
  values(v_account.tenant_id,v_person,'contact');
  v_created:=true;
 end if;
 insert into connect.contact_methods(tenant_id,person_id,kind,normalized_value,display_value,is_primary)
 values(v_account.tenant_id,v_person,'whatsapp',v_phone,v_phone,
  not exists(select 1 from connect.contact_methods where tenant_id=v_account.tenant_id and person_id=v_person and kind='whatsapp'))
 on conflict(tenant_id,person_id,kind,normalized_value) do nothing;
 insert into connect.conversations(tenant_id,channel_account_id,person_id,external_thread_id)
 values(v_account.tenant_id,v_account.id,v_person,substring(v_phone from 2))
 on conflict(tenant_id,channel_account_id,external_thread_id) where external_thread_id is not null
 do update set person_id=excluded.person_id
 returning id into v_conv;
 insert into connect.messages(tenant_id,conversation_id,external_message_id,direction,body,
  message_type,media_id,media_mime_type,media_filename,reply_to_external_message_id,
  delivery_status,occurred_at,sent_at)
 values(v_account.tenant_id,v_conv,p_message_id,p_direction,nullif(p_body,''),
  v_type,nullif(p_media_id,''),nullif(p_media_mime_type,''),nullif(p_media_filename,''),nullif(p_reply_to_id,''),
  case when p_direction='inbound' then 'received' else 'sent' end,v_at,
  case when p_direction='outbound' then v_at else null end)
 on conflict(tenant_id,conversation_id,external_message_id) where external_message_id is not null do nothing
 returning id into v_msg;
 if v_msg is null then return jsonb_build_object('ok',true,'duplicate',true,'contactId',v_person,'conversationId',v_conv);end if;
 update connect.conversations set last_message_at=greatest(coalesce(last_message_at,v_at),v_at)
 where tenant_id=v_account.tenant_id and id=v_conv;
 -- Create a single unclassified enquiry only on FIRST inbound contact creation.
 -- Repeated chat messages never create new enquiries.
 if v_created and p_direction='inbound' then
  insert into connect.inquiries(tenant_id,person_id,channel_account_id,external_event_id,source,summary)
  values(v_account.tenant_id,v_person,v_account.id,p_message_id,'whatsapp',left(coalesce(nullif(p_body,''),'WhatsApp message received'),2000))
  returning id into v_inquiry;
 end if;
 -- Status callbacks can arrive before the outbound message has been persisted.
 if p_direction='outbound' then
  update connect.messages m set
   sent_at=coalesce((select min(e.occurred_at) from connect.whatsapp_delivery_events e where
     e.tenant_id=v_account.tenant_id and e.channel_account_id=v_account.id and e.external_message_id=p_message_id and e.status='sent'),m.sent_at),
   delivered_at=(select min(e.occurred_at) from connect.whatsapp_delivery_events e where
     e.tenant_id=v_account.tenant_id and e.channel_account_id=v_account.id and e.external_message_id=p_message_id and e.status='delivered'),
   read_at=(select min(e.occurred_at) from connect.whatsapp_delivery_events e where
     e.tenant_id=v_account.tenant_id and e.channel_account_id=v_account.id and e.external_message_id=p_message_id and e.status='read')
  where m.id=v_msg and m.tenant_id=v_account.tenant_id;
  update connect.messages m set delivery_status=
   case when m.read_at is not null then 'read' when m.delivered_at is not null then 'delivered'
   else 'sent' end where m.id=v_msg and m.tenant_id=v_account.tenant_id;
 end if;
 return jsonb_build_object('ok',true,'duplicate',false,'contactId',v_person,
  'conversationId',v_conv,'messageId',v_msg,'enquiryId',v_inquiry);
end $fn$;


notify pgrst,'reload schema';


-- ===== SOURCE: database/connect/saas/32_whatsapp_meta_test_sending.sql =====
-- Phase 3 / DEV: safe Meta Cloud API send ledger with idempotent caller request IDs.
-- The web handler only permits explicitly configured Meta TEST phone IDs and recipients.
-- No credentials are stored in PostgreSQL. The private schema is never exposed to clients.
create table if not exists connect.whatsapp_send_requests(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null,
 conversation_id uuid not null,
 channel_account_id uuid not null,
 actor_membership_id uuid not null,
 client_request_id uuid not null,
 destination text not null,
 body text not null check (length(body) between 1 and 3000),
 state text not null default 'reserved'
  check (state in ('reserved','accepted','rejected','unknown')),
 external_message_id text,
 failure_code text,
 created_at timestamptz not null default now(),
 completed_at timestamptz,
 unique(tenant_id,conversation_id,client_request_id),
 foreign key(tenant_id,conversation_id) references connect.conversations(tenant_id,id) on delete restrict,
 foreign key(tenant_id,channel_account_id) references connect.channel_accounts(tenant_id,id) on delete restrict,
 foreign key(tenant_id,actor_membership_id) references connect.memberships(tenant_id,id) on delete restrict
);
create index if not exists idx_connect_wa_send_requests_status on connect.whatsapp_send_requests(tenant_id,state,created_at);
alter table connect.whatsapp_send_requests enable row level security;
revoke all on connect.whatsapp_send_requests from public,anon,authenticated;
grant select,insert,update on connect.whatsapp_send_requests to service_role;

create or replace function public.connect_whatsapp_reserve_test_send(
 p_actor_id uuid,p_tenant_id uuid,p_conversation_id uuid,
 p_client_request_id uuid,p_body text
) returns jsonb language plpgsql set search_path='' as $fn$
declare v_actor uuid;v_role text;v_channel uuid;v_phone_id text;v_recipient text;
 v_request connect.whatsapp_send_requests%rowtype;v_last_inbound timestamptz;v_text text;
begin
 select m.id,m.role into v_actor,v_role from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active' and t.status in ('active','trial');
 if v_actor is null or v_role='viewer' then raise exception 'Write permission denied' using errcode='42501';end if;
 if p_client_request_id is null then raise exception 'Request ID required' using errcode='22023';end if;
 v_text:=btrim(coalesce(p_body,''));
 if length(v_text) not between 1 and 3000 then raise exception 'Enter a valid message' using errcode='22023';end if;
 -- Returning an existing request is read-only and prevents duplicate network sends.
 select * into v_request from connect.whatsapp_send_requests
 where tenant_id=p_tenant_id and conversation_id=p_conversation_id and client_request_id=p_client_request_id;
 if found then
  if v_request.actor_membership_id<>v_actor then raise exception 'Request belongs to another agent' using errcode='42501';end if;
  if v_request.body<>v_text then raise exception 'Request ID reused with another message' using errcode='22023';end if;
  return jsonb_build_object('id',v_request.id,'isNew',false,'state',v_request.state);
 end if;
 select c.channel_account_id,a.external_account_id,c.external_thread_id
 into v_channel,v_phone_id,v_recipient
 from connect.conversations c join connect.channel_accounts a
 on a.tenant_id=c.tenant_id and a.id=c.channel_account_id
 where c.tenant_id=p_tenant_id and c.id=p_conversation_id
 and a.provider='whatsapp' and a.status='active' and c.status<>'closed';
 if v_channel is null then raise exception 'Conversation not available for sending' using errcode='42501';end if;
 if v_phone_id is null or v_phone_id !~ '^[0-9]{5,25}$' or
 v_recipient is null or v_recipient !~ '^[0-9]{8,15}$'
 then raise exception 'Invalid sender or recipient' using errcode='22023';end if;
 select max(m.occurred_at) into v_last_inbound from connect.messages m
 where m.tenant_id=p_tenant_id and m.conversation_id=p_conversation_id
 and m.direction='inbound' and m.occurred_at<=now();
 if v_last_inbound is null or v_last_inbound<=now()-interval '23 hours 45 minutes' then
  raise exception 'Customer-service reply window expired' using errcode='22023';
 end if;
 insert into connect.whatsapp_send_requests(
  tenant_id,conversation_id,channel_account_id,actor_membership_id,client_request_id,destination,body
 ) values(p_tenant_id,p_conversation_id,v_channel,v_actor,p_client_request_id,v_recipient,v_text)
 on conflict(tenant_id,conversation_id,client_request_id) do nothing returning * into v_request;
 if not found then
  select * into v_request from connect.whatsapp_send_requests where
   tenant_id=p_tenant_id and conversation_id=p_conversation_id and client_request_id=p_client_request_id;
  return jsonb_build_object('id',v_request.id,'isNew',false,'state',v_request.state);
 end if;
 return jsonb_build_object('id',v_request.id,'isNew',true,'state','reserved',
  'phoneNumberId',v_phone_id,'destination',v_recipient);
end $fn$;

create or replace function public.connect_whatsapp_complete_test_send(
 p_actor_id uuid,p_tenant_id uuid,p_request_id uuid,p_state text,
 p_message_id text default null,p_failure_code text default null
) returns jsonb language plpgsql set search_path='' as $fn$
declare v_request connect.whatsapp_send_requests%rowtype;v_actor uuid;v_message uuid;
 v_status text;v_sent timestamptz;v_delivered timestamptz;v_read timestamptz;v_failed timestamptz;
begin
 select id into v_actor from connect.memberships where
 user_id=p_actor_id and tenant_id=p_tenant_id and status='active';
 if v_actor is null then raise exception 'No active workspace membership' using errcode='42501';end if;
 select * into v_request from connect.whatsapp_send_requests where
 tenant_id=p_tenant_id and id=p_request_id for update;
 if not found or v_request.actor_membership_id<>v_actor then raise exception 'Send request unavailable' using errcode='42501';end if;
 if v_request.state<>'reserved' then
  return jsonb_build_object('ok',true,'state',v_request.state,'id',v_request.id);
 end if;
 if p_state not in ('accepted','rejected','unknown') then raise exception 'Invalid send outcome' using errcode='22023';end if;
 if p_state='accepted' and (p_message_id is null or length(p_message_id) not between 5 and 250) then
  raise exception 'Accepted send requires provider message ID' using errcode='22023';
 end if;
 update connect.whatsapp_send_requests set state=p_state,
 external_message_id=case when p_state='accepted' then p_message_id else null end,
 failure_code=left(p_failure_code,80),completed_at=now()
 where id=v_request.id;
 if p_state='accepted' then
  select min(occurred_at) filter(where status='sent'),
   min(occurred_at) filter(where status='delivered'),
   min(occurred_at) filter(where status='read'),
   min(occurred_at) filter(where status='failed')
   into v_sent,v_delivered,v_read,v_failed
  from connect.whatsapp_delivery_events where tenant_id=p_tenant_id
   and channel_account_id=v_request.channel_account_id and external_message_id=p_message_id;
  v_status:=case when v_read is not null then 'read' when v_delivered is not null then 'delivered'
   when v_failed is not null then 'failed' else 'sent' end;
  insert into connect.messages(tenant_id,conversation_id,external_message_id,direction,
   body,message_type,delivery_status,occurred_at,sent_at,delivered_at,read_at,failed_at)
  values(p_tenant_id,v_request.conversation_id,p_message_id,'outbound',
   v_request.body,'text',v_status,now(),coalesce(v_sent,now()),v_delivered,v_read,v_failed)
  on conflict(tenant_id,conversation_id,external_message_id)
   where external_message_id is not null
   do update set delivery_status=excluded.delivery_status
  returning id into v_message;
  update connect.conversations set last_message_at=greatest(coalesce(last_message_at,now()),now())
  where tenant_id=p_tenant_id and id=v_request.conversation_id;
 end if;
 return jsonb_build_object('ok',true,'state',p_state,'id',v_request.id,'messageId',v_message);
end $fn$;
revoke all on function public.connect_whatsapp_reserve_test_send(uuid,uuid,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.connect_whatsapp_complete_test_send(uuid,uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.connect_whatsapp_reserve_test_send(uuid,uuid,uuid,uuid,text) to service_role;
grant execute on function public.connect_whatsapp_complete_test_send(uuid,uuid,uuid,text,text,text) to service_role;
notify pgrst,'reload schema';


-- ===== SOURCE: database/connect/saas/33_whatsapp_meta_reply_eligibility.sql =====
-- Phase 3: minimal, tenant-authorized conversation send eligibility (no secrets).
create or replace function public.connect_whatsapp_test_reply_context(
 p_actor_id uuid,p_tenant_id uuid,p_conversation_id uuid
) returns jsonb language plpgsql stable set search_path='' as $fn$
declare v_role text;v_phone_id text;v_recipient text;v_latest timestamptz;
begin
 select m.role into v_role from connect.memberships m
 join connect.tenants t on t.id=m.tenant_id where
 m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active'
 and t.status in ('trial','active');
 if v_role is null then raise exception 'Workspace access denied' using errcode='42501';end if;
 select a.external_account_id,c.external_thread_id into v_phone_id,v_recipient
 from connect.conversations c join connect.channel_accounts a on
 a.tenant_id=c.tenant_id and a.id=c.channel_account_id
 where c.tenant_id=p_tenant_id and c.id=p_conversation_id and a.provider='whatsapp'
 and a.status='active' and c.status<>'closed';
 if not found then return jsonb_build_object('canReply',false,'reason','Conversation is closed or sender channel inactive');end if;
 select max(m.occurred_at) into v_latest from connect.messages m
 where m.tenant_id=p_tenant_id and m.conversation_id=p_conversation_id
 and m.direction='inbound' and m.occurred_at<=now();
 return jsonb_build_object('canReply',
 v_role<>'viewer' and v_recipient~'^[0-9]{8,15}$' and
 v_latest is not null and v_latest>now()-interval '23 hours 45 minutes',
 'phoneNumberId',v_phone_id,'recipient',v_recipient,
 'lastInboundAt',v_latest,
 'reason',case
 when v_role='viewer' then 'Viewer access is read-only'
 when v_recipient is null or v_recipient!~'^[0-9]{8,15}$' then 'Missing valid recipient'
 when v_latest is null or v_latest<=now()-interval '23 hours 45 minutes' then 'No recent inbound customer message'
 else null end);
end $fn$;
revoke all on function public.connect_whatsapp_test_reply_context(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.connect_whatsapp_test_reply_context(uuid,uuid,uuid) to service_role;
notify pgrst,'reload schema';


-- ===== SOURCE: database/connect/saas/34_whatsapp_meta_test_send_limits.sql =====
-- Phase 3: enforce bounded test sending at the database boundary.
-- Per-conversation and per-workspace limits include reserved/unknown attempts.
create or replace function connect.whatsapp_send_test_rate_guard()
returns trigger language plpgsql set search_path='' as $fn$
declare v_conversation_count int;v_workspace_count int;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  new.tenant_id::text||':whatsapp-test-send:'||new.conversation_id::text,0));
 select count(*) into v_conversation_count from connect.whatsapp_send_requests
 where tenant_id=new.tenant_id and conversation_id=new.conversation_id
 and created_at>now()-interval '1 minute';
 if v_conversation_count>=5 then
  raise exception 'Test conversation send rate limit reached' using errcode='22023';
 end if;
 select count(*) into v_workspace_count from connect.whatsapp_send_requests
 where tenant_id=new.tenant_id and created_at>now()-interval '1 hour';
 if v_workspace_count>=100 then
  raise exception 'Test workspace send rate limit reached' using errcode='22023';
 end if;
 return new;
end $fn$;
drop trigger if exists whatsapp_test_send_rate_guard on connect.whatsapp_send_requests;
create trigger whatsapp_test_send_rate_guard
 before insert on connect.whatsapp_send_requests
 for each row execute function connect.whatsapp_send_test_rate_guard();


-- ===== SOURCE: database/connect/saas/35_whatsapp_coexistence_sync.sql =====
-- Phase 3A: DEV-first WhatsApp Business App coexistence contact and history sync.
-- Run only after reviewing on DEV. Private data, service-role-only RPCs.
create table if not exists connect.whatsapp_app_contacts (
 tenant_id uuid not null,
 channel_account_id uuid not null,
 phone text not null,
 display_name text,
 last_event_at timestamptz not null,
 present_in_app boolean not null default true,
 updated_at timestamptz not null default now(),
 primary key (tenant_id,channel_account_id,phone),
 foreign key (tenant_id,channel_account_id) references connect.channel_accounts(tenant_id,id) on delete restrict,
 constraint whatsapp_app_contacts_phone check (phone ~ '^\+[0-9]{8,15}$')
);
alter table connect.whatsapp_app_contacts enable row level security;
revoke all on connect.whatsapp_app_contacts from public,anon,authenticated;
grant select,insert,update on connect.whatsapp_app_contacts to service_role;
alter table connect.messages add column if not exists original_body text;
alter table connect.messages add column if not exists edited_at timestamptz;
alter table connect.messages add column if not exists revoked_at timestamptz;
alter table connect.messages add column if not exists last_revision_at timestamptz;
alter table connect.messages add column if not exists is_historical boolean not null default false;

create or replace function public.connect_sync_whatsapp_app_contact(
 p_external_account_id text,p_phone text,p_name text,p_action text,p_occurred_at timestamptz
) returns jsonb language plpgsql set search_path='' as $fn$
declare a connect.channel_accounts%rowtype; v_phone text; v_at timestamptz; v_updated int;v_person uuid;
begin
 if p_action not in ('add','remove') or p_occurred_at is null or
    p_occurred_at not between '2000-01-01'::timestamptz and now()+interval '1 day' then
  raise exception 'Invalid contact sync event' using errcode='22023';end if;
 select c.* into a from connect.channel_accounts c join connect.tenants t on t.id=c.tenant_id
 where c.provider='whatsapp' and c.external_account_id=lower(btrim(p_external_account_id))
 and c.status='active' and t.status in ('trial','active');
 if not found then raise exception 'Unregistered WhatsApp channel' using errcode='42501';end if;
 v_phone:='+'||pg_catalog.regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
 if v_phone !~ '^\+[0-9]{8,15}$' or length(coalesce(p_name,''))>150 then
  raise exception 'Invalid contact sync details' using errcode='22023';end if;
 v_at:=p_occurred_at;
 insert into connect.whatsapp_app_contacts
  (tenant_id,channel_account_id,phone,display_name,last_event_at,present_in_app)
 values(a.tenant_id,a.id,v_phone,nullif(btrim(p_name),''),v_at,p_action='add')
 on conflict(tenant_id,channel_account_id,phone) do update set
  display_name=case when excluded.present_in_app then excluded.display_name else connect.whatsapp_app_contacts.display_name end,
  present_in_app=excluded.present_in_app,last_event_at=excluded.last_event_at,updated_at=now()
 where connect.whatsapp_app_contacts.last_event_at<excluded.last_event_at;
 get diagnostics v_updated=row_count;
 if v_updated>0 and p_action='add' then
  -- Contacts appear in CRM, but never overwrite manually edited CRM identities.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.tenant_id::text||':'||v_phone,0));
  select cm.person_id into v_person from connect.contact_methods cm
  join connect.people p on p.id=cm.person_id and p.tenant_id=cm.tenant_id and p.status='active'
  where cm.tenant_id=a.tenant_id and cm.kind in ('whatsapp','mobile','phone')
  and pg_catalog.regexp_replace(cm.normalized_value,'[^0-9]','','g')=substring(v_phone from 2)
  order by cm.created_at,cm.id limit 1;
  if v_person is null then
   insert into connect.people(tenant_id,full_name)
   values(a.tenant_id,coalesce(nullif(btrim(p_name),''),'WhatsApp contact')) returning id into v_person;
   insert into connect.person_roles(tenant_id,person_id,role) values(a.tenant_id,v_person,'contact');
   insert into connect.contact_methods(tenant_id,person_id,kind,normalized_value,display_value,is_primary)
   values(a.tenant_id,v_person,'whatsapp',v_phone,v_phone,true);
  end if;
 end if;
 -- A removal never deletes an existing CRM contact or its conversations.
 return jsonb_build_object('ok',true,'applied',v_updated>0);
end $fn$;

create or replace function public.connect_revise_whatsapp_message(
 p_external_account_id text,p_original_message_id text,p_event_id text,
 p_contact_wa_id text,p_action text,p_body text,p_occurred_at timestamptz
) returns jsonb language plpgsql set search_path='' as $fn$
declare a connect.channel_accounts%rowtype;v_phone text;v_updated int;
begin
 if p_action not in ('edit','revoke') or length(coalesce(p_event_id,'')) not between 3 and 250 or
  length(coalesce(p_original_message_id,'')) not between 3 and 250 or length(coalesce(p_body,''))>3000 or
  p_occurred_at is null or p_occurred_at not between '2000-01-01'::timestamptz and now()+interval '1 day' then
  raise exception 'Invalid WhatsApp revision' using errcode='22023';end if;
 select c.* into a from connect.channel_accounts c join connect.tenants t on t.id=c.tenant_id
 where c.provider='whatsapp' and c.external_account_id=lower(btrim(p_external_account_id))
 and c.status='active' and t.status in ('trial','active');
 if not found then raise exception 'Unregistered WhatsApp channel' using errcode='42501';end if;
 v_phone:=pg_catalog.regexp_replace(coalesce(p_contact_wa_id,''),'[^0-9]','','g');
 if length(v_phone) not between 8 and 15 then raise exception 'Invalid WhatsApp contact' using errcode='22023';end if;
 update connect.messages m set
  original_body=coalesce(m.original_body,m.body),
  message_type=case when p_action='revoke' then 'revoked' else m.message_type end,
  body=case when p_action='revoke' then null else nullif(btrim(p_body),'') end,
  edited_at=case when p_action='edit' then p_occurred_at else m.edited_at end,
  revoked_at=case when p_action='revoke' then p_occurred_at else m.revoked_at end,
  last_revision_at=p_occurred_at
 from connect.conversations c where c.id=m.conversation_id and c.tenant_id=a.tenant_id
  and c.channel_account_id=a.id and c.external_thread_id=v_phone
  and m.tenant_id=a.tenant_id and m.external_message_id=p_original_message_id
  and (m.last_revision_at is null or m.last_revision_at<p_occurred_at)
  and m.revoked_at is null;
 get diagnostics v_updated=row_count;
 if v_updated=0 and not exists(
  select 1 from connect.messages m join connect.conversations c on c.id=m.conversation_id
  where m.tenant_id=a.tenant_id and c.tenant_id=a.tenant_id and c.channel_account_id=a.id
   and c.external_thread_id=v_phone and m.external_message_id=p_original_message_id
 ) then raise exception 'Original message not yet available' using errcode='P0002';end if;
 return jsonb_build_object('ok',true,'applied',v_updated>0);
end $fn$;

create or replace function public.connect_import_whatsapp_history_thread(
 p_external_account_id text,p_contact_wa_id text,p_messages jsonb
) returns jsonb language plpgsql set search_path='' as $fn$
declare a connect.channel_accounts%rowtype; v_phone text; v_person uuid;v_count int:=0;
 m jsonb;v_direction text;v_time timestamptz;v_id text;v_kind text;v_body text;v_result jsonb;
begin
 if jsonb_typeof(p_messages) is distinct from 'array' then
  raise exception 'Invalid history thread batch' using errcode='22023';end if;
 if jsonb_array_length(p_messages)>200 then
  raise exception 'Invalid history thread batch' using errcode='22023';end if;
 select c.* into a from connect.channel_accounts c join connect.tenants t on t.id=c.tenant_id
 where c.provider='whatsapp' and c.external_account_id=lower(btrim(p_external_account_id))
 and c.status='active' and t.status in ('trial','active');
 if not found then raise exception 'Unregistered WhatsApp channel' using errcode='42501';end if;
 v_phone:='+'||pg_catalog.regexp_replace(coalesce(p_contact_wa_id,''),'[^0-9]','','g');
 if v_phone !~ '^\+[0-9]{8,15}$' then raise exception 'Invalid history recipient' using errcode='22023';end if;
 -- Ensure a historical inbound cannot create a brand-new active sales enquiry.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.tenant_id::text||':'||v_phone,0));
 select cm.person_id into v_person from connect.contact_methods cm
 join connect.people p on p.id=cm.person_id and p.tenant_id=cm.tenant_id and p.status='active'
 where cm.tenant_id=a.tenant_id and cm.kind in ('whatsapp','mobile','phone')
 and pg_catalog.regexp_replace(cm.normalized_value,'[^0-9]','','g')=substring(v_phone from 2)
 order by cm.created_at,cm.id limit 1;
 if v_person is null then
  insert into connect.people(tenant_id,full_name) values(a.tenant_id,'WhatsApp contact') returning id into v_person;
  insert into connect.person_roles(tenant_id,person_id,role) values(a.tenant_id,v_person,'contact');
  insert into connect.contact_methods(tenant_id,person_id,kind,normalized_value,display_value,is_primary)
  values(a.tenant_id,v_person,'whatsapp',v_phone,v_phone,true);
 end if;
 for m in select value from jsonb_array_elements(p_messages) loop
  v_id:=m->>'id';v_kind:=coalesce(nullif(m->>'type',''),'unknown');
  if v_id is null or length(v_id) not between 3 and 250 or
     coalesce(m->>'timestamp','') !~ '^[0-9]{10,11}$' then
   raise exception 'Invalid historical message' using errcode='22023';end if;
  v_time:=to_timestamp((m->>'timestamp')::double precision);
  if v_time not between now()-interval '190 days' and now()+interval '1 day' then
   raise exception 'Historical message outside allowed window' using errcode='22023';end if;
  v_direction:=case when m ? 'to' then 'outbound' else 'inbound' end;
  if v_direction='inbound' and
   pg_catalog.regexp_replace(coalesce(m->>'from',''),'[^0-9]','','g')<>substring(v_phone from 2) then
   raise exception 'Historical sender mismatch' using errcode='22023';end if;
  if v_direction='outbound' and
   pg_catalog.regexp_replace(coalesce(m->>'to',''),'[^0-9]','','g')<>substring(v_phone from 2) then
   raise exception 'Historical recipient mismatch' using errcode='22023';end if;
  v_body:=case when v_kind='text' then m#>>'{text,body}' else
    coalesce(m#>>array[v_kind,'caption'],'') end;
  v_result:=public.connect_ingest_whatsapp_message(p_external_account_id,v_id,
   substring(v_phone from 2),'WhatsApp contact',v_kind,left(coalesce(v_body,''),3000),v_time,
   left(coalesce(m#>>array[v_kind,'id'],''),250),left(coalesce(m#>>array[v_kind,'mime_type'],''),150),
   left(coalesce(m#>>array[v_kind,'filename'],''),255),left(coalesce(m#>>'{context,id}',''),250),v_direction);
  if (v_result->>'messageId') is not null then
   update connect.messages set is_historical=true
   where tenant_id=a.tenant_id and id=(v_result->>'messageId')::uuid;
  end if;
  if not coalesce((v_result->>'duplicate')::boolean,false) then v_count:=v_count+1;end if;
 end loop;
 return jsonb_build_object('ok',true,'imported',v_count);
end $fn$;

create or replace function public.connect_whatsapp_connection_health(
 p_actor_id uuid,p_tenant_id uuid
) returns jsonb language plpgsql stable set search_path='' as $fn$
declare v_result jsonb;
begin
 if not exists(select 1 from connect.memberships m join connect.tenants t on t.id=m.tenant_id
  where m.tenant_id=p_tenant_id and m.user_id=p_actor_id and m.status='active'
  and t.status in ('active','trial')) then
  raise exception 'Workspace access denied' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'channelId',a.id,'name',a.display_name,'status',a.status,
  'syncContacts',coalesce((select count(*) from connect.whatsapp_app_contacts x
   where x.tenant_id=a.tenant_id and x.channel_account_id=a.id and x.present_in_app),0),
  'historicalMessages',coalesce((select count(*) from connect.messages m
   join connect.conversations c on c.id=m.conversation_id and c.tenant_id=m.tenant_id
   where c.tenant_id=a.tenant_id and c.channel_account_id=a.id and m.is_historical),0),
  'lastMessageAt',(select max(c.last_message_at) from connect.conversations c
   where c.tenant_id=a.tenant_id and c.channel_account_id=a.id)
 ) order by a.display_name),'[]'::jsonb) into v_result
 from connect.channel_accounts a where a.tenant_id=p_tenant_id and a.provider='whatsapp';
 return v_result;
end $fn$;

revoke all on function public.connect_sync_whatsapp_app_contact(text,text,text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.connect_import_whatsapp_history_thread(text,text,jsonb) from public,anon,authenticated;
revoke all on function public.connect_revise_whatsapp_message(text,text,text,text,text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.connect_whatsapp_connection_health(uuid,uuid) from public,anon,authenticated;
grant execute on function public.connect_sync_whatsapp_app_contact(text,text,text,text,timestamptz) to service_role;
grant execute on function public.connect_import_whatsapp_history_thread(text,text,jsonb) to service_role;
grant execute on function public.connect_revise_whatsapp_message(text,text,text,text,text,text,timestamptz) to service_role;
grant execute on function public.connect_whatsapp_connection_health(uuid,uuid) to service_role;
notify pgrst,'reload schema';


-- ===== SOURCE: database/connect/saas/36_whatsapp_history_queue.sql =====
-- Coexistence history queue. DEV-first; protect large, one-time Meta history imports.
create table if not exists connect.whatsapp_history_jobs (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null,
 channel_account_id uuid not null,
 fingerprint text not null check(fingerprint ~ '^[a-f0-9]{64}$'),
 payload jsonb not null,
 state text not null default 'pending' check(state in ('pending','processing','retry','completed','failed')),
 thread_index integer not null default 0 check(thread_index>=0),
 message_index integer not null default 0 check(message_index>=0),
 processed_messages integer not null default 0 check(processed_messages>=0),
 attempts integer not null default 0 check(attempts>=0),
 lease_token uuid,
 lease_until timestamptz,
 next_attempt_at timestamptz not null default now(),
 last_error_code text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(tenant_id,channel_account_id,fingerprint),
 foreign key(tenant_id,channel_account_id) references connect.channel_accounts(tenant_id,id) on delete restrict
);
create index if not exists idx_connect_wa_history_pending
 on connect.whatsapp_history_jobs(state,next_attempt_at,lease_until);
alter table connect.whatsapp_history_jobs enable row level security;
revoke all on connect.whatsapp_history_jobs from public,anon,authenticated;
grant select,insert,update on connect.whatsapp_history_jobs to service_role;

create or replace function public.connect_queue_whatsapp_history(
 p_external_account_id text,p_fingerprint text,p_payload jsonb
) returns jsonb language plpgsql set search_path='' as $fn$
declare a connect.channel_accounts%rowtype;v_id uuid;v_new boolean;
begin
 if p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$' or
  jsonb_typeof(p_payload) is distinct from 'object' or
  jsonb_typeof(p_payload->'threads') is distinct from 'array' or
  jsonb_array_length(p_payload->'threads')>500 or
  octet_length(p_payload::text)>8000000 then
  raise exception 'Invalid history queue payload' using errcode='22023';end if;
 select c.* into a from connect.channel_accounts c join connect.tenants t on t.id=c.tenant_id
 where c.provider='whatsapp' and c.external_account_id=lower(btrim(p_external_account_id))
 and c.status='active' and t.status in ('active','trial');
 if not found then raise exception 'Unregistered WhatsApp channel' using errcode='42501';end if;
 insert into connect.whatsapp_history_jobs(tenant_id,channel_account_id,fingerprint,payload)
 values(a.tenant_id,a.id,p_fingerprint,p_payload)
 on conflict(tenant_id,channel_account_id,fingerprint) do nothing returning id into v_id;
 v_new:=v_id is not null;
 if not v_new then
  select id into v_id from connect.whatsapp_history_jobs where tenant_id=a.tenant_id
  and channel_account_id=a.id and fingerprint=p_fingerprint;
 end if;
 return jsonb_build_object('ok',true,'jobId',v_id,'queued',v_new);
end $fn$;

create or replace function public.connect_claim_whatsapp_history_jobs(p_limit integer default 2)
returns jsonb language plpgsql set search_path='' as $fn$
declare v_jobs jsonb;
begin
 if p_limit not between 1 and 5 then raise exception 'Invalid worker batch' using errcode='22023';end if;
 with claim as (
  select j.id from connect.whatsapp_history_jobs j
  where (j.state in ('pending','retry') and j.next_attempt_at<=now())
  or (j.state='processing' and j.lease_until<now())
  order by j.created_at,j.id limit p_limit for update skip locked
 ), claimed as (
  update connect.whatsapp_history_jobs j set state='processing',
  attempts=j.attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes',
  updated_at=now() from claim where j.id=claim.id
  returning j.id,j.lease_token,j.payload,j.thread_index,j.message_index,j.processed_messages,
   (select external_account_id from connect.channel_accounts a where a.id=j.channel_account_id and a.tenant_id=j.tenant_id) phone_id
 ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'leaseToken',lease_token,
  'payload',payload,'threadIndex',thread_index,'messageIndex',message_index,
  'processedMessages',processed_messages,'phoneId',phone_id)),'[]'::jsonb)
 into v_jobs from claimed;
 return v_jobs;
end $fn$;

create or replace function public.connect_advance_whatsapp_history_job(
 p_id uuid,p_lease_token uuid,p_thread_index integer,p_message_index integer,
 p_imported integer,p_completed boolean default false
) returns boolean language plpgsql set search_path='' as $fn$
declare v_count int;
begin
 if p_thread_index<0 or p_message_index<0 or p_imported<0 then
  raise exception 'Invalid history progress' using errcode='22023';end if;
 update connect.whatsapp_history_jobs set thread_index=p_thread_index,message_index=p_message_index,
  processed_messages=processed_messages+p_imported,
  state=case when p_completed then 'completed' else 'processing' end,
  lease_until=case when p_completed then null else now()+interval '2 minutes' end,
  lease_token=case when p_completed then null else lease_token end,
  payload=case when p_completed then '{}'::jsonb else payload end,
  updated_at=now()
 where id=p_id and state='processing' and lease_token=p_lease_token and lease_until>now()
 and (thread_index<p_thread_index or (thread_index=p_thread_index and message_index<=p_message_index));
 get diagnostics v_count=row_count;
 return v_count=1;
end $fn$;

create or replace function public.connect_fail_whatsapp_history_job(
 p_id uuid,p_lease_token uuid,p_code text
) returns boolean language plpgsql set search_path='' as $fn$
declare v_count int;
begin
 if p_code not in ('BAD_HISTORY_PAYLOAD','HISTORY_IMPORT_FAILED','HISTORY_DB_UNAVAILABLE','HISTORY_WORKER_TIMEOUT') then
  raise exception 'Invalid error code' using errcode='22023';end if;
 update connect.whatsapp_history_jobs set
  state=case when attempts>=5 then 'failed' else 'retry' end,
  next_attempt_at=now()+make_interval(mins=>least(60,2^least(attempts,5))::integer),
  lease_token=null,lease_until=null,last_error_code=p_code,updated_at=now()
 where id=p_id and state='processing' and lease_token=p_lease_token;
 get diagnostics v_count=row_count;return v_count=1;
end $fn$;

create or replace function public.connect_whatsapp_history_queue_health(
 p_actor_id uuid,p_tenant_id uuid
) returns jsonb language sql stable set search_path='' as $fn$
 select coalesce(jsonb_agg(jsonb_build_object('channelId',a.id,
  'pending',coalesce(q.pending,0),'processing',coalesce(q.processing,0),
  'failed',coalesce(q.failed,0),'completed',coalesce(q.completed,0),
  'lastError',q.last_error)),'[]'::jsonb)
 from connect.channel_accounts a left join lateral (
  select count(*) filter(where state in ('pending','retry')) pending,
   count(*) filter(where state='processing') processing,
   count(*) filter(where state='failed') failed,
   count(*) filter(where state='completed') completed,
   max(last_error_code) filter(where state='failed') last_error
  from connect.whatsapp_history_jobs j where j.tenant_id=a.tenant_id and j.channel_account_id=a.id
 ) q on true
 where a.tenant_id=p_tenant_id and a.provider='whatsapp' and exists(
  select 1 from connect.memberships m join connect.tenants t on t.id=m.tenant_id
  where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active'
  and t.status in ('active','trial'))
$fn$;

create or replace function public.connect_cleanup_whatsapp_history_jobs()
returns integer language plpgsql set search_path='' as $fn$
declare v_deleted integer;
begin
 delete from connect.whatsapp_history_jobs where
  (state='completed' and updated_at<now()-interval '7 days') or
  (state='failed' and updated_at<now()-interval '30 days');
 get diagnostics v_deleted=row_count;return v_deleted;
end $fn$;

revoke all on function public.connect_queue_whatsapp_history(text,text,jsonb) from public,anon,authenticated;
revoke all on function public.connect_claim_whatsapp_history_jobs(integer) from public,anon,authenticated;
revoke all on function public.connect_advance_whatsapp_history_job(uuid,uuid,integer,integer,integer,boolean) from public,anon,authenticated;
revoke all on function public.connect_fail_whatsapp_history_job(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.connect_whatsapp_history_queue_health(uuid,uuid) from public,anon,authenticated;
revoke all on function public.connect_cleanup_whatsapp_history_jobs() from public,anon,authenticated;
grant execute on function public.connect_queue_whatsapp_history(text,text,jsonb) to service_role;
grant execute on function public.connect_claim_whatsapp_history_jobs(integer) to service_role;
grant execute on function public.connect_advance_whatsapp_history_job(uuid,uuid,integer,integer,integer,boolean) to service_role;
grant execute on function public.connect_fail_whatsapp_history_job(uuid,uuid,text) to service_role;
grant execute on function public.connect_whatsapp_history_queue_health(uuid,uuid) to service_role;
grant execute on function public.connect_cleanup_whatsapp_history_jobs() to service_role;
notify pgrst,'reload schema';

COMMIT;
