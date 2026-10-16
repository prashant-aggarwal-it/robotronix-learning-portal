# Robotronix™ Learning Portal — Fresh Database Release

This package is prepared for a **new/empty Supabase database**. There is deliberately **no hotfix/patch folder**. All production schema fixes and pre-go-live features are consolidated in the main fresh-install schema.

## Fresh production database — run in this order

1. `database/01_install/01_CREATE_SCHEMA.sql`
2. `database/01_install/02_INSERT_MASTER_REFERENCE_DATA.sql`
3. Create the real first Admin user in Supabase Authentication, then use `database/01_install/03_BOOTSTRAP_FIRST_ADMIN_EXAMPLE.sql` after replacing its placeholder email.
4. `database/03_verify/01_VERIFY_RELEASE.sql`

Do **not** run the reset or QA/sanity fixtures as part of the permanent production install.

## Temporary production sanity users (optional, recommended before real data entry)

The production sanity fixture intentionally uses the same deterministic record IDs/labels expected by Playwright, but different temporary Auth emails.

1. Copy `.env.sanity.example` to `.env.sanity.local` and fill temporary strong passwords + SANITY_SUPABASE_* production keys. Keep this file private.
2. Run `npm run sanity:create-users`.
3. Run `database/02_sanity/01_PROD_SANITY_SEED.sql` in the production Supabase SQL Editor.
4. Ensure `.env.sanity.local` has `QA_BASE_URL=https://portal.robotronixstemlab.com` and `QA_NO_WEBSERVER=1`.
5. Run `npm run qa:prod-sanity`.
6. After manual sanity is complete, run `database/02_sanity/02_PROD_SANITY_CLEANUP.sql`.
7. Run `npm run sanity:delete-users`.
8. Delete `.env.sanity.local` or remove the temporary credentials from it.

The sanity cleanup does not delete real business data or connected Zoom host accounts.

## Development / QA only

- Dev reset: `database/99_dev_tools/00_DEV_ONLY_RESET_PUBLIC_SCHEMA.sql`
- Dev QA seed: `database/02_qa/01_QA_SEED.sql`
- Dev QA cleanup: `database/02_qa/02_QA_CLEANUP.sql`

Never run the Dev reset against a database containing data you want to keep.

## Consolidated features in `01_CREATE_SCHEMA.sql`

The fresh schema already includes the previously discovered production fixes and newer pre-go-live/Zoom foundations: enrollment schedule override fields, authenticated/RLS table grants, onboarding Admin notification trigger, active-student opening progress/migration fields, migrated finance support, private trainer/admin learning notes with RLS, and Zoom host/meeting foundation tables.
