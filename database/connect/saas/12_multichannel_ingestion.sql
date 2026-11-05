-- Phase 3A: Multi-channel ingestion. No external credentials stored in database.
-- All functions are service-role-only; no direct client access to connect schema.
begin;
create table connect.form_keys (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references connect.tenants(id) on delete restrict,
 channel_account_id uuid not null,
 token_sha256 text not null unique check(token_sha256 ~ '^[0-9a-f]{64}$'),
 label text not null,
 active boolean not null default true,
 created_at timestamptz not null default now(),
 foreign key(tenant_id,channel_account_id) references connect.channel_accounts(tenant_id,id) on delete restrict,
 unique(tenant_id,id)
);
alter table connect.form_keys enable row level security;
revoke all on table connect.form_keys from public,anon,authenticated;
grant select,insert,update,delete on table connect.form_keys to service_role;

-- Channel account identifiers MUST be unique across tenants to prevent webhook misrouting.
create unique index connect_channel_global_identity
on connect.channel_accounts(provider,lower(external_account_id))
where external_account_id is not null;

create or replace function public.connect_register_channel(
 p_actor_id uuid,p_tenant_id uuid,p_provider text,p_external_id text,p_label text
) returns uuid language plpgsql security invoker set search_path=''
as $fn$
declare v_id uuid;v_role text;
begin
 select m.role into v_role from connect.memberships m
 join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active'
   and t.status in ('trial','active');
 if v_role is null or v_role not in ('owner','admin') then raise exception 'Channel administration required' using errcode='42501';end if;
 if p_provider not in ('whatsapp','meta_leads','email','website')
   or p_external_id is null or length(btrim(p_external_id)) not between 4 and 200
   or p_label is null or length(btrim(p_label)) not between 2 and 100 then
  raise exception 'Invalid channel registration' using errcode='22023';end if;
 insert into connect.channel_accounts(tenant_id,provider,external_account_id,display_name,status)
 values(p_tenant_id,p_provider,lower(btrim(p_external_id)),btrim(p_label),'inactive')
 returning id into v_id;
 return v_id;
end $fn$;

create or replace function public.connect_set_channel_status(
 p_actor_id uuid,p_tenant_id uuid,p_channel_id uuid,p_status text
) returns boolean language plpgsql security invoker set search_path=''
as $fn$
begin
 if not exists(select 1 from connect.memberships m join connect.tenants t on t.id=m.tenant_id
  where m.tenant_id=p_tenant_id and m.user_id=p_actor_id and m.status='active'
  and m.role in ('owner','admin') and t.status in ('active','trial'))
 then raise exception 'Channel administration required' using errcode='42501';end if;
 if p_status not in ('active','inactive','disabled') then
  raise exception 'Invalid channel status' using errcode='22023';end if;
 update connect.channel_accounts set status=p_status
 where id=p_channel_id and tenant_id=p_tenant_id;
 if not found then raise exception 'Channel not found' using errcode='42501';end if;
 return true;
end $fn$;

create or replace function public.connect_list_channels(p_actor_id uuid,p_tenant_id uuid)
returns jsonb language plpgsql stable security invoker set search_path=''
as $fn$
declare v_result jsonb;
begin
 if not exists(select 1 from connect.memberships m join connect.tenants t on t.id=m.tenant_id
  where m.tenant_id=p_tenant_id and m.user_id=p_actor_id and m.status='active'
  and m.role in ('owner','admin','manager') and t.status in ('active','trial'))
 then raise exception 'Channel administration required' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',c.id,'provider',c.provider,'externalId',c.external_account_id,
  'name',c.display_name,'status',c.status) order by c.provider,c.display_name),'[]'::jsonb)
 into v_result from connect.channel_accounts c where c.tenant_id=p_tenant_id;
 return v_result;
end $fn$;

create or replace function public.connect_create_form_key(
 p_actor_id uuid,p_tenant_id uuid,p_channel_id uuid,p_token_hash text,p_label text
) returns uuid language plpgsql security invoker set search_path=''
as $fn$
declare v_id uuid;
begin
 if not exists(select 1 from connect.memberships m join connect.tenants t on t.id=m.tenant_id
  where m.tenant_id=p_tenant_id and m.user_id=p_actor_id and m.status='active'
   and m.role in ('owner','admin') and t.status in ('active','trial'))
 then raise exception 'Channel administration required' using errcode='42501';end if;
 if p_token_hash !~ '^[a-f0-9]{64}$' or length(btrim(coalesce(p_label,''))) not between 2 and 100 then
  raise exception 'Invalid form key' using errcode='22023';end if;
 if not exists(select 1 from connect.channel_accounts where id=p_channel_id and tenant_id=p_tenant_id and provider='website')
 then raise exception 'Website channel required' using errcode='42501';end if;
 insert into connect.form_keys(tenant_id,channel_account_id,token_sha256,label)
 values(p_tenant_id,p_channel_id,p_token_hash,btrim(p_label)) returning id into v_id;
 return v_id;
end $fn$;

create or replace function public.connect_list_form_keys(
 p_actor_id uuid,p_tenant_id uuid
) returns jsonb language plpgsql stable security invoker set search_path=''
as $fn$
declare v_result jsonb;
begin
 if not exists(select 1 from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id
 and m.status='active' and m.role in ('owner','admin') and t.status in ('active','trial'))
 then raise exception 'Form administration required' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',k.id,'channelId',k.channel_account_id,'label',k.label,
  'active',k.active,'createdAt',k.created_at) order by k.created_at desc),'[]'::jsonb)
 into v_result from connect.form_keys k where k.tenant_id=p_tenant_id;
 return v_result;
end $fn$;

create or replace function public.connect_disable_form_key(
 p_actor_id uuid,p_tenant_id uuid,p_key_id uuid
) returns boolean language plpgsql security invoker set search_path=''
as $fn$
begin
 if not exists(select 1 from connect.memberships where tenant_id=p_tenant_id
  and user_id=p_actor_id and role in ('owner','admin') and status='active')
 then raise exception 'Channel administration required' using errcode='42501';end if;
 update connect.form_keys set active=false where id=p_key_id and tenant_id=p_tenant_id and active;
 return found;
end $fn$;

-- Internal function: called by verified server adapters, never from anonymous/authenticated clients.
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

-- Public-schema adapters callable ONLY with service credentials after signature verification.
create or replace function public.connect_ingest_channel(
 p_provider text,p_external_account_id text,p_event_id text,p_name text,
 p_email text,p_phone text,p_summary text
) returns jsonb language plpgsql security invoker set search_path=''
as $fn$
declare v_id uuid;
begin
 select c.id into v_id from connect.channel_accounts c
  where c.provider=p_provider and c.external_account_id=lower(btrim(p_external_account_id))
    and c.status='active';
 if v_id is null then raise exception 'Unregistered channel' using errcode='42501';end if;
 return connect.ingest_event(v_id,p_event_id,p_name,p_email,p_phone,p_provider,p_summary);
end $fn$;

create or replace function public.connect_ingest_website(
 p_token_hash text,p_event_id text,p_name text,p_email text,p_phone text,p_summary text
) returns jsonb language plpgsql security invoker set search_path=''
as $fn$
declare v_id uuid;
begin
 select k.channel_account_id into v_id from connect.form_keys k
 join connect.channel_accounts c on c.tenant_id=k.tenant_id and c.id=k.channel_account_id
 join connect.tenants t on t.id=k.tenant_id
 where k.token_sha256=p_token_hash and k.active and c.status='active'
 and c.provider='website' and t.status in ('trial','active');
 if v_id is null then raise exception 'Unknown or disabled form' using errcode='42501';end if;
 return connect.ingest_event(v_id,p_event_id,p_name,p_email,p_phone,'website',p_summary);
end $fn$;
do $security$
declare f text;
begin
 foreach f in array array[
 'connect_register_channel(uuid,uuid,text,text,text)',
 'connect_set_channel_status(uuid,uuid,uuid,text)',
 'connect_list_channels(uuid,uuid)',
 'connect_create_form_key(uuid,uuid,uuid,text,text)',
 'connect_list_form_keys(uuid,uuid)',
 'connect_disable_form_key(uuid,uuid,uuid)',
 'connect_ingest_channel(text,text,text,text,text,text,text)',
 'connect_ingest_website(text,text,text,text,text,text)'
 ] loop
  execute 'revoke all on function public.'||f||' from public,anon,authenticated';
  execute 'grant execute on function public.'||f||' to service_role';
 end loop;
end $security$;
revoke all on function connect.ingest_event(uuid,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function connect.ingest_event(uuid,text,text,text,text,text,text) to service_role;
commit;
