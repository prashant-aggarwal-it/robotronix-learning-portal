# Database installation and Dev QA — active procedure

[← Documentation Hub](README.md) | [Environment setup](ENVIRONMENTS.md) | [Testing](TESTING.md)

## Current project state

- Schema and reference data were previously installed in both Dev and Production Supabase.
- Production's real Admin profile was verified active.
- Development QA fixtures were used for successfully reported local authentication/role/workflow tests on 2026-10-19.
- New repo commits and a passing local build **do not imply** any new Production SQL should be run.

## Current SQL files

| File | Action |
| --- | --- |
| `database/01_install/01_CREATE_SCHEMA.sql` | Fresh **empty project only**. Includes previously separate Zoom, Razorpay, demo, calendar, live-data, host constraints. |
| `database/01_install/02_INSERT_MASTER_REFERENCE_DATA.sql` | Initial configuration/catalog/reference data. |
| `database/01_install/03_BOOTSTRAP_FIRST_ADMIN_EXAMPLE.sql` | Edit intentionally for an Admin who is missing a profile; existing Production Admin needs no action. |
| `database/02_qa/01_QA_SEED.sql` | Development only; creates synthetic QA profiles/fixtures for four precreated Auth users. |
| `database/02_qa/02_QA_CLEANUP.sql` | Development only; removes synthetic QA fixtures. |
| `database/03_verify/01_VERIFY_RELEASE.sql` | Verification; examine results in both environments as appropriate. |
| `database/99_dev_tools/00_DEV_ONLY_RESET_PUBLIC_SCHEMA.sql` | Destructive; only on deliberately disposable Development databases after review. |

The six former `database/04_upgrade` migrations are consolidated and removed. Files in `database/archive/legacy` are **historical** and must not be used to provision test users in Production.

## New empty database procedure

1. Create a new separate Supabase project and verify you are connected to the correct one.
2. Run `npm run db:build-fresh-install` from the repository root, then execute the entire `database/generated/ROBOTRONIX_FRESH_INSTALL.sql` file once in the Supabase SQL editor. Do not also run the two source SQL files.
3. Configure Supabase Authentication Google provider and callbacks.
4. Bootstrap first real Admin only if the intended Auth identity has no Admin profile.
5. Run `03_verify/01_VERIFY_RELEASE.sql` and inspect results.

## Development QA

1. Use the four DEV users `qa-admin@robotronix.local`, `qa-trainer@robotronix.local`, `qa-parent@robotronix.local`, `qa-student@robotronix.local`.
2. Create Auth identities using `npm run qa:create-users` if they are not already present. Store credentials privately.
3. Run `database/02_qa/01_QA_SEED.sql` in **Dev only**, then verify all four profiles are active and correctly assigned.
4. Run `npm run check:release`, `npm run build`, `npm run qa:auth-check`, `npm run qa:roles`, `npm run qa:workflow`.
5. Do not delete the fixtures if ongoing QA depends on them; cleanup is optional and Dev only.

## Optional Production QA accounts

Permanent production QA accounts are **not required** for this release. The repository includes optional `.env.portal-qa.example` and `qa:prod-permanent:*` tools. They must not be used for live test data until finance, notifications, Zoom and external provider side effects have been safely isolated. Keep the existing real Admin separate.

## Strong safety boundaries

- **Never rerun the fresh installer** against the existing Production database.
- **Never run Dev reset or QA seed in Production.**
- Do not disable RLS/constraints to bypass a QA failure.
- Do not follow dated or archived release runbooks for current database steps.
