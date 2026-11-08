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
