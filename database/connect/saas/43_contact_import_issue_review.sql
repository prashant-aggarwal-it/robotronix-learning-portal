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
