-- Robotronix controlled production security QA fixtures.
-- Read 03_PROD_SECURITY_QA_README.md first. Do NOT run old QA seed on prod.
-- No profile updates, trigger disabling or RLS changes.
begin;

do $$
declare bad text;
begin
 select string_agg(x.email, ', ') into bad
 from (values
  ('qa-sec-admin@robotronixstemlab.com','admin'),
  ('qa-sec-trainer-a@robotronixstemlab.com','trainer'),
  ('qa-sec-trainer-b@robotronixstemlab.com','trainer'),
  ('qa-sec-parent-a@robotronixstemlab.com','parent'),
  ('qa-sec-parent-b@robotronixstemlab.com','parent'),
  ('qa-sec-student-a@robotronixstemlab.com','student'),
  ('qa-sec-student-b@robotronixstemlab.com','student')
 ) as x(email,role)
 left join auth.users u on lower(u.email)=x.email
 left join public.profiles p on p.id=u.id
 where u.id is null or p.id is null or p.role<>x.role or p.active is distinct from true;
 if bad is not null then raise exception 'Missing/wrong QA Auth profiles: %',bad; end if;
 if exists(select 1 from public.courses where id='9e100000-0000-4000-8000-000000000001' or slug='qa-security-isolation-2026' or code='QA-SEC-2026')
 or exists(select 1 from public.trainers where id in ('9e200000-0000-4000-8000-000000000001','9e200000-0000-4000-8000-000000000002'))
 or exists(select 1 from public.parents where id in ('9e300000-0000-4000-8000-000000000001','9e300000-0000-4000-8000-000000000002'))
 or exists(select 1 from public.students where id in ('9e400000-0000-4000-8000-000000000001','9e400000-0000-4000-8000-000000000002'))
 or exists(select 1 from public.enrollments where id in ('9e500000-0000-4000-8000-000000000001','9e500000-0000-4000-8000-000000000002'))
 then raise exception 'Security QA fixtures already exist: aborting without overwrite'; end if;
end $$;

insert into public.courses
 (id,slug,title,short_title,code,category,grade_from,grade_to,age_from,age_to,level,total_sessions,session_duration,planned_hours,status)
values ('9e100000-0000-4000-8000-000000000001','qa-security-isolation-2026','QA Security Isolation Course','QA Security','QA-SEC-2026','Robotics',5,8,10,14,'Beginner',8,60,8,'active');

insert into public.trainers
 (id,profile_id,full_name,email,record_status,login_linked,city,timezone)
select x.id,u.id,x.name,x.email,'active',true,'Delhi','Asia/Kolkata'
from (values
 ('9e200000-0000-4000-8000-000000000001'::uuid,'QA Security Trainer A','qa-sec-trainer-a@robotronixstemlab.com'),
 ('9e200000-0000-4000-8000-000000000002'::uuid,'QA Security Trainer B','qa-sec-trainer-b@robotronixstemlab.com')
) as x(id,name,email) join auth.users u on lower(u.email)=x.email;

insert into public.trainer_courses(trainer_id,course_id) values
 ('9e200000-0000-4000-8000-000000000001','9e100000-0000-4000-8000-000000000001'),
 ('9e200000-0000-4000-8000-000000000002','9e100000-0000-4000-8000-000000000001');

insert into public.parents(id,profile_id)
select x.id,u.id from (values
 ('9e300000-0000-4000-8000-000000000001'::uuid,'qa-sec-parent-a@robotronixstemlab.com'),
 ('9e300000-0000-4000-8000-000000000002'::uuid,'qa-sec-parent-b@robotronixstemlab.com')
) as x(id,email) join auth.users u on lower(u.email)=x.email;

insert into public.students
 (id,profile_id,full_name,dob,grade,school,city,state,country,timezone,record_status)
select x.id,u.id,x.name,date '2014-01-01','Grade 6','QA Synthetic School','Delhi','Delhi','India','Asia/Kolkata','active'
from (values
 ('9e400000-0000-4000-8000-000000000001'::uuid,'QA Security Learner A','qa-sec-student-a@robotronixstemlab.com'),
 ('9e400000-0000-4000-8000-000000000002'::uuid,'QA Security Learner B','qa-sec-student-b@robotronixstemlab.com')
) as x(id,name,email) join auth.users u on lower(u.email)=x.email;

insert into public.student_guardians
 (student_id,primary_contact,primary_guardian_name,primary_guardian_relationship,parent_login_email)
values
 ('9e400000-0000-4000-8000-000000000001','guardian','QA Guardian A','guardian','qa-sec-parent-a@robotronixstemlab.com'),
 ('9e400000-0000-4000-8000-000000000002','guardian','QA Guardian B','guardian','qa-sec-parent-b@robotronixstemlab.com');

insert into public.parent_students(parent_id,student_id,relationship_label) values
 ('9e300000-0000-4000-8000-000000000001','9e400000-0000-4000-8000-000000000001','Parent'),
 ('9e300000-0000-4000-8000-000000000002','9e400000-0000-4000-8000-000000000002','Parent');

insert into public.enrollments
 (id,student_id,course_id,trainer_id,enrollment_type,cohort_id,status,started_at,schedule_timezone,schedule_rules,delivery_channel,center_location,schedule_mode)
values
 ('9e500000-0000-4000-8000-000000000001','9e400000-0000-4000-8000-000000000001','9e100000-0000-4000-8000-000000000001','9e200000-0000-4000-8000-000000000001','one_to_one',null,'active',(now() at time zone 'Asia/Kolkata')::date,'Asia/Kolkata','[]'::jsonb,'online','','recurring'),
 ('9e500000-0000-4000-8000-000000000002','9e400000-0000-4000-8000-000000000002','9e100000-0000-4000-8000-000000000001','9e200000-0000-4000-8000-000000000002','one_to_one',null,'active',(now() at time zone 'Asia/Kolkata')::date,'Asia/Kolkata','[]'::jsonb,'online','','recurring');

commit;

-- Expected counts: 1 course, 2 trainers, 2 parents, 2 students, 2 links, 2 enrollments.
select
 (select count(*) from public.courses where id='9e100000-0000-4000-8000-000000000001') qa_courses,
 (select count(*) from public.trainers where id in ('9e200000-0000-4000-8000-000000000001','9e200000-0000-4000-8000-000000000002')) qa_trainers,
 (select count(*) from public.parents where id in ('9e300000-0000-4000-8000-000000000001','9e300000-0000-4000-8000-000000000002')) qa_parents,
 (select count(*) from public.students where id in ('9e400000-0000-4000-8000-000000000001','9e400000-0000-4000-8000-000000000002')) qa_students,
 (select count(*) from public.parent_students where parent_id in ('9e300000-0000-4000-8000-000000000001','9e300000-0000-4000-8000-000000000002')) qa_links,
 (select count(*) from public.enrollments where id in ('9e500000-0000-4000-8000-000000000001','9e500000-0000-4000-8000-000000000002')) qa_enrollments;
