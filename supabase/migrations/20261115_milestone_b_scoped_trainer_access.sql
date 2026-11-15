-- Module-specific trainer identity link: no global public.profiles role changes.
create table if not exists saas.academy_trainer_account_links(
 organization_id uuid not null references saas.organizations(id),
 trainer_id uuid not null references public.trainers(id),
 user_id uuid not null references auth.users(id) on delete cascade,
 linked_at timestamptz not null default now(),
 primary key(organization_id,trainer_id),
 unique(organization_id,user_id)
);
alter table saas.academy_trainer_account_links enable row level security;
revoke all on saas.academy_trainer_account_links from public,anon,authenticated;

create or replace function public.saas_admin_academy_trainers(p_organization_id uuid)
returns jsonb language sql stable security definer set search_path=pg_catalog as $$
select case when exists(
 select 1 from saas.memberships m where m.organization_id=p_organization_id
 and m.user_id=auth.uid() and m.role_key in ('owner','admin') and m.status='active'
) then coalesce((
 select jsonb_agg(jsonb_build_object(
  'trainerId',t.id,'name',t.full_name,'linkedUserId',l.user_id
 ) order by t.full_name)
 from saas.academy_trainers at
 join public.trainers t on t.id=at.trainer_id
 left join saas.academy_trainer_account_links l
  on l.organization_id=at.organization_id and l.trainer_id=t.id
 where at.organization_id=p_organization_id
),'[]'::jsonb) else null::jsonb end;
$$;
revoke all on function public.saas_admin_academy_trainers(uuid) from public,anon;
grant execute on function public.saas_admin_academy_trainers(uuid) to authenticated;

create or replace function public.saas_assign_trainer_account(
 p_organization_id uuid,p_trainer_id uuid,p_user_id uuid
) returns boolean language plpgsql security definer set search_path=pg_catalog as $$
begin
 if auth.uid() is null or auth.role()<>'authenticated' then raise exception 'Sign in first' using errcode='42501';end if;
 if not exists(select 1 from saas.memberships m
  join saas.organizations o on o.id=m.organization_id and o.status='active'
  where m.organization_id=p_organization_id and m.user_id=auth.uid()
  and m.role_key in ('owner','admin') and m.status='active')
 or not exists(select 1 from saas.module_entitlements e
  where e.organization_id=p_organization_id and e.module_key='academy' and e.enabled)
 or not exists(select 1 from saas.memberships m join auth.users u on u.id=m.user_id
  where m.organization_id=p_organization_id and m.user_id=p_user_id
  and m.role_key='trainer' and m.status='active' and u.email_confirmed_at is not null)
 or not exists(select 1 from saas.academy_trainers t
  where t.organization_id=p_organization_id and t.trainer_id=p_trainer_id)
 then raise exception 'Trainer assignment not authorized' using errcode='42501';end if;
 insert into saas.academy_trainer_account_links(organization_id,trainer_id,user_id)
 values(p_organization_id,p_trainer_id,p_user_id)
 on conflict(organization_id,trainer_id) do update
 set user_id=excluded.user_id,linked_at=now();
 return true;
end $$;
revoke all on function public.saas_assign_trainer_account(uuid,uuid,uuid) from public,anon;
grant execute on function public.saas_assign_trainer_account(uuid,uuid,uuid) to authenticated;

create or replace function public.saas_my_academy_trainer(p_organization_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_org saas.organizations%rowtype;v_trainer uuid;v_learners jsonb;
begin
 select o.* into v_org from saas.organizations o join saas.memberships m on m.organization_id=o.id
 join saas.module_entitlements e on e.organization_id=o.id and e.module_key='academy' and e.enabled
 where o.id=p_organization_id and m.user_id=auth.uid() and m.status='active'
 and m.role_key='trainer' and o.status='active';
 if v_org.id is null then raise exception 'Trainer academy access required' using errcode='42501';end if;
 select l.trainer_id into v_trainer from saas.academy_trainer_account_links l
 where l.organization_id=p_organization_id and l.user_id=auth.uid();
 select coalesce(jsonb_agg(jsonb_build_object(
  'studentName',s.full_name,'courseTitle',c.title,'enrollmentStatus',en.status,
  'sessionsCompleted',en.sessions_completed
 ) order by s.full_name),'[]'::jsonb) into v_learners
 from saas.academy_enrollments ae
 join public.enrollments en on en.id=ae.enrollment_id and en.trainer_id=v_trainer
 join saas.academy_students ast on ast.organization_id=p_organization_id and ast.student_id=en.student_id
 join public.students s on s.id=ast.student_id
 join saas.academy_courses ac on ac.organization_id=p_organization_id and ac.course_id=en.course_id
 join public.courses c on c.id=ac.course_id
 where ae.organization_id=p_organization_id;
 return jsonb_build_object('academy',v_org.display_name,'slug',v_org.slug,'trainerLinked',v_trainer is not null,
 'learners',v_learners);
end $$;
revoke all on function public.saas_my_academy_trainer(uuid) from public,anon;
grant execute on function public.saas_my_academy_trainer(uuid) to authenticated;
