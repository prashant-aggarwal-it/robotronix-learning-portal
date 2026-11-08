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
