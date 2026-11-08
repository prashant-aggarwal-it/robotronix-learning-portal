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
   (select b.source_label from connect.contact_import_details d join connect.contact_import_batches b
    on b.tenant_id=d.tenant_id and b.id=d.source_batch_id
    where d.tenant_id=p_tenant_id and d.person_id=p.id order by d.imported_at desc limit 1) source
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
