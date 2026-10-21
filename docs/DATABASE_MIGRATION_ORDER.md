# Robotronix existing-database upgrade: explicit sequence and release gates

**Status 2026-10-21:** Draft implementation, **NOT yet confirmed compatible with the live DEV or Production database**. Do not execute in Production until preflight, backups, DEV validation and release approval. These filenames are the verified sequence in the consolidated release branch, not evidence that any script has been run.

## A. Existing DEVELOPMENT database — only after backups

0. Freeze testing writes, confirm this is your **DEV Supabase project**, and take a recoverable database backup. Check that the project has the baseline schema and that installed migration history hasn't already applied these changes. Never paste secrets or private bank details into issue comments.
1. Run `database/03_verify/02_PREFLIGHT_EXISTING_DATABASE.sql` (**read-only**). Retain output. If required objects are missing, stop and reconcile the baseline instead of continuing blindly. Review any approved/paid historical payroll before Step 5.
2. Apply `database/01_install/04_PRIORITY1_ACTION_NOTIFICATIONS.sql` — payout, progress, schedule and message action notifications. Preserve the existing onboarding Admin notification trigger.
3. Apply `database/01_install/05_P2_P3_REALTIME_PUBLICATION.sql` — required Supabase Realtime publication membership. Verify table-specific RLS first. This enables event delivery; role-specific UI must still be tested.
4. Apply `database/01_install/06_PORTAL_SYSTEM_LOGS.sql` — Admin-only operational error logs table and RLS.
5. Apply `database/01_install/07_TRAINER_PAYROLL_CUTOFF.sql` — effective-dated verified bank instructions and monthly payout locking. **HIGH RISK:** perform an isolated copy-of-data rehearsal and manually review existing finalized payouts before using any payment functions. This script changes a finance-review RPC and existing payout triggers.
6. Apply `database/01_install/08_PASSWORDLESS_PORTAL_ACCESS.sql` — pre-provisioned account status for Admin Grant Portal Access.
7. Apply `database/01_install/09_SYSTEM_LOG_RETENTION.sql` — restricted log purge function. **Does not schedule a cron job**. Do not activate scheduled deletion until retention policy is approved.
8. Run `database/03_verify/01_VERIFY_RELEASE.sql` and inspect every error and assertion. Verify under actual Admin/Trainer/Parent/Student users, not only Supabase service role.
9. Run code, QA and browser checks on the exact same commit: `npm ci`, `npm run check:release`, `npm run build`, `npm run qa:auth-check`, `npm run qa:roles`, `npm run qa:workflow`, and `npm run qa:stabilization`. Also verify sensitive finance, login, Zoom playback/delete and Realtime multi-session behavior manually.
10. If anything fails, **STOP**. Repair migrations and application together in DEV and repeat on a clean DB copy. Do not roll an incomplete database ahead of its application code.

## B. FRESH DEVELOPMENT database

Use the canonical fresh-install process: `database/01_install/01_CREATE_SCHEMA.sql`, then `02_INSERT_MASTER_REFERENCE_DATA.sql`, then the explicitly adapted first-Admin bootstrap instructions from `03_BOOTSTRAP_FIRST_ADMIN_EXAMPLE.sql`. The current canonical `01_CREATE_SCHEMA.sql` incorporates features from migrations **04–09**; **do not also run 04–09** after it. Finally run release verification and auth/role/workflow QA. This is not the upgrade path for an existing database.

## C. Existing PRODUCTION database

After DEV passes and an operator confirms Prod schema matches the rehearsed baseline:

1. Record exact release commit, Production backup/recovery point, approved maintenance/change window, operator and rollback/forward-fix plan.
2. Run the **read-only preflight** in Production; compare structure and historical approved/paid payroll counts to the DEV rehearsal. Stop on any mismatch.
3. Prepare a separate reviewed Production deployment decision for **04 → 05 → 06 → 07 → 08 → 09**. Recheck whether each migration has already run to avoid duplicate/version drift. Apply in that order only with explicit deployment approval. Finance migration 07 requires special care.
4. Deploy the application build from the *same tested commit* using the approved Netlify process and appropriate private environment settings.
5. Run side-effect-safe Prod smoke tests and verify Auth, Google/SMTP, Netlify logs, Zoom, Realtime, role security and existing financial records. No synthetic real charges, real messages, or destructive recording tests in Production.
6. Do not merge or deploy until all mandatory gates pass.

## Remaining issues — not implied complete by this guide

- A tested archive/working checkout, TypeScript/build results, and validated provider configuration have not yet been supplied.
- Bank cutoff migration 07 is not proven compatible with historical paid and approved rows or concurrent Admin action; manual netbanking behavior must be verified.
- Zoom stream 401 retry, remote delete/sync and Host 2 depend on actual Zoom provider behavior and authorization; API code alone cannot certify them.
- Complete Admin logging instrumentation and mobile/demo acceptance need runtime tests.
- No Production SQL has been executed by ChatGPT. Do not interpret this guide as permission to modify Production.
