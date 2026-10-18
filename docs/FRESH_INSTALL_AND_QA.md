# CURRENT DATABASE WORKFLOW — READ FIRST

**Both Dev and Production already received 01_CREATE_SCHEMA.sql and 02_INSERT_MASTER_REFERENCE_DATA.sql. Do not rerun them or run the historical upgrade scripts merely because they exist.**

**Production:** Real Admin profile is verified with role=admin and active=true. Do not seed synthetic QA fixtures into production until isolation from reports, Zoom, Razorpay, and messaging has been validated.

**Development:** Four existing Auth identities (qa-admin@robotronix.local, qa-trainer@robotronix.local, qa-parent@robotronix.local, qa-student@robotronix.local) have NULL profiles. After verifying the Auth identities belong to this Dev project, run `database/02_qa/01_QA_SEED.sql` in Dev only to assign roles and create fixtures; review its full contents before executing. Then run `database/03_verify/01_VERIFY_RELEASE.sql` and the role/workflow tests.

**Active database files:**
- `01_install/01_CREATE_SCHEMA.sql` — new empty application database only
- `01_install/02_INSERT_MASTER_REFERENCE_DATA.sql` — new installation master data
- `01_install/03_BOOTSTRAP_FIRST_ADMIN_EXAMPLE.sql` — only for a real Admin Auth identity, when missing a profile
- `02_qa/01_QA_SEED.sql` — Dev QA fixtures only, after QA Auth identities exist
- `02_qa/02_QA_CLEANUP.sql` — Dev QA cleanup only, never production
- `03_verify/01_VERIFY_RELEASE.sql` — read-only checks, run in Dev and Production

**Historical files:** `04_upgrade/` is migration history for older installations; do not rerun after fresh installation. Obsolete temporary production sanity seeds, the old fixed-email production QA seed, and the destructive Dev schema reset were moved out of active folders to `database/archive/legacy/` for auditability. They are not part of the current workflow.

**Permanent production QA:** The supported candidate process uses `npm run qa:prod-permanent:create-users` and `npm run qa:prod-permanent:generate-sql`, which generate a local, ignored QA SQL seed from separately controlled addresses. Do not execute this in production until QA isolation and full release validation pass.

---

# Robotronix™ Learning Portal — Fresh installation and permanent QA

**Status: candidate, not yet database-validated.** Do not reset production until a full clean-install rehearsal, QA tests, and a verified backup are complete.

## Database installation (empty Supabase project only)
1. Open `database/01_install/01_CREATE_SCHEMA.sql` in the Supabase SQL Editor. This includes original schema plus six integrated upgrades. Run only on a clean application schema.
2. Run `database/01_install/02_INSERT_MASTER_REFERENCE_DATA.sql`.
3. Bootstrap the **real** Admin separately via Supabase Auth and `database/01_install/03_BOOTSTRAP_FIRST_ADMIN_EXAMPLE.sql` (replace placeholder). NEVER replace the real Admin with a test account.
4. Run `database/03_verify/01_VERIFY_RELEASE.sql` plus check for Zoom exclusion constraint, Razorpay webhook events, calendar token table and Zoom recording tables.
5. Run `npm run check:release`, `npm run build` and `npm run qa:prod-gate` with credentials for the isolated test environment before production.

**Do not execute** `database/99_dev_tools/00_DEV_ONLY_RESET_PUBLIC_SCHEMA.sql` against the live project. Portal schema reset must be explicitly planned; it does not clear all Supabase Auth users, storage or external providers. Back up first.

The `database/04_upgrade/` scripts are retained as historical upgrades for *existing* installs only; do NOT run them after the complete fresh-install schema. `01_ZOOM_CLASSROOM_V1.sql` historically permits only class/poc/general and will reject existing demo meetings; the consolidated installer permits demo from the start.

## Four long-lived production QA users

There are FOUR dedicated QA identities: Admin, Trainer, Parent, Student; the real Admin is a fifth, separate Auth user.

1. Copy `.env.portal-qa.example` to `.env.portal-qa.local`, configure the exact four **different email addresses you control**, strong unique passwords and production Supabase URL/service-role key. **Never commit or post the secrets.**
2. Run `npm run qa:prod-permanent:create-users`. The script refuses to overwrite pre-existing identities without its permanent QA tag.
3. Run `npm run qa:prod-permanent:generate-sql`. This writes a **gitignored** file: `database/02_qa/04_GENERATED_LOCAL_PROD_QA_SEED.sql`, customized with the four private addresses.
4. Inspect the generated SQL carefully; it creates synthetic profiles and a synthetic Parent/Student/Trainer enrollment, classes and a sample international billing package. Run only after a successful clean-install rehearsal, and before real business use. Do not trigger real Razorpay invoices or Zoom meeting creations with synthetic fixtures.
5. DO NOT run `sanity:delete-users` or `02_PROD_SANITY_CLEANUP.sql` on permanent fixtures without examining the records they would affect.

The existing Playwright QA suite expects deterministic IDs and may need environment-specific configuration before testing against production. QA fixtures must be excluded from commercial reporting before enabling normal operations; this exclusion is a required future gate, **not yet confirmed by these scripts**.

## Documentation policy
- This file is the authoritative *new installation guide*.
- `database/README_DATABASE_v1.0.0.md` and older dated root release guides describe earlier release stages; retain as history until references and tests have been audited.
- In `database/04_upgrade`, keep migrations for traceability; new schema changes require both a numbered upgrade migration and fresh-schema reconciliation.

## Production release gate
A clean Supabase installation, real Admin login, all four QA logins, role permissions, enrollment-to-class-to-progress workflow, Zoom host scheduling, Supabase Realtime and Razorpay sandbox scenarios must be verified before resetting or publishing.
