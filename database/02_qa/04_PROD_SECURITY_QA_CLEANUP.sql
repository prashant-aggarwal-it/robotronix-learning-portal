-- Robotronix controlled production security QA cleanup.
-- Removes ONLY fixtures installed by 03_PROD_SECURITY_QA_SEED.sql.
-- Does NOT remove auth.users, profiles, RLS policies or triggers.
-- If testing created dependent class/finance records, ABORT and review first.
begin;

do $$
begin
 if exists(select 1 from public.schedule_events where enrollment_id in
   ('9e500000-0000-4000-8000-000000000001','9e500000-0000-4000-8000-000000000002')
   or trainer_id in ('9e200000-0000-4000-8000-000000000001','9e200000-0000-4000-8000-000000000002')
   or student_id in ('9e400000-0000-4000-8000-000000000001','9e400000-0000-4000-8000-000000000002')) then
   raise exception 'QA classes exist. Do not delete attendance, earnings or linked history automatically.';
 end if;
 if exists(select 1 from public.session_records where enrollment_id in
   ('9e500000-0000-4000-8000-000000000001','9e500000-0000-4000-8000-000000000002')) then
   raise exception 'QA session records exist; manual review required.';
 end if;
 if exists(select 1 from public.student_fee_packages where student_id in
   ('9e400000-0000-4000-8000-000000000001','9e400000-0000-4000-8000-000000000002')) then
   raise exception 'QA fee package exists; manual review required.';
 end if;
end $$;

delete from public.enrollments where id in
 ('9e500000-0000-4000-8000-000000000001','9e500000-0000-4000-8000-000000000002');
delete from public.parent_students where
 (parent_id='9e300000-0000-4000-8000-000000000001' and student_id='9e400000-0000-4000-8000-000000000001')
 or (parent_id='9e300000-0000-4000-8000-000000000002' and student_id='9e400000-0000-4000-8000-000000000002');
delete from public.student_guardians where student_id in
 ('9e400000-0000-4000-8000-000000000001','9e400000-0000-4000-8000-000000000002');
delete from public.students where id in
 ('9e400000-0000-4000-8000-000000000001','9e400000-0000-4000-8000-000000000002');
delete from public.parents where id in
 ('9e300000-0000-4000-8000-000000000001','9e300000-0000-4000-8000-000000000002');
delete from public.trainer_courses where
 trainer_id in ('9e200000-0000-4000-8000-000000000001','9e200000-0000-4000-8000-000000000002')
 and course_id='9e100000-0000-4000-8000-000000000001';
delete from public.trainers where id in
 ('9e200000-0000-4000-8000-000000000001','9e200000-0000-4000-8000-000000000002');
delete from public.courses where id='9e100000-0000-4000-8000-000000000001';

commit;

-- All six counts must be zero. QA Auth users/profiles remain intentionally.
select
 (select count(*) from public.courses where id='9e100000-0000-4000-8000-000000000001') qa_courses,
 (select count(*) from public.trainers where id in ('9e200000-0000-4000-8000-000000000001','9e200000-0000-4000-8000-000000000002')) qa_trainers,
 (select count(*) from public.parents where id in ('9e300000-0000-4000-8000-000000000001','9e300000-0000-4000-8000-000000000002')) qa_parents,
 (select count(*) from public.students where id in ('9e400000-0000-4000-8000-000000000001','9e400000-0000-4000-8000-000000000002')) qa_students,
 (select count(*) from public.parent_students where parent_id in ('9e300000-0000-4000-8000-000000000001','9e300000-0000-4000-8000-000000000002')) qa_links,
 (select count(*) from public.enrollments where id in ('9e500000-0000-4000-8000-000000000001','9e500000-0000-4000-8000-000000000002')) qa_enrollments;
