-- Robotronix PRODUCTION INSTALL BUNDLE: 06 CRM calendar, bulk imports and contact management.
-- Run once after 05_connect_whatsapp.sql. Does not import example/customer data.
BEGIN;
DO $guard$ BEGIN IF to_regclass('connect.people') IS NULL THEN RAISE EXCEPTION 'Connect foundation missing'; END IF; END $guard$;

-- ===== SOURCE: database/connect/saas/39_calendar_management.sql =====
-- Connect CRM calendar management fields and tenant-scoped RPCs.
-- DEV first. Review before applying to production.
alter table connect.appointments add column if not exists location text;
alter table connect.appointments add column if not exists meeting_url text;
alter table connect.appointments add column if not exists notes text;
alter table connect.appointments add column if not exists programme text;
alter table connect.appointments add column if not exists version integer not null default 1;
alter table connect.appointments add column if not exists updated_at timestamptz not null default now();

CREATE OR REPLACE FUNCTION public.connect_calendar_list(p_actor_id uuid, p_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare v_member uuid;v_result jsonb;
begin
 select m.id into v_member from connect.memberships m
 join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active' and t.status in ('active','trial');
 if v_member is null then raise exception 'Workspace read access denied' using errcode='42501'; end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.starts_at,x.id),'[]'::jsonb) into v_result
 from (select a.id,a.title,a.kind,a.status,a.person_id,a.opportunity_id,
 a.owner_membership_id,a.starts_at,a.ends_at,a.location,a.meeting_url,a.notes,a.programme,a.version,a.updated_at
 from connect.appointments a where a.tenant_id=p_tenant_id order by a.starts_at,a.id limit 500) x;
 return jsonb_build_object('items',v_result);
end $function$
;

CREATE OR REPLACE FUNCTION public.connect_calendar_save(p_actor_id uuid, p_tenant_id uuid, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_member uuid;v_role text;v_id uuid;v_person uuid;v_opportunity uuid;v_owner uuid;
 v_starts timestamptz;v_ends timestamptz;v_title text;v_kind text;v_location text;v_meeting text;v_notes text;v_programme text;
begin
 select m.id,m.role into v_member,v_role from connect.memberships m
 join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active' and t.status in ('active','trial');
 if v_member is null or v_role='viewer' then raise exception 'Calendar write access denied' using errcode='42501';end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Invalid calendar payload' using errcode='22023';end if;
 v_id:=nullif(p_data->>'id','')::uuid;
 v_title:=nullif(btrim(p_data->>'title'),'');
 v_kind:=p_data->>'kind';
 v_person:=nullif(p_data->>'personId','')::uuid;
 v_opportunity:=nullif(p_data->>'opportunityId','')::uuid;
 v_owner:=nullif(p_data->>'ownerMemberId','')::uuid;
 v_location:=nullif(btrim(p_data->>'location'),'');
 v_meeting:=nullif(btrim(p_data->>'meetingUrl'),'');
 v_notes:=nullif(btrim(p_data->>'notes'),'');
 v_programme:=nullif(btrim(p_data->>'programme'),'');
 if v_title is null or length(v_title)>250 or v_kind not in ('counselling','demo','trial','meeting') then
  raise exception 'Invalid title or appointment type' using errcode='22023';end if;
 if v_person is null and v_opportunity is null then raise exception 'Contact or admission required' using errcode='22023';end if;
 if (v_location is not null and length(v_location)>250) or (v_notes is not null and length(v_notes)>2000)
   or (v_programme is not null and length(v_programme)>160) or
   (v_meeting is not null and (length(v_meeting)>500 or v_meeting !~* '^https://[^[:space:]]+$')) then
  raise exception 'Invalid appointment details' using errcode='22023';end if;
 if v_person is not null and not exists(select 1 from connect.people where id=v_person and tenant_id=p_tenant_id and status='active') then
  raise exception 'Contact is not in this workspace' using errcode='42501';end if;
 if v_opportunity is not null and not exists(select 1 from connect.opportunities where id=v_opportunity and tenant_id=p_tenant_id) then
  raise exception 'Admission is not in this workspace' using errcode='42501';end if;
 if v_owner is not null and not exists(select 1 from connect.memberships where id=v_owner and tenant_id=p_tenant_id and status='active') then
  raise exception 'Assigned staff member is not active' using errcode='42501';end if;
 if v_owner is not null and v_owner<>v_member and v_role not in ('owner','admin','manager') then
  raise exception 'Staff assignment requires manager access' using errcode='42501';end if;
 begin
  v_starts:=(p_data->>'startsAt')::timestamptz;
  v_ends:=(p_data->>'endsAt')::timestamptz;
 exception when others then raise exception 'Invalid appointment dates' using errcode='22023';end;
 if v_starts is null or v_ends is null or v_starts>=v_ends or v_ends>v_starts+interval '24 hours' then
  raise exception 'Appointment must end after it starts, within 24 hours' using errcode='22023';end if;
 if v_id is null then
  insert into connect.appointments(tenant_id,person_id,opportunity_id,owner_membership_id,title,kind,starts_at,ends_at,
   location,meeting_url,notes,programme)
  values(p_tenant_id,v_person,v_opportunity,coalesce(v_owner,v_member),v_title,v_kind,v_starts,v_ends,
   v_location,v_meeting,v_notes,v_programme) returning id into v_id;
 else
  update connect.appointments a set person_id=v_person,opportunity_id=v_opportunity,
    owner_membership_id=coalesce(v_owner,a.owner_membership_id),title=v_title,kind=v_kind,
    starts_at=v_starts,ends_at=v_ends,location=v_location,meeting_url=v_meeting,
    notes=v_notes,programme=v_programme,version=a.version+1,updated_at=now()
  where a.id=v_id and a.tenant_id=p_tenant_id and a.status='scheduled'
   and (a.owner_membership_id=v_member or v_role in ('owner','admin','manager'))
   and a.version=(p_data->>'version')::integer;
  if not found then raise exception 'Appointment changed or unavailable' using errcode='40001';end if;
 end if;
 insert into connect.audit_events(tenant_id,actor_membership_id,event_type,entity_type,entity_id,metadata)
 values(p_tenant_id,v_member,case when p_data->>'id' is null then 'create_appointment' else 'edit_appointment' end,
 'appointment',v_id,jsonb_build_object('calendar',true));
 return jsonb_build_object('ok',true,'id',v_id);
end $function$
;
revoke all on function public.connect_calendar_list(uuid,uuid) from public,anon,authenticated;
revoke all on function public.connect_calendar_save(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.connect_calendar_list(uuid,uuid) to service_role;
grant execute on function public.connect_calendar_save(uuid,uuid,jsonb) to service_role;


-- ===== SOURCE: database/connect/saas/40_bulk_contacts_import.sql =====
-- Connect CRM bulk contact import. No broadcast permission is inferred from an import.
create table if not exists connect.contact_import_batches (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references connect.tenants(id),
 actor_membership_id uuid not null,
 file_name text not null,
 source_type text not null check(source_type in ('own','event','referral','directory','purchased','other')),
 source_label text not null,
 status text not null default 'open' check(status in ('open','finished')),
 created_at timestamptz not null default now(),
 finished_at timestamptz,
 unique(tenant_id,id)
);
create index if not exists contact_import_batches_tenant_created on connect.contact_import_batches(tenant_id,created_at desc);
create table if not exists connect.contact_import_items (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null,
 batch_id uuid not null,
 row_number integer not null check(row_number>0),
 person_id uuid,
 result text not null check(result in ('created','existing','skipped')),
 reason text,
 created_at timestamptz not null default now(),
 unique(tenant_id,batch_id,row_number),
 foreign key(tenant_id,batch_id) references connect.contact_import_batches(tenant_id,id)
);
create index if not exists contact_import_items_batch on connect.contact_import_items(tenant_id,batch_id);
create table if not exists connect.contact_import_details (
 tenant_id uuid not null,
 person_id uuid not null,
 source_batch_id uuid not null,
 company text,
 city text,
 notes text,
 tags text[],
 source_reference text,
 imported_at timestamptz not null default now(),
 primary key(tenant_id,person_id,source_batch_id),
 foreign key(tenant_id,source_batch_id) references connect.contact_import_batches(tenant_id,id)
);
create table if not exists connect.contact_marketing_permissions (
 tenant_id uuid not null,
 person_id uuid not null,
 channel text not null default 'whatsapp' check(channel in ('whatsapp','email','sms')),
 status text not null default 'unknown' check(status in ('unknown','opted_in','opted_out')),
 evidence text,
 updated_at timestamptz not null default now(),
 primary key(tenant_id,person_id,channel)
);
-- Restrict access to server-only RPCs, not direct browser table access.
revoke all on connect.contact_import_batches,connect.contact_import_items,
 connect.contact_import_details,connect.contact_marketing_permissions from public,anon,authenticated;
alter table connect.contact_import_batches enable row level security;
alter table connect.contact_import_items enable row level security;
alter table connect.contact_import_details enable row level security;
alter table connect.contact_marketing_permissions enable row level security;

create or replace function public.connect_contacts_import(
 p_actor_id uuid,p_tenant_id uuid,p_action text,p_data jsonb default '{}'::jsonb
) returns jsonb language plpgsql set search_path to '' as $function$
declare
 v_member uuid;v_role text;v_batch connect.contact_import_batches%rowtype;
 v_item jsonb;v_items jsonb;v_row integer;v_name text;v_phone text;v_mail text;
 v_dial text;v_digits text;v_id uuid;v_phone_ids uuid[];v_mail_ids uuid[];
 v_candidates uuid[];v_result text;v_reason text;v_created integer:=0;
 v_existing integer:=0;v_skipped integer:=0;v_count integer;
begin
 select m.id,m.role into v_member,v_role from connect.memberships m
 join connect.tenants t on t.id=m.tenant_id
 where m.tenant_id=p_tenant_id and m.user_id=p_actor_id and m.status='active'
   and t.status in ('active','trial');
 if v_member is null then raise exception 'Workspace access denied' using errcode='42501';end if;
 if p_action='history' then
  return jsonb_build_object('items',coalesce((
   select jsonb_agg(to_jsonb(q) order by q.created_at desc)
   from (select b.id,b.file_name,b.source_type,b.source_label,b.status,b.created_at,
    count(i.id) as processed,
    count(i.id) filter(where i.result='created') as created,
    count(i.id) filter(where i.result='existing') as existing,
    count(i.id) filter(where i.result='skipped') as skipped
    from connect.contact_import_batches b
    left join connect.contact_import_items i on i.tenant_id=b.tenant_id and i.batch_id=b.id
    where b.tenant_id=p_tenant_id
    group by b.id order by b.created_at desc limit 20) q
  ),'[]'::jsonb));
 end if;
 if v_role not in ('owner','admin','manager') then
  raise exception 'Bulk imports require workspace management access' using errcode='42501';
 end if;
 if p_action='start' then
  if length(coalesce(p_data->>'fileName','')) not between 1 and 160 or
    length(coalesce(p_data->>'sourceLabel','')) not between 1 and 120 or
    coalesce(p_data->>'sourceType','') not in ('own','event','referral','directory','purchased','other') then
    raise exception 'Invalid import details' using errcode='22023';
  end if;
  insert into connect.contact_import_batches(tenant_id,actor_membership_id,file_name,source_type,source_label)
   values(p_tenant_id,v_member,p_data->>'fileName',p_data->>'sourceType',p_data->>'sourceLabel')
   returning * into v_batch;
  insert into connect.audit_events(tenant_id,actor_membership_id,event_type,entity_type,entity_id,metadata)
   values(p_tenant_id,v_member,'contact_import_started','contact_import',v_batch.id,jsonb_build_object('sourceType',v_batch.source_type));
  return jsonb_build_object('ok',true,'id',v_batch.id);
 end if;
 if p_action not in ('chunk','finish') then
  raise exception 'Invalid import operation' using errcode='22023';
 end if;
 select * into v_batch from connect.contact_import_batches
 where id=nullif(p_data->>'batchId','')::uuid and tenant_id=p_tenant_id for update;
 if not found then raise exception 'Import batch not found' using errcode='42501';end if;
 if p_action='finish' then
  update connect.contact_import_batches set status='finished',finished_at=now()
   where tenant_id=p_tenant_id and id=v_batch.id;
  insert into connect.audit_events(tenant_id,actor_membership_id,event_type,entity_type,entity_id,metadata)
   values(p_tenant_id,v_member,'contact_import_finished','contact_import',v_batch.id,'{}'::jsonb);
  return jsonb_build_object('ok',true,'id',v_batch.id);
 end if;
 if v_batch.status<>'open' or jsonb_typeof(p_data->'rows')<>'array' or
  jsonb_array_length(p_data->'rows') not between 1 and 50 then
  raise exception 'Invalid import chunk' using errcode='22023';
 end if;
 for v_item in select value from jsonb_array_elements(p_data->'rows') loop
  if jsonb_typeof(v_item)<>'object' or (v_item->>'rowNumber')!~'^[0-9]{1,6}$' then
   raise exception 'Invalid import row' using errcode='22023';
  end if;
  v_row:=(v_item->>'rowNumber')::integer;
  if exists(select 1 from connect.contact_import_items where tenant_id=p_tenant_id and batch_id=v_batch.id and row_number=v_row)
   then continue;end if;
  v_name:=left(btrim(coalesce(v_item->>'name','')),150);
  v_phone:=btrim(coalesce(v_item->>'phone',''));
  v_mail:=lower(btrim(coalesce(v_item->>'email','')));
  v_digits:=regexp_replace(v_phone,'[^0-9]','','g');
  v_result:='created';v_reason:=null;v_id:=null;
  if v_phone<>'' and (length(v_digits)<7 or length(v_digits)>15 or length(v_phone)>35) then
    v_result:='skipped';v_reason:='Invalid phone number';
  elsif v_mail<>'' and (length(v_mail)>254 or v_mail!~'^[^ @]+@[^ @]+\.[^ @]+$') then
    v_result:='skipped';v_reason:='Invalid email';
  elsif v_digits='' and v_mail='' then
    v_result:='skipped';v_reason:='Phone or email required';
  end if;
  v_dial:=regexp_replace(coalesce(p_data->>'countryCode','91'),'[^0-9]','','g');
  if length(v_dial) not between 1 and 4 then raise exception 'Invalid country calling code' using errcode='22023';end if;
  if v_digits<>'' and length(v_digits)=10 then v_digits:=v_dial||v_digits;end if;
  if v_name='' and v_digits<>'' then v_name:='Contact '||right(v_digits,4);
  elsif v_name='' then v_name:=split_part(v_mail,'@',1);end if;
  if v_result<>'skipped' then
   -- Match by exact normalized identifiers. Conflicting phone/email identities are not merged.
   select array_agg(distinct cm.person_id) into v_phone_ids
   from connect.contact_methods cm join connect.people p on p.id=cm.person_id and p.tenant_id=cm.tenant_id
   where cm.tenant_id=p_tenant_id and p.status='active' and cm.kind in ('mobile','phone','whatsapp')
    and regexp_replace(cm.normalized_value,'[^0-9]','','g') in (v_digits,right(v_digits,10))
    and v_digits<>'';
   select array_agg(distinct cm.person_id) into v_mail_ids
   from connect.contact_methods cm join connect.people p on p.id=cm.person_id and p.tenant_id=cm.tenant_id
   where cm.tenant_id=p_tenant_id and p.status='active' and cm.kind='email' and lower(cm.normalized_value)=v_mail and v_mail<>'';
   select array_agg(distinct id) into v_candidates from
   (select unnest(coalesce(v_phone_ids,array[]::uuid[])) as id
    union select unnest(coalesce(v_mail_ids,array[]::uuid[])) as id) q;
   if coalesce(array_length(v_candidates,1),0)>1 then
    v_result:='skipped';v_reason:='Conflicting or shared identifiers require manual review';
   elsif coalesce(array_length(v_candidates,1),0)=1 then
    v_id:=v_candidates[1];v_result:='existing';
   else
    insert into connect.people(tenant_id,full_name) values(p_tenant_id,v_name) returning id into v_id;
    insert into connect.person_roles(tenant_id,person_id,role) values(p_tenant_id,v_id,'contact');
    if v_digits<>'' then
     insert into connect.contact_methods(tenant_id,person_id,kind,normalized_value,display_value,is_primary)
      values(p_tenant_id,v_id,'mobile',v_digits,case when left(v_phone,1)='+' then v_phone else '+'||v_digits end,true);
    end if;
    if v_mail<>'' then
     insert into connect.contact_methods(tenant_id,person_id,kind,normalized_value,display_value,is_primary)
      values(p_tenant_id,v_id,'email',v_mail,v_mail,true);
    end if;
    -- A newly imported contact is not marketing-eligible without separate verified opt-in.
    insert into connect.contact_marketing_permissions(tenant_id,person_id,channel,status)
     values(p_tenant_id,v_id,'whatsapp','unknown') on conflict do nothing;
   end if;
   if v_id is not null then
    insert into connect.contact_import_details(tenant_id,person_id,source_batch_id,company,city,notes,tags,source_reference)
    values(p_tenant_id,v_id,v_batch.id,left(nullif(v_item->>'company',''),150),
     left(nullif(v_item->>'city',''),120),left(nullif(v_item->>'notes',''),1000),
     array(select left(value,50) from jsonb_array_elements_text(
      case when jsonb_typeof(v_item->'tags')='array' then v_item->'tags' else '[]'::jsonb end) limit 15),
     left(nullif(v_item->>'sourceReference',''),250))
    on conflict do nothing;
   end if;
  end if;
  insert into connect.contact_import_items(tenant_id,batch_id,row_number,person_id,result,reason)
  values(p_tenant_id,v_batch.id,v_row,v_id,v_result,v_reason);
  if v_result='created' then v_created:=v_created+1;
  elsif v_result='existing' then v_existing:=v_existing+1;
  else v_skipped:=v_skipped+1;end if;
 end loop;
 return jsonb_build_object('ok',true,'created',v_created,'existing',v_existing,'skipped',v_skipped);
end $function$;
revoke all on function public.connect_contacts_import(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.connect_contacts_import(uuid,uuid,text,jsonb) to service_role;


-- ===== SOURCE: database/connect/saas/41_contact_import_provenance.sql =====
-- Read-only source provenance and broadcast consent status for imported contacts.
create or replace function public.connect_contact_import_profile(
 p_actor_id uuid,p_tenant_id uuid,p_person_id uuid
) returns jsonb language plpgsql stable set search_path to '' as $fn$
declare v_exists boolean;
begin
 select exists(select 1 from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.tenant_id=p_tenant_id and m.user_id=p_actor_id and m.status='active' and t.status in ('active','trial'))
 into v_exists;
 if not v_exists then raise exception 'Workspace access denied' using errcode='42501';end if;
 if not exists(select 1 from connect.people where tenant_id=p_tenant_id and id=p_person_id) then
  raise exception 'Contact not found' using errcode='42501';end if;
 return jsonb_build_object(
  'consent',coalesce((select status from connect.contact_marketing_permissions
    where tenant_id=p_tenant_id and person_id=p_person_id and channel='whatsapp'),'unknown'),
  'sources',coalesce((select jsonb_agg(to_jsonb(q) order by q.imported_at desc)
   from (select d.company,d.city,d.notes,d.tags,d.source_reference,d.imported_at,
    b.source_type,b.source_label,b.file_name
    from connect.contact_import_details d
    join connect.contact_import_batches b on b.tenant_id=d.tenant_id and b.id=d.source_batch_id
    where d.tenant_id=p_tenant_id and d.person_id=p_person_id
    order by d.imported_at desc limit 12) q),'[]'::jsonb)
 );
end $fn$;
revoke all on function public.connect_contact_import_profile(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.connect_contact_import_profile(uuid,uuid,uuid) to service_role;


-- ===== SOURCE: database/connect/saas/42_contact_directory_search.sql =====
-- Complete contact directory search, including imported phone-only records.
create or replace function public.connect_contact_directory(
 p_actor_id uuid,p_tenant_id uuid,p_search text default '',
 p_offset int default 0,p_limit int default 100,p_sort text default 'name'
) returns jsonb language plpgsql stable set search_path to '' as $fn$
declare v_permitted boolean;v_total bigint;v_items jsonb;v_query text;
begin
 select exists(select 1 from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active'
  and t.status in ('active','trial')) into v_permitted;
 if not v_permitted then raise exception 'Workspace access denied' using errcode='42501';end if;
 p_limit:=least(100,greatest(1,coalesce(p_limit,100)));
 p_offset:=least(100000,greatest(0,coalesce(p_offset,0)));
 p_sort:=case when p_sort='newest' then 'newest' else 'name' end;
 v_query:=left(btrim(coalesce(p_search,'')),100);
 select count(*) into v_total from connect.people p
 where p.tenant_id=p_tenant_id and p.status='active' and (
  v_query='' or p.full_name ilike '%'||v_query||'%' or exists(
   select 1 from connect.contact_methods cm
   where cm.tenant_id=p_tenant_id and cm.person_id=p.id
    and (cm.display_value ilike '%'||v_query||'%' or cm.normalized_value ilike '%'||v_query||'%')
  )
 );
 select coalesce(jsonb_agg(to_jsonb(q) order by q.sort_rank,q.full_name,q.id),'[]'::jsonb)
 into v_items from (
  select p.id,p.full_name,p.status,p.created_at,
   case when p_sort='newest' then -extract(epoch from p.created_at) else 0 end as sort_rank,
   (select coalesce(jsonb_agg(jsonb_build_object('kind',cm.kind,'value',cm.display_value,'primary',cm.is_primary)),'[]'::jsonb)
    from connect.contact_methods cm where cm.tenant_id=p_tenant_id and cm.person_id=p.id) as contact_methods,
   (select coalesce(jsonb_agg(pr.role),'[]'::jsonb) from connect.person_roles pr
    where pr.tenant_id=p_tenant_id and pr.person_id=p.id) as roles
  from connect.people p
  where p.tenant_id=p_tenant_id and p.status='active' and (
   v_query='' or p.full_name ilike '%'||v_query||'%' or exists(
    select 1 from connect.contact_methods cm where cm.tenant_id=p_tenant_id and cm.person_id=p.id
      and (cm.display_value ilike '%'||v_query||'%' or cm.normalized_value ilike '%'||v_query||'%')
   )
  )
  order by case when p_sort='newest' then p.created_at end desc nulls last,
   p.full_name,p.id limit p_limit offset p_offset
 ) q;
 -- Remove internal sort key from every item.
 select coalesce(jsonb_agg(value-'sort_rank'),'[]'::jsonb) into v_items
 from jsonb_array_elements(v_items);
 return jsonb_build_object('items',v_items,'total',v_total,'limit',p_limit,'offset',p_offset);
end $fn$;
revoke all on function public.connect_contact_directory(uuid,uuid,text,int,int,text) from public,anon,authenticated;
grant execute on function public.connect_contact_directory(uuid,uuid,text,int,int,text) to service_role;


-- ===== SOURCE: database/connect/saas/43_contact_import_issue_review.sql =====
-- Report skipped import rows without exposing raw contact data in error logs.
create or replace function public.connect_contact_import_issues(
 p_actor_id uuid,p_tenant_id uuid,p_batch_id uuid
) returns jsonb language plpgsql stable set search_path to '' as $fn$
declare v_allowed boolean;
begin
 select exists(select 1 from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active'
  and t.status in ('active','trial')) into v_allowed;
 if not v_allowed then raise exception 'Workspace access denied' using errcode='42501';end if;
 if not exists(select 1 from connect.contact_import_batches where tenant_id=p_tenant_id and id=p_batch_id)
 then raise exception 'Import batch unavailable' using errcode='42501';end if;
 return jsonb_build_object('items',coalesce((
   select jsonb_agg(jsonb_build_object('rowNumber',i.row_number,'reason',i.reason) order by i.row_number)
   from connect.contact_import_items i
   where i.tenant_id=p_tenant_id and i.batch_id=p_batch_id and i.result='skipped'
  ),'[]'::jsonb));
end $fn$;
revoke all on function public.connect_contact_import_issues(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.connect_contact_import_issues(uuid,uuid,uuid) to service_role;


-- ===== SOURCE: database/connect/saas/44_contact_management.sql =====
-- CRM Phase 6: contact enrichment, opt-in ledger, segmentation and review.
create table if not exists connect.contact_profiles (
 tenant_id uuid not null,
 person_id uuid not null,
 company text,
 city text,
 tags text[] not null default '{}',
 notes text,
 updated_at timestamptz not null default now(),
 primary key(tenant_id,person_id),
 foreign key(tenant_id,person_id) references connect.people(tenant_id,id)
);
create table if not exists connect.contact_saved_segments (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references connect.tenants(id),
 name text not null,
 filters jsonb not null default '{}'::jsonb,
 created_by uuid not null,
 created_at timestamptz not null default now(),
 unique(tenant_id,name)
);
create table if not exists connect.contact_duplicate_decisions (
 tenant_id uuid not null,
 first_person_id uuid not null,
 second_person_id uuid not null,
 decision text not null check(decision in ('distinct','merged')),
 actor_membership_id uuid not null,
 decided_at timestamptz not null default now(),
 primary key(tenant_id,first_person_id,second_person_id)
);
revoke all on connect.contact_profiles,connect.contact_saved_segments,connect.contact_duplicate_decisions from public,anon,authenticated;
alter table connect.contact_profiles enable row level security;
alter table connect.contact_saved_segments enable row level security;
alter table connect.contact_duplicate_decisions enable row level security;
create index if not exists contact_profiles_city_idx on connect.contact_profiles(tenant_id,lower(city));
create index if not exists contact_profiles_tags_gin on connect.contact_profiles using gin(tags);
create index if not exists contact_segments_tenant_idx on connect.contact_saved_segments(tenant_id,created_at desc);

create or replace function public.connect_manage_contacts(
 p_actor_id uuid,p_tenant_id uuid,p_action text,p_data jsonb default '{}'::jsonb
) returns jsonb language plpgsql set search_path to '' as $fn$
declare
 v_role text;v_member uuid;v_pid uuid;v_second uuid;v_name text;v_phone text;v_email text;
 v_number text;v_tags text[];v_tag text;v_ids uuid[];v_count int;v_status text;v_evidence text;
 v_filter jsonb;v_query text;v_city text;v_source text;v_consent text;v_offset int;v_limit int;
 v_items jsonb;v_total bigint;v_row jsonb;v_first uuid;v_last uuid;v_segment uuid;
begin
 select m.role,m.id into v_role,v_member from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active' and t.status in ('active','trial');
 if v_member is null then raise exception 'Workspace access denied' using errcode='42501';end if;
 if p_action='segments' then
  return jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at desc)
   from connect.contact_saved_segments s where s.tenant_id=p_tenant_id),'[]'::jsonb));
 end if;
 if p_action='duplicates' then
  return jsonb_build_object('items',coalesce((
   select jsonb_agg(to_jsonb(q)) from (
    select case when a.person_id<b.person_id then a.person_id else b.person_id end as first_id,
     case when a.person_id<b.person_id then b.person_id else a.person_id end as second_id,
     p1.full_name as first_name,p2.full_name as second_name,a.normalized_value as matching_value,a.kind
    from connect.contact_methods a join connect.contact_methods b on b.tenant_id=a.tenant_id
      and b.person_id<>a.person_id and ((a.kind='email' and b.kind='email') or (a.kind in ('mobile','phone','whatsapp') and b.kind in ('mobile','phone','whatsapp'))) and b.normalized_value=a.normalized_value
    join connect.people p1 on p1.id=a.person_id and p1.tenant_id=a.tenant_id and p1.status='active'
    join connect.people p2 on p2.id=b.person_id and p2.tenant_id=b.tenant_id and p2.status='active'
    where a.tenant_id=p_tenant_id and a.person_id<b.person_id and a.kind in ('mobile','phone','whatsapp','email')
      and not exists(select 1 from connect.contact_duplicate_decisions d where d.tenant_id=a.tenant_id
       and d.first_person_id=a.person_id and d.second_person_id=b.person_id)
    order by a.normalized_value limit 80
   ) q),'[]'::jsonb));
 end if;
 if p_action='list' then
  v_filter:=case when jsonb_typeof(p_data->'filters')='object' then p_data->'filters' else '{}'::jsonb end;
  v_query:=left(btrim(coalesce(v_filter->>'search','')),100);
  v_city:=left(btrim(coalesce(v_filter->>'city','')),120);
  v_source:=left(btrim(coalesce(v_filter->>'source','')),120);
  v_tag:=left(btrim(coalesce(v_filter->>'tag','')),50);
  v_consent:=coalesce(v_filter->>'consent','all');
  if v_consent not in ('all','unknown','opted_in','opted_out') then raise exception 'Invalid status filter' using errcode='22023';end if;
  v_offset:=least(100000,greatest(0,coalesce((p_data->>'offset')::int,0)));
  v_limit:=least(100,greatest(1,coalesce((p_data->>'limit')::int,50)));
  with filtered as (
   select p.id,p.full_name,p.created_at,cp.company,cp.city,coalesce(cp.tags,'{}'::text[]) as tags,cp.notes,
    coalesce(mp.status,'unknown') as consent_status,
    (select cm.display_value from connect.contact_methods cm where cm.tenant_id=p_tenant_id and cm.person_id=p.id
      and cm.kind in ('mobile','phone','whatsapp') order by cm.is_primary desc,cm.created_at desc limit 1) phone,
    (select cm.display_value from connect.contact_methods cm where cm.tenant_id=p_tenant_id and cm.person_id=p.id
      and cm.kind='email' order by cm.is_primary desc,cm.created_at desc limit 1) email,
    coalesce((select b.source_label from connect.contact_import_details cd
      join connect.contact_import_batches b on b.tenant_id=cd.tenant_id and b.id=cd.source_batch_id
      where cd.tenant_id=p_tenant_id and cd.person_id=p.id order by cd.imported_at desc limit 1),
      (select iq.source from connect.inquiries iq where iq.tenant_id=p_tenant_id and iq.person_id=p.id order by iq.received_at desc limit 1)) source
   from connect.people p left join connect.contact_profiles cp on cp.tenant_id=p.tenant_id and cp.person_id=p.id
    left join connect.contact_marketing_permissions mp on mp.tenant_id=p.tenant_id and mp.person_id=p.id and mp.channel='whatsapp'
   where p.tenant_id=p_tenant_id and p.status='active'
  ), matches as (
   select * from filtered f where
    (v_query='' or f.full_name ilike '%'||v_query||'%' or coalesce(f.phone,'') ilike '%'||v_query||'%' or
     coalesce(f.email,'') ilike '%'||v_query||'%' or coalesce(f.company,'') ilike '%'||v_query||'%')
     and (v_city='' or coalesce(f.city,'') ilike '%'||v_city||'%')
     and (v_source='' or coalesce(f.source,'') ilike '%'||v_source||'%')
     and (v_tag='' or exists(select 1 from unnest(f.tags) tag where lower(tag)=lower(v_tag)))
     and (v_consent='all' or f.consent_status=v_consent)
  )
  select count(*),coalesce((select jsonb_agg(to_jsonb(z) order by z.full_name,z.id)
    from (select * from matches order by full_name,id limit v_limit offset v_offset) z),'[]'::jsonb)
    into v_total,v_items from matches;
  return jsonb_build_object('items',v_items,'total',v_total,'offset',v_offset,'limit',v_limit);
 end if;
 if v_role not in ('owner','admin','manager') then
  raise exception 'Contact management requires a workspace manager' using errcode='42501';end if;
 if p_action='save_segment' then
  v_name:=left(btrim(coalesce(p_data->>'name','')),90);
  v_filter:=p_data->'filters';
  if length(v_name)<2 or jsonb_typeof(v_filter)<>'object' then raise exception 'Invalid segment' using errcode='22023';end if;
  insert into connect.contact_saved_segments(tenant_id,name,filters,created_by)
   values(p_tenant_id,v_name,v_filter,v_member)
   on conflict(tenant_id,name) do update set filters=excluded.filters
   returning id into v_segment;
  return jsonb_build_object('id',v_segment);
 end if;
 if p_action='delete_segment' then
  delete from connect.contact_saved_segments where tenant_id=p_tenant_id and id=(p_data->>'id')::uuid;
  return jsonb_build_object('ok',true);
 end if;
 if p_action='dismiss_duplicate' then
  v_first:=(p_data->>'firstId')::uuid;v_last:=(p_data->>'secondId')::uuid;
  if v_first=v_last or not exists(select 1 from connect.people where tenant_id=p_tenant_id and id=v_first)
   or not exists(select 1 from connect.people where tenant_id=p_tenant_id and id=v_last)
   then raise exception 'Invalid duplicate pair' using errcode='22023';end if;
  insert into connect.contact_duplicate_decisions(tenant_id,first_person_id,second_person_id,decision,actor_membership_id)
   values(p_tenant_id,least(v_first,v_last),greatest(v_first,v_last),'distinct',v_member)
   on conflict(tenant_id,first_person_id,second_person_id) do update set decision='distinct',actor_membership_id=v_member,decided_at=now();
  return jsonb_build_object('ok',true);
 end if;
 if p_action='edit' then
  v_pid:=(p_data->>'id')::uuid;
  perform 1 from connect.people where tenant_id=p_tenant_id and id=v_pid and status='active' for update;
  if not found then raise exception 'Contact not found' using errcode='42501';end if;
  v_name:=left(btrim(coalesce(p_data->>'name','')),150);
  if length(v_name)<1 then raise exception 'Contact name required' using errcode='22023';end if;
  update connect.people set full_name=v_name,updated_at=now() where tenant_id=p_tenant_id and id=v_pid;
  v_tags:=array(select distinct left(btrim(value),50) from jsonb_array_elements_text(
   case when jsonb_typeof(p_data->'tags')='array' then p_data->'tags' else '[]'::jsonb end) where length(btrim(value))>0 limit 20);
  insert into connect.contact_profiles(tenant_id,person_id,company,city,notes,tags)
   values(p_tenant_id,v_pid,left(nullif(btrim(coalesce(p_data->>'company','')),''),150),
    left(nullif(btrim(coalesce(p_data->>'city','')),''),120),
    left(nullif(btrim(coalesce(p_data->>'notes','')),''),1200),v_tags)
   on conflict(tenant_id,person_id) do update
   set company=excluded.company,city=excluded.city,notes=excluded.notes,tags=excluded.tags,updated_at=now();
  v_phone:=btrim(coalesce(p_data->>'phone',''));
  v_email:=lower(btrim(coalesce(p_data->>'email','')));
  v_number:=regexp_replace(v_phone,'[^0-9]','','g');
  if v_phone<>'' and length(v_number) not between 7 and 15 then raise exception 'Invalid phone' using errcode='22023';end if;
  if v_email<>'' and (length(v_email)>254 or v_email!~'^[^ @]+@[^ @]+\.[^ @]+$') then raise exception 'Invalid email' using errcode='22023';end if;
  if v_phone<>'' then
   -- Retain old phone identifiers for historic conversations; make selected number primary.
   update connect.contact_methods set is_primary=false where tenant_id=p_tenant_id and person_id=v_pid and kind in ('mobile','phone','whatsapp');
   insert into connect.contact_methods(tenant_id,person_id,kind,normalized_value,display_value,is_primary)
    values(p_tenant_id,v_pid,'mobile',v_number,v_phone,true)
    on conflict(tenant_id,person_id,kind,normalized_value) do update set display_value=excluded.display_value,is_primary=true;
  end if;
  if v_email<>'' then
   update connect.contact_methods set is_primary=false where tenant_id=p_tenant_id and person_id=v_pid and kind='email';
   insert into connect.contact_methods(tenant_id,person_id,kind,normalized_value,display_value,is_primary)
    values(p_tenant_id,v_pid,'email',v_email,v_email,true)
    on conflict(tenant_id,person_id,kind,normalized_value) do update set is_primary=true;
  end if;
  insert into connect.audit_events(tenant_id,actor_membership_id,event_type,entity_type,entity_id)
   values(p_tenant_id,v_member,'contact_updated','person',v_pid);
  return jsonb_build_object('ok',true);
 end if;
 if p_action='consent' then
  v_pid:=(p_data->>'id')::uuid;
  v_status:=coalesce(p_data->>'status','');v_evidence:=left(btrim(coalesce(p_data->>'evidence','')),800);
  if not exists(select 1 from connect.people where tenant_id=p_tenant_id and id=v_pid and status='active')
   or v_status not in ('unknown','opted_in','opted_out') then raise exception 'Invalid contact or status' using errcode='22023';end if;
  if v_status='opted_in' and length(v_evidence)<12 then raise exception 'Documented permission evidence required' using errcode='22023';end if;
  -- Opt-out is reversible only after independently verified consent evidence.
  if v_status='unknown' and exists(select 1 from connect.contact_marketing_permissions
   where tenant_id=p_tenant_id and person_id=v_pid and channel='whatsapp' and status='opted_out')
  then raise exception 'An opt-out cannot be reset without verified re-consent' using errcode='22023';end if;
  insert into connect.contact_marketing_permissions(tenant_id,person_id,channel,status,evidence)
   values(p_tenant_id,v_pid,'whatsapp',v_status,nullif(v_evidence,''))
   on conflict(tenant_id,person_id,channel) do update
    set status=excluded.status,evidence=excluded.evidence,updated_at=now();
  insert into connect.audit_events(tenant_id,actor_membership_id,event_type,entity_type,entity_id,metadata)
   values(p_tenant_id,v_member,'contact_marketing_permission','person',v_pid,jsonb_build_object('status',v_status));
  return jsonb_build_object('ok',true);
 end if;
 if p_action='bulk' then
  if jsonb_typeof(p_data->'ids')<>'array' or jsonb_array_length(p_data->'ids') not between 1 and 100 then
   raise exception 'Select 1 to 100 contacts' using errcode='22023';end if;
  select array_agg(distinct value::uuid) into v_ids from jsonb_array_elements_text(p_data->'ids');
  select count(*) into v_count from connect.people where tenant_id=p_tenant_id and status='active' and id=any(v_ids);
  if v_count<>cardinality(v_ids) then raise exception 'Invalid selected contact' using errcode='42501';end if;
  v_status:=p_data->>'operation';
  if v_status not in ('add_tag','remove_tag','set_city','opt_out') then raise exception 'Invalid bulk action' using errcode='22023';end if;
  if v_status in ('add_tag','remove_tag') then
   v_tag:=left(btrim(coalesce(p_data->>'value','')),50);
   if length(v_tag)<1 then raise exception 'A tag is required' using errcode='22023';end if;
  end if;
  insert into connect.contact_profiles(tenant_id,person_id)
   select p_tenant_id,id from unnest(v_ids) id on conflict do nothing;
  if v_status='add_tag' then
   update connect.contact_profiles cp set tags=array(select distinct x from unnest(cp.tags||array[v_tag]) x limit 20),updated_at=now()
    where cp.tenant_id=p_tenant_id and cp.person_id=any(v_ids);
  elsif v_status='remove_tag' then
   update connect.contact_profiles cp set tags=array_remove(cp.tags,v_tag),updated_at=now()
    where cp.tenant_id=p_tenant_id and cp.person_id=any(v_ids);
  elsif v_status='set_city' then
   update connect.contact_profiles cp set city=left(nullif(btrim(coalesce(p_data->>'value','')),''),120),updated_at=now()
    where cp.tenant_id=p_tenant_id and cp.person_id=any(v_ids);
  else
   insert into connect.contact_marketing_permissions(tenant_id,person_id,channel,status,evidence)
    select p_tenant_id,id,'whatsapp','opted_out','Bulk opt-out recorded by CRM manager' from unnest(v_ids) id
    on conflict(tenant_id,person_id,channel) do update set status='opted_out',evidence=excluded.evidence,updated_at=now();
  end if;
  insert into connect.audit_events(tenant_id,actor_membership_id,event_type,entity_type,metadata)
   values(p_tenant_id,v_member,'contacts_bulk_updated','person',jsonb_build_object('operation',v_status,'count',v_count));
  return jsonb_build_object('ok',true,'count',v_count);
 end if;
 raise exception 'Unsupported contact operation' using errcode='22023';
end $fn$;
revoke all on function public.connect_manage_contacts(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.connect_manage_contacts(uuid,uuid,text,jsonb) to service_role;

-- Make metadata imported in Phase 5 immediately visible in saved-segment filters.
-- Do not overwrite user-edited profile fields.
insert into connect.contact_profiles(tenant_id,person_id,company,city,notes,tags)
select distinct on (d.tenant_id,d.person_id)
 d.tenant_id,d.person_id,d.company,d.city,d.notes,coalesce(d.tags,'{}'::text[])
from connect.contact_import_details d
join connect.people p on p.tenant_id=d.tenant_id and p.id=d.person_id and p.status='active'
order by d.tenant_id,d.person_id,d.imported_at desc
on conflict(tenant_id,person_id) do update set
 company=coalesce(connect.contact_profiles.company,excluded.company),
 city=coalesce(connect.contact_profiles.city,excluded.city),
 notes=coalesce(connect.contact_profiles.notes,excluded.notes),
 tags=array(select distinct tag from unnest(coalesce(connect.contact_profiles.tags,'{}'::text[])||excluded.tags) tag limit 20),
 updated_at=now();


-- ===== SOURCE: database/connect/saas/45_contact_safe_merge.sql =====
-- Conservative contact merge. Refuse to reassign connected business history automatically.
-- This prevents losing conversation/admission associations or creating relationship conflicts.
create or replace function public.connect_merge_contacts(
 p_actor_id uuid,p_tenant_id uuid,p_keep_id uuid,p_merge_id uuid
) returns jsonb language plpgsql set search_path to '' as $fn$
declare
 v_member uuid;v_role text;v_count int;v_table text;v_col text;
 v_source_status text;v_keep_status text;
begin
 select m.id,m.role into v_member,v_role from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active'
 and t.status in ('active','trial');
 if v_member is null or v_role not in ('owner','admin','manager') then
  raise exception 'Workspace management access required' using errcode='42501';end if;
 if p_keep_id=p_merge_id then raise exception 'Choose two different contacts' using errcode='22023';end if;
 select count(*) into v_count from connect.people p where p.tenant_id=p_tenant_id
  and p.id in (p_keep_id,p_merge_id) and p.status='active';
 if v_count<>2 then raise exception 'Both contacts must be active in this workspace' using errcode='42501';end if;
 -- Ensure no active interactions or relations would be orphaned or accidentally reassigned.
 for v_table,v_col in select * from (values
  ('activities','person_id'),('appointments','person_id'),('attribution','person_id'),
  ('consent_events','person_id'),('contact_owners','person_id'),
  ('conversations','person_id'),('household_members','person_id'),('inquiries','person_id'),
  ('opportunities','contact_id'),('opportunity_people','person_id'),
  ('organization_contacts','person_id'),('person_relations','from_person_id'),
  ('person_relations','to_person_id'),('tasks','person_id')
 ) as x(tab,col) loop
  execute format('select count(*) from connect.%I where tenant_id=$1 and %I=$2',v_table,v_col)
    into v_count using p_tenant_id,p_merge_id;
  if v_count>0 then
   raise exception 'Cannot merge: source contact has connected CRM history (%). Review records manually.',v_table using errcode='22023';
  end if;
 end loop;
 -- Preserve identifiers on the kept contact without duplicate unique records.
 insert into connect.contact_methods(tenant_id,person_id,kind,normalized_value,display_value,is_primary)
 select p_tenant_id,p_keep_id,cm.kind,cm.normalized_value,cm.display_value,false
 from connect.contact_methods cm where cm.tenant_id=p_tenant_id and cm.person_id=p_merge_id
 on conflict(tenant_id,person_id,kind,normalized_value) do nothing;
 insert into connect.person_roles(tenant_id,person_id,role)
 select p_tenant_id,p_keep_id,pr.role from connect.person_roles pr
 where pr.tenant_id=p_tenant_id and pr.person_id=p_merge_id
 on conflict do nothing;
 insert into connect.contact_profiles(tenant_id,person_id,company,city,tags,notes)
 select p_tenant_id,p_keep_id,s.company,s.city,s.tags,s.notes
 from connect.contact_profiles s where s.tenant_id=p_tenant_id and s.person_id=p_merge_id
 on conflict(tenant_id,person_id) do update set
 company=coalesce(connect.contact_profiles.company,excluded.company),
 city=coalesce(connect.contact_profiles.city,excluded.city),
 notes=coalesce(connect.contact_profiles.notes,excluded.notes),
 tags=array(select distinct x from unnest(connect.contact_profiles.tags||excluded.tags) x limit 20),updated_at=now();
 select status into v_source_status from connect.contact_marketing_permissions
 where tenant_id=p_tenant_id and person_id=p_merge_id and channel='whatsapp';
 select status into v_keep_status from connect.contact_marketing_permissions
 where tenant_id=p_tenant_id and person_id=p_keep_id and channel='whatsapp';
 -- Safest rule: an opt-out anywhere wins. Never transfer opt-in as permission for another identity.
 if v_source_status='opted_out' or v_keep_status='opted_out' then
  insert into connect.contact_marketing_permissions(tenant_id,person_id,channel,status,evidence)
   values(p_tenant_id,p_keep_id,'whatsapp','opted_out','Opt-out preserved during contact merge')
   on conflict(tenant_id,person_id,channel) do update set status='opted_out',evidence=excluded.evidence,updated_at=now();
 end if;
 insert into connect.contact_import_details(tenant_id,person_id,source_batch_id,company,city,notes,tags,source_reference)
 select p_tenant_id,p_keep_id,d.source_batch_id,d.company,d.city,d.notes,d.tags,d.source_reference
 from connect.contact_import_details d where d.tenant_id=p_tenant_id and d.person_id=p_merge_id
 on conflict do nothing;
 update connect.contact_import_items set person_id=p_keep_id where tenant_id=p_tenant_id and person_id=p_merge_id;
 -- The archived source is retained as an auditable identity. It is not deleted.
 update connect.people set status='archived',updated_at=now() where tenant_id=p_tenant_id and id=p_merge_id;
 insert into connect.contact_duplicate_decisions(tenant_id,first_person_id,second_person_id,decision,actor_membership_id)
 values(p_tenant_id,least(p_keep_id,p_merge_id),greatest(p_keep_id,p_merge_id),'merged',v_member)
 on conflict(tenant_id,first_person_id,second_person_id) do update
 set decision='merged',actor_membership_id=v_member,decided_at=now();
 insert into connect.audit_events(tenant_id,actor_membership_id,event_type,entity_type,entity_id,metadata)
 values(p_tenant_id,v_member,'contact_merged','person',p_keep_id,jsonb_build_object('archivedId',p_merge_id));
 return jsonb_build_object('ok',true,'keptId',p_keep_id,'archivedId',p_merge_id);
end $fn$;
revoke all on function public.connect_merge_contacts(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.connect_merge_contacts(uuid,uuid,uuid,uuid) to service_role;


-- ===== SOURCE: database/connect/saas/46_contact_management_detail.sql =====
-- Read one contact for direct Contact 360 -> Edit navigation, including off-page records.
create or replace function public.connect_contact_management_detail(
 p_actor_id uuid,p_tenant_id uuid,p_person_id uuid
) returns jsonb language plpgsql stable set search_path to '' as $fn$
declare v_allowed boolean;v_contact jsonb;
begin
 select exists(select 1 from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active'
 and t.status in ('active','trial')) into v_allowed;
 if not v_allowed then raise exception 'Workspace access denied' using errcode='42501';end if;
 select to_jsonb(z) into v_contact from (
  select p.id,p.full_name,p.created_at,cp.company,cp.city,cp.notes,coalesce(cp.tags,'{}'::text[]) tags,
   coalesce(mp.status,'unknown') consent_status,
   (select cm.display_value from connect.contact_methods cm where cm.tenant_id=p_tenant_id and cm.person_id=p.id
    and cm.kind in ('phone','mobile','whatsapp') order by cm.is_primary desc,cm.created_at desc limit 1) phone,
   (select cm.display_value from connect.contact_methods cm where cm.tenant_id=p_tenant_id and cm.person_id=p.id
    and cm.kind='email' order by cm.is_primary desc,cm.created_at desc limit 1) email,
   coalesce((select b.source_label from connect.contact_import_details d join connect.contact_import_batches b
    on b.tenant_id=d.tenant_id and b.id=d.source_batch_id
    where d.tenant_id=p_tenant_id and d.person_id=p.id order by d.imported_at desc limit 1),
    (select iq.source from connect.inquiries iq where iq.tenant_id=p_tenant_id and iq.person_id=p.id order by iq.received_at desc limit 1)) source
  from connect.people p
  left join connect.contact_profiles cp on cp.tenant_id=p.tenant_id and cp.person_id=p.id
  left join connect.contact_marketing_permissions mp on mp.tenant_id=p.tenant_id and mp.person_id=p.id and mp.channel='whatsapp'
  where p.tenant_id=p_tenant_id and p.id=p_person_id and p.status='active'
 ) z;
 if v_contact is null then raise exception 'Contact not found' using errcode='42501';end if;
 return jsonb_build_object('item',v_contact);
end $fn$;
revoke all on function public.connect_contact_management_detail(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.connect_contact_management_detail(uuid,uuid,uuid) to service_role;


-- ===== SOURCE: database/connect/saas/47_contact_import_profile_sync.sql =====
-- Keep imported contact tags/city/company available to contact segments after every future import.
create or replace function connect.contact_import_enrich_profile()
returns trigger language plpgsql set search_path to '' as $fn$
begin
 insert into connect.contact_profiles(tenant_id,person_id,company,city,notes,tags)
 values(new.tenant_id,new.person_id,new.company,new.city,new.notes,coalesce(new.tags,'{}'::text[]))
 on conflict(tenant_id,person_id) do update
 set company=coalesce(connect.contact_profiles.company,excluded.company),
 city=coalesce(connect.contact_profiles.city,excluded.city),
 notes=coalesce(connect.contact_profiles.notes,excluded.notes),
 tags=array(select distinct tag from unnest(coalesce(connect.contact_profiles.tags,'{}'::text[])||excluded.tags) tag limit 20),
 updated_at=now();
 return new;
end $fn$;
revoke all on function connect.contact_import_enrich_profile() from public,anon,authenticated;
drop trigger if exists contact_import_enrich_profile on connect.contact_import_details;
create trigger contact_import_enrich_profile
 after insert on connect.contact_import_details
 for each row execute function connect.contact_import_enrich_profile();

COMMIT;
