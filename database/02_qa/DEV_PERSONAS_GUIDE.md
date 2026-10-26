# DEV QA — ONE-RUN SETUP (8 EXISTING USERS)

**Only for a dedicated synthetic DEV Supabase database. Never run on Production.**

## Current situation

You have already created 8 confirmed Auth identities in `auth.users` and corresponding role rows in `public.profiles`. **Do not recreate or delete them.** The consolidated SQL checks the exact email/UUID/profile/role mapping, then inserts the related test business data.

## Exactly TWO SQL files to run

1. `database/02_qa/00_RUN_DEV_QA_DATA.sql` — **one atomic transaction** populating baseline + extended QA scenarios. The script does not change `auth.users`, `public.profiles`, RLS or security triggers. If any required profile is missing or incorrectly assigned, it aborts without creating partial business fixtures.
2. `database/02_qa/01_VERIFY_DEV_QA.sql` — read-only checks. Inspect the last result table for PASS/FAIL and review earlier result sets.

**Do not run** `01_QA_SEED.sql`, `02_QA_CLEANUP.sql`, old `03_DEV_PERSONAS.sql`, any production-security fixture, the schema reset, or the fresh installer for this workflow.

## Auth/Profile prerequisite

| Email | Expected role |
| --- | --- |
| qa-admin@robotronix.local | admin |
| qa-admin-2@robotronix.local | admin |
| qa-trainer@robotronix.local | trainer |
| qa-trainer-2@robotronix.local | trainer |
| qa-parent@robotronix.local | parent |
| qa-parent-us@robotronix.local | parent |
| qa-student@robotronix.local | student |
| qa-student-us@robotronix.local | student |

The Auth UUID must be the same as the profile ID. Profiles must be active.

## Covered QA workflows

- Two Admins, two Trainers, two Parents and two login-enabled Students.
- Delhi family, New York family, linked siblings, and learners without individual login.
- Robotics and Python courses; 1:1 and two-learner cohort.
- Trainer availability, future and conducted class records, cancelled class, on-hold enrollment.
- Attendance: attended, late and absent; project submitted/completed; learner feedback and milestone.
- Onboarding: new, setup-pending, activated; admin notification trigger exercised.
- USD fee package only; no fake successful payments or external invoices.
- New York Friday 9 AM class (IST evening) and Saturday 7:30 PM IST cohort.
- No fake Zoom provider meetings, recordings, or live Zoom authorization.

The synthetic dates are relative to execution day **in Asia/Kolkata**, matching the database enrollment start-date validation trigger (rather than session-dependent `CURRENT_DATE`). The fixtures are **not** a substitute for end-to-end QA of Zoom, Razorpay test transactions, notifications, trainer payouts, row-level access, DST and cross-midnight scheduling.

## Directory purpose

- `database/01_install/modules/{schema,reference}` — **required** for generating the fresh installer. Not obsolete. Do not delete.
- `database/generated/ROBOTRONIX_FRESH_INSTALL.sql` — generated installer, for **empty** databases only.
- `database/01_install/03_BOOTSTRAP_FIRST_ADMIN_EXAMPLE.sql` — first-Admin bootstrap example, not part of QA fixture run.
- `database/02_qa/00_RUN_DEV_QA_DATA.sql` and `01_VERIFY_DEV_QA.sql` — **current DEV dataset**.
- `database/02_qa/01_QA_SEED.sql` and `02_QA_CLEANUP.sql` — **legacy four-account automation fixtures** retained because release checks and older Playwright flows depend on them; not part of current eight-account workflow. Cleanup is incomplete for the extended dataset: **never use it to clean the new fixture**.
- `database/security_qa/` — separate authorized production-security testing fixtures; never use for DEV persona setup.
- `database/03_verify/01_VERIFY_RELEASE.sql` — read-only schema/release verification, separate from persona verification.
- `database/99_dev_tools/` — destructive reset utilities; never use for routine QA.
- `database/archive/legacy/` — retained historical SQL; never run directly on a populated database.

## Execution

Open the first file in VS Code, copy the entire SQL into **Supabase DEV → SQL Editor**, and execute it. On success, execute the second file and inspect PASS/FAIL rows. If either fails, stop and share the **first SQL error**. The main data script runs in a transaction, so an error before `COMMIT` rolls back its changes; there is no need to manually delete partially inserted fixture rows. Do not disable RLS, permanently disable security triggers, reinstall the schema, or remove Auth users.

## Important

This script was assembled and checked against the branch's canonical schema definitions. It **has not been executed against your live DEV database**. The first real SQL execution and verification are still required.
