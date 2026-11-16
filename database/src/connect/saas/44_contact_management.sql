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
