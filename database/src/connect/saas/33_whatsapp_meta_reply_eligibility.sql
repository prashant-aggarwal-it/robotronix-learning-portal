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
