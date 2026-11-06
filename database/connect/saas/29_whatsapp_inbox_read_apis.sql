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
