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
