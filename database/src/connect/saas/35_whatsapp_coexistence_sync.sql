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
