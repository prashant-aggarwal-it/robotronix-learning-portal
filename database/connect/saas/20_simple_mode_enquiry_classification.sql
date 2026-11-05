begin;
create table connect.workspace_preferences(
 tenant_id uuid primary key references connect.tenants(id) on delete cascade,
 interface_mode text not null default 'simple' check(interface_mode in ('simple','advanced')),
 updated_at timestamptz not null default now()
);
create table connect.enquiry_categories(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references connect.tenants(id) on delete cascade,
 label text not null check(length(btrim(label)) between 2 and 80),
 sort_order integer not null default 0,
 active boolean not null default true,
 created_at timestamptz not null default now(),
 unique(tenant_id,id)
);
create unique index connect_enquiry_category_label on connect.enquiry_categories(tenant_id,lower(btrim(label)));
alter table connect.inquiries add column category_id uuid;
alter table connect.inquiries add constraint connect_inquiry_category_fk
 foreign key(tenant_id,category_id) references connect.enquiry_categories(tenant_id,id) on delete restrict;
create index connect_inquiries_category on connect.inquiries(tenant_id,category_id,received_at desc);
alter table connect.workspace_preferences enable row level security;
alter table connect.enquiry_categories enable row level security;
revoke all on connect.workspace_preferences,connect.enquiry_categories from public,anon,authenticated;
grant select,insert,update,delete on connect.workspace_preferences,connect.enquiry_categories to service_role;

create or replace function connect.initialize_enquiry_categories() returns trigger
language plpgsql security definer set search_path='' as $fn$
declare labels text[]:=array['Online Courses','Offline Courses','Kits & Components','School Programs','Partnerships','Collaborations','Trainer / Job Applicant','Vendor / Supplier','General / Other'];v_label text;idx int:=0;
begin
 insert into connect.workspace_preferences(tenant_id) values(new.id);
 foreach v_label in array labels loop
  idx:=idx+1;
  insert into connect.enquiry_categories(tenant_id,label,sort_order) values(new.id,v_label,idx);
 end loop;
 return new;
end $fn$;
create trigger connect_tenant_default_categories after insert on connect.tenants
 for each row execute function connect.initialize_enquiry_categories();
insert into connect.workspace_preferences(tenant_id) select id from connect.tenants on conflict do nothing;
insert into connect.enquiry_categories(tenant_id,label,sort_order)
select t.id,defaults.label,defaults.ordinality from connect.tenants t
cross join unnest(array['Online Courses','Offline Courses','Kits & Components','School Programs','Partnerships','Collaborations','Trainer / Job Applicant','Vendor / Supplier','General / Other']) with ordinality defaults(label,ordinality)
on conflict do nothing;

create or replace function public.connect_enquiry_preferences(
 p_actor_id uuid,p_tenant_id uuid,p_action text default 'read',p_data jsonb default '{}'::jsonb
) returns jsonb language plpgsql security invoker set search_path='' as $fn$
declare v_role text;v_member uuid;v_id uuid;v_mode text;v_categories jsonb;v_label text;v_category uuid;
begin
 select m.id,m.role into v_member,v_role from connect.memberships m
 join connect.tenants t on t.id=m.tenant_id
 where m.tenant_id=p_tenant_id and m.user_id=p_actor_id and m.status='active' and t.status in ('trial','active');
 if v_member is null then raise exception 'Institute access denied' using errcode='42501';end if;
 if p_action<>'read' and v_role not in ('owner','admin') then raise exception 'Institute owner/admin required' using errcode='42501';end if;
 if p_action='set_mode' then
  v_mode:=p_data->>'mode';
  if v_mode not in ('simple','advanced') or v_mode is null then raise exception 'Invalid interface mode' using errcode='22023';end if;
  update connect.workspace_preferences set interface_mode=v_mode,updated_at=now() where tenant_id=p_tenant_id;
 elsif p_action='add_category' then
  v_label:=btrim(p_data->>'label');
  if v_label is null or length(v_label) not between 2 and 80 then raise exception 'Invalid category label' using errcode='22023';end if;
  insert into connect.enquiry_categories(tenant_id,label,sort_order)
  values(p_tenant_id,v_label,(select coalesce(max(sort_order),0)+1 from connect.enquiry_categories where tenant_id=p_tenant_id))
  returning id into v_id;
 elsif p_action='rename_category' then
  v_category:=(p_data->>'id')::uuid;v_label:=btrim(p_data->>'label');
  if v_label is null or length(v_label) not between 2 and 80 then raise exception 'Invalid category label' using errcode='22023';end if;
  update connect.enquiry_categories set label=v_label where tenant_id=p_tenant_id and id=v_category returning id into v_id;
  if v_id is null then raise exception 'Category unavailable' using errcode='42501';end if;
 elsif p_action='set_category_active' then
  v_category:=(p_data->>'id')::uuid;
  if jsonb_typeof(p_data->'active')<>'boolean' then raise exception 'Invalid category status' using errcode='22023';end if;
  update connect.enquiry_categories set active=(p_data->>'active')::boolean where tenant_id=p_tenant_id and id=v_category returning id into v_id;
  if v_id is null then raise exception 'Category unavailable' using errcode='42501';end if;
 elsif p_action='classify_inquiry' then
  if v_role='viewer' then raise exception 'Classification requires staff access' using errcode='42501';end if;
  v_category:=(p_data->>'categoryId')::uuid;
  if not exists(select 1 from connect.enquiry_categories where tenant_id=p_tenant_id and id=v_category and active)
  then raise exception 'Category unavailable' using errcode='42501';end if;
  update connect.inquiries set category_id=v_category where tenant_id=p_tenant_id and id=(p_data->>'inquiryId')::uuid returning id into v_id;
  if v_id is null then raise exception 'Enquiry unavailable' using errcode='42501';end if;
 else
  if p_action<>'read' then raise exception 'Unknown preference action' using errcode='22023';end if;
 end if;
 if p_action<>'read' then
  insert into connect.audit_events(tenant_id,actor_membership_id,event_type,entity_type,entity_id,metadata)
  values(p_tenant_id,v_member,'enquiry_'||p_action,'enquiry_configuration',v_id,jsonb_build_object('action',p_action));
 end if;
 select interface_mode into v_mode from connect.workspace_preferences where tenant_id=p_tenant_id;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'label',label,'active',active,'sortOrder',sort_order) order by sort_order,label),'[]'::jsonb)
 into v_categories from connect.enquiry_categories where tenant_id=p_tenant_id;
 return jsonb_build_object('mode',coalesce(v_mode,'simple'),'categories',v_categories);
end $fn$;
revoke all on function public.connect_enquiry_preferences(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.connect_enquiry_preferences(uuid,uuid,text,jsonb) to service_role;
commit;