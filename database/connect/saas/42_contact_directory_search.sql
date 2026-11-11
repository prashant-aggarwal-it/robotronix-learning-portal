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
