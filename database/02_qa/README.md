# DEV QA data — RUN IN THIS ORDER

**Prerequisite:** production-equivalent DEV schema/reference data installed and `database/03_verify/01_VERIFY_RELEASE.sql` completed. These scripts are for a **dedicated DEV database with synthetic records only**.

## First create/reuse eight confirmed Supabase Auth users

| Email | Role | Scenario |
| --- | --- | --- |
| qa-admin@robotronix.local | admin | Admin 1 |
| qa-admin-2@robotronix.local | admin | Admin 2 |
| qa-trainer@robotronix.local | trainer | India robotics trainer |
| qa-trainer-2@robotronix.local | trainer | Python/cohort trainer |
| qa-parent@robotronix.local | parent | India family |
| qa-parent-us@robotronix.local | parent | US family |
| qa-student@robotronix.local | student | India learner login |
| qa-student-us@robotronix.local | student | US learner login |

**Authentication accounts are not created by SQL.** Create them in Supabase DEV Authentication → Users; use DEV-only passwords, confirm emails and reuse existing accounts rather than deleting/recreating them. `.local` addresses cannot receive real mail.

## Execute these three SQL files in DEV SQL Editor

1. **`01_PREPARE_DEV_QA_PROFILES.sql`** — verifies all eight Auth identities exist, creates/updates exactly eight linked `public.profiles` (2 of each role). Temporarily suspends the profile privilege guard **only inside its trusted DEV transaction**, restores before commit, and verifies mappings. **Skip if all eight profiles are already correct.**
2. **`02_RUN_DEV_QA_DATA.sql`** — requires the eight active role profiles and creates related business fixtures atomically. This **does not** create Auth users, update profiles or change RLS/triggers. Includes India/US families, siblings, trainers, 1:1 and cohort enrollments, past/upcoming/cancelled classes, attendance, feedback, projects, onboarding lifecycle, and USD fee-package setup.
3. **`03_VERIFY_DEV_QA.sql`** — read-only verification. Inspect all result sets and confirm the final assertions say **PASS**.

**Stop at the first SQL error.** The dataset transaction rolls back on error; don't run partial fragments or old seed scripts.

## From completely empty DEV

See `../README.md` for optional reset → generated schema install → schema verification → Auth → profiles → data → verification.

## After seeding

Set local `.env.local` to DEV (never commit credentials), run `npm ci` then `npm run dev`. Log in with Admin, Trainer, Parent and Student accounts. Verify calendars, IST/New York times, parent access to siblings, class completion, learner progress, earnings and invoices. Test actual Zoom and payment integrations separately with approved test credentials.

## Notes

- These fixtures contain **five or more learner records** and **eight login accounts**. The eight accounts are two each of Admin/Trainer/Parent/Student, not eight separate learners.
- Enrollment dates are based on **Asia/Kolkata** to match the start-date trigger.
- Fake successful payments, Zoom meetings, recordings, or actual customer data are **not** created.
- The fixture is representative, not exhaustive: real role permissions, timezone/DST boundaries, JIT Zoom, payment sandbox and notification delivery still require application QA.
- **Do not reset or reseed a DEV database that already passed verification** unless you intentionally want to rebuild it.
