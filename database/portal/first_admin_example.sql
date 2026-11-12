-- OPTIONAL FIRST REAL ADMIN BOOTSTRAP (NOT PART OF THE EIGHT-USER DEV QA SETUP).
-- Use only with explicit authorization after creating the real Admin Auth account.
-- See database/01_install/README.md. Never run unchanged with placeholder email.

-- Robotronix Learning Portal — bootstrap the first administrator
-- Run only after the administrator has signed in once so an auth.users row exists.
-- Replace the email below with the real administrator's login email.

begin;

alter table public.profiles disable trigger protect_profile_privileges_trg;

insert into public.profiles(id,full_name,role,active)
select id, coalesce(raw_user_meta_data->>'full_name', email), 'admin', true
from auth.users
where email = 'ADMIN_EMAIL_HERE'
on conflict(id) do update set role='admin', active=true, updated_at=now();

alter table public.profiles enable trigger protect_profile_privileges_trg;

commit;
