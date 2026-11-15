create or replace function public.saas_admin_academy_students(p_organization_id uuid)
returns jsonb language sql stable security definer set search_path=pg_catalog as $$
 select case when exists(
  select 1 from saas.memberships m where m.organization_id=p_organization_id
  and m.user_id=auth.uid() and m.status='active' and m.role_key in ('owner','admin')
 ) then coalesce((
  select jsonb_agg(jsonb_build_object('studentId',s.id,'name',s.full_name,'grade',s.grade) order by s.full_name)
  from saas.academy_students a join public.students s on s.id=a.student_id
  where a.organization_id=p_organization_id
 ),'[]'::jsonb) else null::jsonb end;
$$;
revoke all on function public.saas_admin_academy_students(uuid) from public,anon;
grant execute on function public.saas_admin_academy_students(uuid) to authenticated;
