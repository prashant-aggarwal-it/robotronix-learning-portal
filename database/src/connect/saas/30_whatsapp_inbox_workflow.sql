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
  'team',coalesce((select jsonb_agg(jsonb_build_object('id',tm.id,'label',coalesce(u.email,'Team member'),'role',tm.role)
    order by u.email) from connect.memberships tm join auth.users u on u.id=tm.user_id
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
