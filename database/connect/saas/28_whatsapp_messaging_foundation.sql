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
