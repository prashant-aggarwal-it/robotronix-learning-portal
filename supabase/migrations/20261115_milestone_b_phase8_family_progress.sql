-- Family progress and schedule projection: only tenant-linked learner and enrollment data.
create or replace function public.saas_my_academy_family()
returns jsonb language sql stable security definer set search_path=pg_catalog as $$
 select coalesce(jsonb_agg(jsonb_build_object(
 'organizationId',o.id,'academy',o.display_name,'slug',o.slug,
 'studentId',s.id,'studentName',s.full_name,'grade',s.grade,'accessRole',a.access_role,
 'courses',coalesce((
  select jsonb_agg(jsonb_build_object(
   'enrollmentId',en.id,'courseTitle',c.title,'status',en.status,
   'sessionsCompleted',en.sessions_completed,'progressPercent',en.progress_percent
  ) order by en.created_at desc)
  from saas.academy_enrollments ae
  join public.enrollments en on en.id=ae.enrollment_id and en.student_id=s.id
  join saas.academy_courses ac on ac.organization_id=o.id and ac.course_id=en.course_id
  join public.courses c on c.id=ac.course_id
  where ae.organization_id=o.id
 ),'[]'::jsonb),
 'upcomingClasses',coalesce((
  select jsonb_agg(jsonb_build_object(
   'title',events.title,'date',events.date,'startTime',events.start_time,
   'timezone',events.timezone,'status',events.status
  ) order by events.date,events.start_time)
  from (
   select ev.title,ev.date,ev.start_time,ev.timezone,ev.status
   from public.schedule_events ev
   join saas.academy_enrollments ae on ae.enrollment_id=ev.enrollment_id
   join public.enrollments en on en.id=ae.enrollment_id and en.student_id=s.id
   where ae.organization_id=o.id and ev.date>=current_date
   order by ev.date,ev.start_time limit 10
  ) events
 ),'[]'::jsonb)
 ) order by o.display_name,s.full_name),'[]'::jsonb)
 from saas.academy_family_access a
 join saas.organizations o on o.id=a.organization_id and o.status='active'
 join saas.academy_students ast on ast.student_id=a.student_id and ast.organization_id=o.id
 join public.students s on s.id=ast.student_id
 join saas.memberships m on m.user_id=auth.uid() and m.organization_id=o.id and m.status='active'
 join saas.module_entitlements e on e.organization_id=o.id and e.module_key='academy' and e.enabled
 where a.user_id=auth.uid();
$$;
revoke all on function public.saas_my_academy_family() from public,anon;
grant execute on function public.saas_my_academy_family() to authenticated;
