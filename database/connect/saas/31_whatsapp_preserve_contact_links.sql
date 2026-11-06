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
