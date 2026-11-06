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
