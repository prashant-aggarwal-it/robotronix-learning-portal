# Robotronix Release Candidate — 2026-10-18 (unverified)

Branch: `feature/production-hardening-v1`

## Release disposition
**Candidate assembled in GitHub, NOT approved for deployment or merging to main.**
This environment cannot clone the repository to run `npm ci`, TypeScript, Next build or Playwright. The GitHub Actions workflow must run successfully on the branch and its logs must be reviewed. No tests have been claimed successful in this document.

## Existing automated coverage
- `npm run check:release`: typecheck and static checks for structure, finance, communications, fresh DB, Zoom, Razorpay, Demo, and realtime.
- `npm run qa:prod-gate`: auth, roles, workflows, risk lifecycles, payroll, readiness, Razorpay, responsive/mobile, Demo.
- `qa/demo-experience.spec.ts`: guest token privacy, expiration, Trainer privacy, outcome/summary, guest reschedule.
- `qa/scheduling-lifecycle.spec.ts`: class scheduling conflicts and lifecycle.

## New/previously missing live automation coverage
- Parallel host allocation against a real migrated PostgreSQL database (no live automated test yet).
- Real Zoom account OAuth, two independent hosts, recordings, Protect/Unprotect, retention cleanup and concurrent host scheduling (requires external account + controlled sandbox).
- Cross-role subscription invalidation under Postgres RLS and reconnect.
- Full Demo group attendance matrix, no-show recovery, lead conversion to paid enrollment.
- Provider-level Zoom and Razorpay reconciliation E2E.
**Do not confuse static source-marker checks with behavioral tests.**

## Database reconciliation and deployment order
The fresh install is `database/01_install/01_CREATE_SCHEMA.sql` + `02_INSERT_MASTER_REFERENCE_DATA.sql`.
For existing/upgraded environments the migration chain contains:
- `database/04_upgrade/01_ZOOM_CLASSROOM_V1.sql`
- `database/04_upgrade/04_DEMO_EXPERIENCE_V1.sql`
- `database/04_upgrade/05_LIVE_DATA_HARDENING_V1.sql`
- `database/04_upgrade/06_ZOOM_HOST_ALLOCATION_GUARD.sql` — NEW and REQUIRED before concurrent host scheduling.

The migration guard requires `btree_gist`, refuses to install when overlapping active meetings already exist, and should be applied to staging first. Confirm the complete migration history and any other upgrade scripts for the specific target database; never blindly rerun fresh install on an existing database. A consolidated fresh-schema parity audit is still required before replacing the historical production runbook.

The onboarding Admin notification trigger `onboarding_submission_admin_notification_trg` and `notify_admin_on_onboarding_submission()` must remain present in the final fresh schema.

## CI
`.github/workflows/release-candidate.yml` runs `npm ci`, `npm run check:release`, and `npm run build` on pushes / PRs. A successful CI run is necessary but insufficient for release approval.

## Staging gate
1. Create isolated preview + DEV Supabase with correct Zoom and Razorpay sandbox settings.
2. Confirm database migrations and verify SQL via the database verification script.
3. Run `npm run qa:prod-gate` against staging; capture tests, failures and screenshots.
4. Test 2 independent Zoom hosts, meeting reservations, playback, Protect/Unprotect, +60 days, deletion and expired cleanup with required OAuth scopes.
5. Verify Admin, Trainer, Parent and Student views together, Realtime updates, Demo no-show and group outcomes, conversion and permissions.
6. Update documentation with results, get owner approval, then create/merge a PR into main.
7. Until all gates pass, **do not deploy**, run dev reset SQL in production or change production secrets.

## Release artifact
Git branch is the reproducible candidate source. A downloadable reconciled ZIP has NOT been generated or verified in this environment. Produce the ZIP from the exact validated commit after CI and staging are green.
