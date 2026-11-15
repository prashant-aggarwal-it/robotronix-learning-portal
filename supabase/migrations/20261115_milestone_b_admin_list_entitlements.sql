-- Milestone B hardening: explicit Academy entitlement checks for admin list helpers.
create or replace function public.saas_admin_academy_students(p_organization_id uuid)
returns jsonb language sql stable security definer set search_path=pg_catalog as $$
select case when exists(
 select 1 from saas.memberships m
 join saas.organizations o on o.id=m.organization_id and o.status='active'
 join saas.module_entitlements e on e.organization_id=o.id and e.module_key='academy' and e.enabled
 where m.organization_id=p_organization_id and m.user_id=auth.uid()
 and m.role_key in ('owner','admin') and m.status='active'
) then coalesce((
 select jsonb_agg(jsonb_build_object('studentId',s.id,'name',s.full_name,'grade',s.grade) order by s.full_name)
 from saas.academy_students a join public.students s on s.id=a.student_id
 where a.organization_id=p_organization_id
),'[]'::jsonb) else null::jsonb end;
$$;
create or replace function public.saas_admin_academy_trainers(p_organization_id uuid)
returns jsonb language sql stable security definer set search_path=pg_catalog as $$
select case when exists(
 select 1 from saas.memberships m
 join saas.organizations o on o.id=m.organization_id and o.status='active'
 join saas.module_entitlements e on e.organization_id=o.id and e.module_key='academy' and e.enabled
 where m.organization_id=p_organization_id and m.user_id=auth.uid()
 and m.role_key in ('owner','admin') and m.status='active'
) then coalesce((
 select jsonb_agg(jsonb_build_object('trainerId',t.id,'name',t.full_name,'linkedUserId',l.user_id) order by t.full_name)
 from saas.academy_trainers at
 join public.trainers t on t.id=at.trainer_id
 left join saas.academy_trainer_account_links l
 on l.organization_id=at.organization_id and l.trainer_id=t.id
 where at.organization_id=p_organization_id
),'[]'::jsonb) else null::jsonb end;
$$;
revoke all on function public.saas_admin_academy_students(uuid),public.saas_admin_academy_trainers(uuid) from public,anon;
grant execute on function public.saas_admin_academy_students(uuid),public.saas_admin_academy_trainers(uuid) to authenticated;
