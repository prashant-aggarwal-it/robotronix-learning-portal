-- DEV-only Phase 3: contact relationships and explicit contact owner.
-- Existing person_relations and organization_contacts remain canonical.
create table if not exists connect.contact_owners (
 tenant_id uuid not null,
 person_id uuid not null,
 owner_membership_id uuid not null,
 assigned_at timestamptz not null default now(),
 assigned_by_membership_id uuid,
 primary key (tenant_id,person_id),
 foreign key (tenant_id,person_id) references connect.people(tenant_id,id) on delete cascade,
 foreign key (tenant_id,owner_membership_id) references connect.memberships(tenant_id,id) on delete restrict,
 foreign key (tenant_id,assigned_by_membership_id) references connect.memberships(tenant_id,id) on delete set null (assigned_by_membership_id)
);
create index if not exists idx_connect_contact_owners_owner on connect.contact_owners(tenant_id,owner_membership_id);
revoke all on connect.contact_owners from public,anon,authenticated;
grant select,insert,update,delete on connect.contact_owners to service_role;

create or replace function public.connect_contact_relations(
 p_actor_id uuid,p_tenant_id uuid,p_person_id uuid
) returns jsonb language plpgsql stable set search_path='' as $fn$
declare v_member uuid; v_owner jsonb; v_people jsonb; v_orgs jsonb;v_members jsonb;v_org_options jsonb;v_people_options jsonb;
begin
 select m.id into v_member from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active' and t.status in ('active','trial');
 if v_member is null then raise exception 'Access denied' using errcode='42501';end if;
 if not exists(select 1 from connect.people where tenant_id=p_tenant_id and id=p_person_id and status='active')
 then raise exception 'Contact unavailable' using errcode='42501';end if;

 select coalesce(jsonb_agg(jsonb_build_object('personId',x.other_id,'name',x.full_name,'relationship',x.relationship,'direction',x.direction)
   order by x.full_name,x.relationship),'[]'::jsonb) into v_people
 from (
  select r.to_person_id other_id,p.full_name,r.relationship,'outgoing'::text direction
  from connect.person_relations r join connect.people p on p.tenant_id=r.tenant_id and p.id=r.to_person_id
  where r.tenant_id=p_tenant_id and r.from_person_id=p_person_id
  union all
  select r.from_person_id,p.full_name,r.relationship,'incoming'::text
  from connect.person_relations r join connect.people p on p.tenant_id=r.tenant_id and p.id=r.from_person_id
  where r.tenant_id=p_tenant_id and r.to_person_id=p_person_id
 ) x;
 select coalesce(jsonb_agg(jsonb_build_object('organizationId',o.id,'name',o.name,'category',o.category,'position',oc.position_title)
 order by o.name),'[]'::jsonb) into v_orgs
 from connect.organization_contacts oc join connect.organizations o on o.tenant_id=oc.tenant_id and o.id=oc.organization_id
 where oc.tenant_id=p_tenant_id and oc.person_id=p_person_id;
 select jsonb_build_object('memberId',m.id,'role',m.role) into v_owner
 from connect.contact_owners co join connect.memberships m on m.tenant_id=co.tenant_id and m.id=co.owner_membership_id
 where co.tenant_id=p_tenant_id and co.person_id=p_person_id;
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'role',m.role,'label',coalesce(u.email,'Team member'))
 order by u.email),'[]'::jsonb) into v_members
 from connect.memberships m join auth.users u on u.id=m.user_id
 where m.tenant_id=p_tenant_id and m.status='active' and m.role<>'viewer';
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'category',o.category) order by o.name),'[]'::jsonb)
 into v_org_options from connect.organizations o where o.tenant_id=p_tenant_id;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.full_name) order by p.full_name),'[]'::jsonb)
 into v_people_options from connect.people p where p.tenant_id=p_tenant_id and p.status='active' and p.id<>p_person_id;
 return jsonb_build_object('people',v_people,'organizations',v_orgs,'owner',v_owner,'members',v_members,
 'organizationOptions',v_org_options,'peopleOptions',v_people_options);
end $fn$;

create or replace function public.connect_contact_relation_command(
 p_actor_id uuid,p_tenant_id uuid,p_person_id uuid,p_action text,p_data jsonb
) returns jsonb language plpgsql set search_path='' as $fn$
declare v_member uuid;v_role text;v_other uuid;v_org uuid;v_owner uuid;v_label text;
begin
 select m.id,m.role into v_member,v_role from connect.memberships m join connect.tenants t on t.id=m.tenant_id
 where m.user_id=p_actor_id and m.tenant_id=p_tenant_id and m.status='active' and t.status in ('active','trial');
 if v_member is null or v_role='viewer' then raise exception 'Write access denied' using errcode='42501';end if;
 if not exists(select 1 from connect.people where tenant_id=p_tenant_id and id=p_person_id and status='active')
 then raise exception 'Contact unavailable' using errcode='42501';end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Invalid payload' using errcode='22023';end if;
 case p_action
 when 'link_person' then
  v_other:=nullif(p_data->>'relatedPersonId','')::uuid;
  v_label:=nullif(btrim(p_data->>'relationship'),'');
  if v_other is null or v_other=p_person_id or v_label is null or length(v_label)>60
  or not exists(select 1 from connect.people where tenant_id=p_tenant_id and id=v_other and status='active')
  then raise exception 'Invalid related contact' using errcode='22023';end if;
  insert into connect.person_relations(tenant_id,from_person_id,to_person_id,relationship)
  values(p_tenant_id,p_person_id,v_other,v_label) on conflict do nothing;
 when 'unlink_person' then
  v_other:=nullif(p_data->>'relatedPersonId','')::uuid;
  v_label:=nullif(btrim(p_data->>'relationship'),'');
  if (p_data->>'direction') not in ('incoming','outgoing') or v_other is null or v_label is null
  then raise exception 'Invalid relationship' using errcode='22023';end if;
  if p_data->>'direction'='outgoing' then
   delete from connect.person_relations where tenant_id=p_tenant_id and from_person_id=p_person_id
   and to_person_id=v_other and relationship=v_label;
  else
   delete from connect.person_relations where tenant_id=p_tenant_id and from_person_id=v_other
   and to_person_id=p_person_id and relationship=v_label;
  end if;
 when 'link_organization' then
  v_org:=nullif(p_data->>'organizationId','')::uuid;
  v_label:=nullif(btrim(p_data->>'position'),'');
  if v_org is null or length(coalesce(v_label,''))>100 or
    not exists(select 1 from connect.organizations where tenant_id=p_tenant_id and id=v_org)
  then raise exception 'Invalid organization link' using errcode='22023';end if;
  insert into connect.organization_contacts(tenant_id,organization_id,person_id,position_title)
  values(p_tenant_id,v_org,p_person_id,v_label)
  on conflict(tenant_id,organization_id,person_id) do update set position_title=excluded.position_title;
 when 'unlink_organization' then
  v_org:=nullif(p_data->>'organizationId','')::uuid;
  if v_org is null then raise exception 'Missing organization' using errcode='22023';end if;
  delete from connect.organization_contacts where tenant_id=p_tenant_id and person_id=p_person_id and organization_id=v_org;
 when 'assign_owner' then
  if v_role not in ('owner','admin','manager') then raise exception 'Manager access required' using errcode='42501';end if;
  v_owner:=nullif(p_data->>'memberId','')::uuid;
  if v_owner is null then
   delete from connect.contact_owners where tenant_id=p_tenant_id and person_id=p_person_id;
  else
   if not exists(select 1 from connect.memberships where tenant_id=p_tenant_id and id=v_owner and status='active' and role<>'viewer')
   then raise exception 'Inactive or invalid assignee' using errcode='42501';end if;
   insert into connect.contact_owners(tenant_id,person_id,owner_membership_id,assigned_by_membership_id)
   values(p_tenant_id,p_person_id,v_owner,v_member)
   on conflict(tenant_id,person_id) do update
   set owner_membership_id=excluded.owner_membership_id,assigned_by_membership_id=excluded.assigned_by_membership_id,assigned_at=now();
  end if;
 else raise exception 'Unsupported relationship action' using errcode='22023';
 end case;
 insert into connect.audit_events(tenant_id,actor_membership_id,event_type,entity_type,entity_id,metadata)
 values(p_tenant_id,v_member,'contact_'||p_action,'person',p_person_id,jsonb_build_object('action',p_action));
 return jsonb_build_object('ok',true);
end $fn$;
revoke all on function public.connect_contact_relations(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.connect_contact_relation_command(uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.connect_contact_relations(uuid,uuid,uuid) to service_role;
grant execute on function public.connect_contact_relation_command(uuid,uuid,uuid,text,jsonb) to service_role;
notify pgrst,'reload schema';
