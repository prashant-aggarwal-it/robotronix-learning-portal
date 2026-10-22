# Robotronix — Single-source fresh Supabase database installation

**Target:** NEW, EMPTY Supabase project only, for the consolidated release candidate. Database SQL is consolidated; this is not a claim that the new database or frontend has passed tests.

## Production SQL: one generated execution, one read-only verification

From the repository root, run `npm run db:build-fresh-install`. This validates
the canonical sources and produces **one** file:
`database/generated/ROBOTRONIX_FRESH_INSTALL.sql` (gitignored). Copy and run
the **entire generated file once** in the SQL Editor of a **new, empty**
Supabase project. It contains the schema followed by reference/config data,
in that order; do not also run the two source files separately.

Then run the read-only `database/03_verify/01_VERIFY_RELEASE.sql` to confirm
the installation. The first-admin bootstrap remains an optional, separately
reviewed identity action after the actual Auth user exists.

### Canonical sources (used by the generator)

1. **01_INSTALL_SCHEMA:** `database/01_install/01_CREATE_SCHEMA.sql` This includes all P1 notifications, P2/P3 Realtime publication, finance cutoff and payout snapshots, system logs/RLS, passwordless provisioning and retention functions. Former scripts 04–09 were integrated and removed.
2. **02_REFERENCE_DATA:** `database/01_install/02_INSERT_MASTER_REFERENCE_DATA.sql` This creates/loads countries, currencies, academic levels, courses and configuration.
3. **03_ADMIN_BOOTSTRAP (conditional):** Set up Google/SMTP Auth, create/sign in with the actual intended Admin email to establish an `auth.users` identity, then edit and run `database/01_install/03_BOOTSTRAP_FIRST_ADMIN_EXAMPLE.sql` **only if an Admin profile needs to be bootstrapped**. Replace the literal `ADMIN_EMAIL_HERE`. Never run this unedited or in a project with a verified existing Admin without reviewing the effect.

Then run the **read-only check** `database/03_verify/01_VERIFY_RELEASE.sql`. It is not an installation/migration step. Capture results and address all errors.

## Production rules
- **Do not run** `database/02_qa/01_QA_SEED.sql`, `02_QA_CLEANUP.sql`, anything in `99_dev_tools`, historical/archive SQL, or the read-only **existing database preflight** as an installation script.
- A NEW Supabase project has its own URL, publishable/anon key, service role key, Google OAuth/SMTP configuration, redirect URLs, Realtime, RLS, tables and Auth users. None of the old project's data, existing parent accounts, trainers, payments, Zoom host secrets, encrypted access tokens or history automatically transfers.
- **Fresh Production = empty operational data.** Before replacing an existing live project, decide whether historical learners, attendance, enrollments, finance/payroll, invoices, communication and identities must be migrated. If so, do not cut over to an empty DB until migration and reconciliation are designed and verified. Preserve the old production instance and backups.
- Environment variables in Netlify, the portal URL/OAuth callbacks, Zoom host connections and Razorpay/webhook endpoints must be reconfigured and verified separately. Do not copy secrets into GitHub.
- The old database remains untouched by GitHub commits. Nothing is applied merely by downloading this branch.
- A new Production DB should be used only **after the same consolidated installer and application have passed on a disposable fresh DEV DB**. Verify Google + email OTP, Trainer/Parent RLS, role workflows, Zoom and Razorpay, and the portal build.
- Do not merge/deploy this Draft release solely on the basis of a combined SQL file.

## Developer QA
Run `npm ci`, `npm run check:release`, `npm run build`, and configured Playwright QA against DEV. QA fixture scripts are intentionally kept separate. Keep SQL verification results and role-test evidence together with the exact Git commit.

## Consolidation verification (21 October 2026)
- The former `03_verify/02_POST_INSTALL_PAYROLL_POLICY_FIX.sql` and `03_verify/03_POST_INSTALL_AVAILABILITY_NOTIFICATIONS.sql` have been **removed** from the release branch as redundant existing-database patches.
- Their required logic is included in `01_install/01_CREATE_SCHEMA.sql`: scheduled-duration trainer payroll calculation, supported 15-minute actual teaching durations, and Admin notifications for trainer availability changes.
- `03_verify/01_VERIFY_RELEASE.sql` is the **only** verification SQL and is read-only.
- The release check rejects additional post-install verification SQL files, hotfix directories, or unexpected installer SQL. Historical archived QA seed scripts are not part of fresh installation and must never be run on production.
- GitHub release checks validate file structure, source code, and the application build; actual SQL execution and role workflows still require a separate DEV database.

## SQL inventory
- `01_install/01_CREATE_SCHEMA.sql`: the ONE canonical schema installer.
- `01_install/02_INSERT_MASTER_REFERENCE_DATA.sql`: the ONE canonical reference/config seed.
- `01_install/03_BOOTSTRAP_FIRST_ADMIN_EXAMPLE.sql`: optional privileged Admin bootstrap template.
- `03_verify/01_VERIFY_RELEASE.sql`: read-only schema verification.
- `02_qa/*`: developer fixtures only; never for Production.
- `99_dev_tools/*`: destructive DEV tools only; never for Production.

Two historical production-sanity seed/cleanup scripts were removed because no
current code or release workflow references them. The archived permanent QA
seed remains solely as input to `scripts/generate-permanent-qa-seed.mjs`;
it is **not** part of the install sequence.

**Historical incremental scripts 04–09 were deleted from this release branch after verifying their exact content is already included exactly once inside 01_CREATE_SCHEMA.sql.** The Git history retains them if they are ever needed to inspect an older installation; they should not be executed as part of this fresh install.
