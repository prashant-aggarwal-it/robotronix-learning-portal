-- ROBOTRONIX DEV QA ONLY: CREATE/REPAIR 8 ROLE PROFILES
-- Run ONLY in your dedicated DEV Supabase project, as database owner, AFTER
-- creating the 8 confirmed identities in Authentication -> Users.
-- Does NOT create auth.users, reset passwords, delete users, or touch business records.
-- Safe to re-run for these exact QA accounts; DO NOT run in PROD.
-- This trusted DEV bootstrap temporarily suspends the privilege guard in
-- a transaction; it is restored before COMMIT.

BEGIN;

DO $$
DECLARE missing_users text;
BEGIN
 SELECT string_agg(e.email, ', ' ORDER BY e.email) INTO missing_users
 FROM (VALUES
   ('qa-admin@robotronix.local'),
   ('qa-admin-2@robotronix.local'),
   ('qa-trainer@robotronix.local'),
   ('qa-trainer-2@robotronix.local'),
   ('qa-parent@robotronix.local'),
   ('qa-parent-us@robotronix.local'),
   ('qa-student@robotronix.local'),
   ('qa-student-us@robotronix.local')
 ) e(email)
 LEFT JOIN auth.users u ON lower(u.email)=e.email
 WHERE u.id IS NULL;
 IF missing_users IS NOT NULL THEN
   RAISE EXCEPTION 'Create these Auth users in DEV first: %', missing_users;
 END IF;
END $$;

ALTER TABLE public.profiles DISABLE TRIGGER protect_profile_privileges_trg;

INSERT INTO public.profiles(id,full_name,role,active)
SELECT u.id,e.full_name,e.role,true
FROM (VALUES
 ('qa-admin@robotronix.local','QA Admin One','admin'),
 ('qa-admin-2@robotronix.local','QA Admin Two','admin'),
 ('qa-trainer@robotronix.local','Rajesh Sharma (QA Trainer)','trainer'),
 ('qa-trainer-2@robotronix.local','Meera Iyer (QA Trainer)','trainer'),
 ('qa-parent@robotronix.local','Neha Sharma (QA Parent)','parent'),
 ('qa-parent-us@robotronix.local','Olivia Patel (QA Parent)','parent'),
 ('qa-student@robotronix.local','QA Indian Student','student'),
 ('qa-student-us@robotronix.local','Mia Patel (QA Student)','student')
) e(email,full_name,role)
JOIN auth.users u ON lower(u.email)=e.email
ON CONFLICT(id) DO UPDATE SET
 full_name=excluded.full_name,role=excluded.role,active=true,updated_at=now();

ALTER TABLE public.profiles ENABLE TRIGGER protect_profile_privileges_trg;

DO $$
DECLARE incorrect integer;
BEGIN
 SELECT count(*) INTO incorrect
 FROM (VALUES
 ('qa-admin@robotronix.local','admin'),
 ('qa-admin-2@robotronix.local','admin'),
 ('qa-trainer@robotronix.local','trainer'),
 ('qa-trainer-2@robotronix.local','trainer'),
 ('qa-parent@robotronix.local','parent'),
 ('qa-parent-us@robotronix.local','parent'),
 ('qa-student@robotronix.local','student'),
 ('qa-student-us@robotronix.local','student')
 ) e(email,role)
 LEFT JOIN auth.users u ON lower(u.email)=e.email
 LEFT JOIN public.profiles p ON p.id=u.id
 WHERE u.id IS NULL OR p.id IS NULL OR p.role<>e.role OR p.active IS DISTINCT FROM true;
 IF incorrect<>0 THEN
  RAISE EXCEPTION 'QA profile verification failed for % account(s)',incorrect;
 END IF;
END $$;

COMMIT;

SELECT u.email,p.full_name,p.role,p.active,
 CASE WHEN p.id=u.id AND p.active THEN 'READY' ELSE 'CHECK' END AS status
FROM auth.users u
JOIN public.profiles p ON p.id=u.id
WHERE lower(u.email) IN (
 'qa-admin@robotronix.local','qa-admin-2@robotronix.local',
 'qa-trainer@robotronix.local','qa-trainer-2@robotronix.local',
 'qa-parent@robotronix.local','qa-parent-us@robotronix.local',
 'qa-student@robotronix.local','qa-student-us@robotronix.local'
)
ORDER BY p.role,u.email;
