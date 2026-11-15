create or replace function public.saas_admin_academy_overview(p_organization_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_name text;v_slug text;v_students integer;v_trainers integer;v_courses integer;v_enrollments integer;
begin
 select o.display_name,o.slug into v_name,v_slug from saas.organizations o
 join saas.memberships m on m.organization_id=o.id
 join saas.module_entitlements e on e.organization_id=o.id and e.module_key='academy' and e.enabled
 where o.id=p_organization_id and o.status='active' and m.user_id=auth.uid()
 and m.status='active' and m.role_key in ('owner','admin');
 if v_name is null then raise exception 'Academy administrator membership required' using errcode='42501';end if;
 select count(*) into v_students from saas.academy_students where organization_id=p_organization_id;
 select count(*) into v_trainers from saas.academy_trainers where organization_id=p_organization_id;
 select count(*) into v_courses from saas.academy_courses where organization_id=p_organization_id;
 select count(*) into v_enrollments from saas.academy_enrollments where organization_id=p_organization_id;
 return jsonb_build_object('organizationId',p_organization_id,'name',v_name,'slug',v_slug,
 'students',v_students,'trainers',v_trainers,'courses',v_courses,'enrollments',v_enrollments);
end $$;
revoke all on function public.saas_admin_academy_overview(uuid) from public,anon;
grant execute on function public.saas_admin_academy_overview(uuid) to authenticated;