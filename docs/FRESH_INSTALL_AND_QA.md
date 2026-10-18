# Robotronix database — active workflow

**Current state:** Both Dev and Production have run `01_CREATE_SCHEMA.sql` and `02_INSERT_MASTER_REFERENCE_DATA.sql`. Production's real Admin profile is verified as active. Dev has four QA Auth identities but no profiles yet.

## Files you may use

1. `database/01_install/01_CREATE_SCHEMA.sql` — fresh empty installation only. Includes Zoom, Razorpay, calendar, demo, live-data and Zoom host allocation changes. Do not rerun on the installed databases.
2. `database/01_install/02_INSERT_MASTER_REFERENCE_DATA.sql` — reference data for a new installation. Already run.
3. `database/01_install/03_BOOTSTRAP_FIRST_ADMIN_EXAMPLE.sql` — only when a real Admin Auth user lacks a profile; Production is already done.
4. `database/02_qa/01_QA_SEED.sql` — Dev only, after four QA Auth users exist; creates QA profiles and fixtures.
5. `database/02_qa/02_QA_CLEANUP.sql` — Dev only, removes QA fixtures.
6. `database/03_verify/01_VERIFY_RELEASE.sql` — read-only verification in Dev and Production.
7. `database/99_dev_tools/00_DEV_ONLY_RESET_PUBLIC_SCHEMA.sql` — destructive **Dev only** full public-schema reset. Not safe for production or Supabase-managed dependencies without review.

## Removed obsolete files

The six `database/04_upgrade/` scripts were already integrated into the fresh schema and are removed from the active branch. Git history retains them. Legacy production sanity seeds and old fixed-address permanent QA seeds are not active. Do not run any archived SQL.

## Next step

Run `database/02_qa/01_QA_SEED.sql` **in Dev only**, then check QA profiles and execute role/workflow tests. Do not insert QA fixtures in production yet.

## Permanent production QA

Candidate tooling: `npm run qa:prod-permanent:create-users` and `npm run qa:prod-permanent:generate-sql`. Generated SQL is ignored by Git. Do not deploy these fixtures until tests demonstrate isolation from customer reporting, Zoom, Razorpay, and messaging. Real Admin remains a separate identity.
