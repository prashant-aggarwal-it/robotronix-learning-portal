# Robotronix DEV database — complete setup and QA runbook

**Use only the dedicated DEV Supabase project. Never run the DEV reset, profile bootstrap or QA data scripts in Production.** The current QA branch is `fix/qa-onboarding-save-feedback-20261025`.

There are **two distinct stages**: (A) install the real production-equivalent **schema and reference data**, then (B) add **synthetic production-like QA users and business data**. Real client data must not be copied into DEV.

## Which path should I use?

- **Already installed and both QA scripts succeeded?** **Do not reset or rerun.** Start the application and verify role-by-role. Reseed only when you intentionally need fresh test data.
- **Brand-new empty DEV project?** Follow A1 below.
- **Want to wipe existing DEV public tables and start over?** Back up any data first, verify the exact DEV project ID, then use the optional destructive A2 reset. This does **not** remove Supabase `auth.users` accounts, credentials, or storage schemas. The database may contain unrelated public-schema data: all of it will be destroyed.
- **Schema already exists but business QA data is missing?** Skip A and go to B.

## A — Install the real schema and master reference data

### A1. Fresh, empty Supabase project

1. `git switch fix/qa-onboarding-save-feedback-20261025` and `git pull --ff-only origin fix/qa-onboarding-save-feedback-20261025`.
2. `npm ci`.
3. `npm run db:build-fresh-install` (reads **11 ordered schema** and **4 reference** modules).
4. In **Supabase DEV → SQL Editor**, run the complete generated `database/generated/ROBOTRONIX_FRESH_INSTALL.sql` **once**. It installs the real tables, RLS, triggers, policies, functions and master catalogue. Do not run its individual modules manually.
5. Run read-only `database/03_verify/01_VERIFY_RELEASE.sql`. Check all statements executed without errors; Supabase may show only the final result set.

### A2. Optional: fully reset an EXISTING DEV public schema (DESTRUCTIVE)

**Not needed after a successful setup.** Only with explicit intent to lose every `public` table and row:

1. Back up any DEV records you want to keep and double-check the DEV project reference/URL.
2. Run `database/99_dev_tools/00_DEV_ONLY_RESET_PUBLIC_SCHEMA.sql`. This **drops `public` with CASCADE** and recreates it. It does **not** remove `auth.users`; Auth identities remain but their `public.profiles` are gone. Do not use this on PROD or a shared database.
3. Run steps A1.3–A1.5 to reinstall the real schema and reference data.
4. Continue with B; reuse existing Auth identities if they still exist.

**Do not run** `database/01_install/03_BOOTSTRAP_FIRST_ADMIN_EXAMPLE.sql` for the eight-account QA flow: step B2 sets the QA Admin roles. That example is for a separate real first-admin bootstrap after an Auth identity exists.

## B — Create synthetic production-like QA users and linked data

### B1. Supabase Auth accounts (manual; not created by SQL)

In **DEV → Authentication → Users**, create/confirm each of these accounts (or reuse existing accounts). Use unique DEV-only passwords; never save passwords in SQL or GitHub.

| Email | Role | Persona |
| --- | --- | --- |
| qa-admin@robotronix.local | admin | QA Admin One |
| qa-admin-2@robotronix.local | admin | QA Admin Two |
| qa-trainer@robotronix.local | trainer | Rajesh Sharma |
| qa-trainer-2@robotronix.local | trainer | Meera Iyer |
| qa-parent@robotronix.local | parent | Neha Sharma, India |
| qa-parent-us@robotronix.local | parent | Olivia Patel, USA |
| qa-student@robotronix.local | student | QA Indian Student |
| qa-student-us@robotronix.local | student | Mia Patel, USA |

Use email confirmation in Auth. These `.local` test addresses are **not real inboxes**; use your own test inboxes separately for actual email delivery/invitation testing.

### B2. Profiles (8 users / 4 roles)

Run `database/02_qa/00_PREPARE_DEV_QA_PROFILES.sql` in the DEV SQL Editor.

- Creates or updates **exactly eight `public.profiles` rows** linked to the actual Auth UUIDs.
- Assigns 2 Admin, 2 Trainer, 2 Parent, 2 Student roles.
- Does not create Auth accounts or reset passwords.
- Temporarily suspends the profile privilege guard **within a trusted DEV-only transaction**, restores it before commit, then verifies all eight profiles.
- Can be rerun for the same eight QA identities; do not use it for actual customer accounts or in production.
- If all eight profiles are already correct, **skip this step**.

### B3. Linked operational dataset

Run `database/02_qa/00_RUN_DEV_QA_DATA.sql` in DEV.

- Requires all eight Auth accounts **and** eight correctly assigned active profiles. It **does not create profiles**.
- Populates baseline + extended QA data in a single transaction: two trainer business records, two parent records, several linked students, India/USA families, 1:1 and group enrollments, cohort, trainer availability, class schedule, late/attended/absent attendance, feedback, projects, onboarding lifecycle and a USD fee package.
- Uses IST date for enrollment start-date validation.
- No actual Zoom meeting, Razorpay transaction or real customer record is fabricated.

### B4. Verify QA fixtures

Run read-only `database/02_qa/01_VERIFY_DEV_QA.sql`. Check each result set, particularly the final PASS/FAIL assertions. If a query fails, stop and share the first error. Do not rerun old separate seeds.

## Exact SQL execution order for a fully fresh DEV setup

| Order | SQL file | When |
| --- | --- | --- |
| 0 (optional) | `database/99_dev_tools/00_DEV_ONLY_RESET_PUBLIC_SCHEMA.sql` | **Only** when deliberately wiping existing DEV public data |
| 1 | `database/generated/ROBOTRONIX_FRESH_INSTALL.sql` | Fresh/empty public schema only; generate first |
| 2 | `database/03_verify/01_VERIFY_RELEASE.sql` | Verify real schema |
| 3 | **Create/reuse 8 Auth users in Supabase UI** | Not SQL |
| 4 | `database/02_qa/00_PREPARE_DEV_QA_PROFILES.sql` | Skip if all 8 profiles are already correct |
| 5 | `database/02_qa/00_RUN_DEV_QA_DATA.sql` | Populate linked synthetic business data |
| 6 | `database/02_qa/01_VERIFY_DEV_QA.sql` | Verify QA personas and relationships |

## Run the portal locally

Set `.env.local` to **DEV** Supabase URL, anon key and server-only service-role key; never commit secrets. Run `npm ci` (if needed) and `npm run dev`, then sign in with each role. Check Admin, Trainer, Parent and Student access, learner progress, cohorts, calendars, finance and notifications. Test real Zoom and payment flows separately using permitted sandbox/test configurations.

## What the other files are for (do not run in this sequence)

- `database/01_install/modules/schema/` (11) and `reference/` (4): **canonical ordered sources**, required by fresh installer.
- `database/01_install/03_BOOTSTRAP_FIRST_ADMIN_EXAMPLE.sql`: real first-admin example, not needed for QA identities.
- `database/02_qa/01_QA_SEED.sql` and `02_QA_CLEANUP.sql`: **legacy 4-account QA automation**; retained for existing test tooling, not for the new eight-account workflow.
- `database/security_qa/`: separate security testing fixtures, not normal DEV setup.
- `database/archive/legacy/`: historical reference; do not run on an existing database.
- `database/99_dev_tools/`: dangerous reset utilities; not normal setup.
- `database/generated/`: build output. Rebuild from canonical modules for a truly fresh install.

**Status:** This runbook reflects the checked-in scripts. It is not proof that a particular DEV project is correctly populated; rely on SQL verification and application QA.
