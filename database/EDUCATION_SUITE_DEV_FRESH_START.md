# Robotronix Education Suite — DEV fresh-start workflow (UNTESTED BUNDLE)

**Status: review/certification pending. Do not run against populated DEV or production.**

The current canonical Academy/CRM/Tasks installer is generated using:
`npm run db:build-installers`.

The additional generator `node scripts/build-education-suite-installer.mjs` then assembles:
`database/generated/ROBOTRONIX_EDUCATION_SUITE_FRESH_INSTALL_UNCERTIFIED.sql`.
It includes the canonical full-suite installer, SaaS SQL files 01–58, and Milestone A/B migrations in explicit order. **Concatenation is not proof it executes successfully on a clean instance**. The bundle must pass an isolated fresh-database run, schema/RLS verification, and all role login journeys before it is certified. Generated SQL is not committed.

## Intended sequence for a disposable DEV environment only

1. Confirm the DEV project reference is `uzzuquxeeqonxeqcuohh`. Never use PROD `njyktzenybimykpqaegn`. Back up data and stop external workers.
2. Review `database/01_reset/01_dev_reset.sql`. This removes **all** application data in public, saas, connect, tasks, ai and operations, and unschedules cron jobs. Explicitly edit its confirmation token to run. It does **not** reset Auth or Storage and may also remove unrelated public-schema objects. Prefer a brand-new Supabase test project for installer certification.
3. Review Auth users with `node scripts/reset-dev-auth-users.mjs` (dry run); set `ROBOTRONIX_DEV_PROJECT_REF=uzzuquxeeqonxeqcuohh` in the environment along with DEV URL and service-role key. After application schemas are removed and dependencies checked, execute deletion with `CONFIRM_DELETE_ALL_DEV_AUTH=DELETE_ALL_DEV_AUTH_USERS` and `node scripts/reset-dev-auth-users.mjs --delete-dev-auth`. This uses the Supabase Admin API, not direct deletion from auth tables.
4. Build installer: `node scripts/build-education-suite-installer.mjs`. Review bundle sections and execute **once on an empty isolated DEV project**, after resolving installer incompatibilities.
5. Read-only QA: `database/portal/verify.sql`, `database/tasks/04_verify.sql`, `database/crm/04_verify.sql`, plus `qa/sql/milestone-c-phase12-readiness.sql` and isolation rollback checks. An empty install must pass before reuse.
6. Use `npm run qa:create-users` for legacy admin/trainer/parent/student Auth test identities (passwords via `QA_*_PASSWORD` environment variables); create an SaaS owner through `/signup` and `/onboarding/organization`, select apps on `/onboarding/products`, then invite Admin/Trainer/Parent through the actual app and test access isolation. Role assignments **must** be created by the application's tenancy-aware membership/invitation APIs, not by setting user_metadata in Auth.
7. For two-academy certification, register a second owner and organization, add invited memberships, and repeat cross-tenant denial tests. Test Student account via existing onboarding/invitation mechanism.
8. Configure auth redirects, site URL, environment variables, Google OAuth, Zoom, payment integrations and schedulers separately. SQL does not set these up.

**Do not execute the reset or bundle as an automatic CI job.** Do not hand-edit Auth schema or insert users directly through SQL.

## Known gaps

- The assembled new Education Suite bundle is **not clean-install certified**, and may require dependency reordering or source refactoring. The existing `database/packages.json` still marks packages as static-validation-only.
- Test user creation exists but full role-to-organization fixtures are not yet a self-contained one-run installer. Some roles require real invitations and application-specific profile records.
- Supabase Auth/Storage/project settings are managed separately. Supabase Auth account deletion may fail when external references remain, and must never be forced by disabling constraints.
