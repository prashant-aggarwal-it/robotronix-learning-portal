> **Current fresh-install procedure:** Run `npm run db:build-fresh-install` and execute its generated SQL once in a new empty Supabase project. Legacy incremental SQL guidance below is historical; never run the canonical fresh installer on an existing database. See [database installation](DATABASE_MIGRATION_ORDER.md).

# System Logs — current implementation and DEV verification

**Status:** Initial integration implemented on consolidated release branch; not yet DEV-validated or deployed.

## Purpose
Admin > System Logs displays recent sanitized operational events. This differs from **Corrections & Audit**, which tracks approved business operations.

## Data / access
- `portal_system_logs` has authenticated Admin-only SELECT under RLS. All normal browser clients have no write policy, and INSERT privileges are revoked from `anon` and `authenticated`. Server routes write using a service-role key privately.
- Service helper `lib/server/system-log.ts` persists `occurred_at`, severity, source, action, reference ID, optional safe code and a **static sanitized summary only**. Do not pass raw `error.message`, request bodies, SMTP passwords, OAuth tokens, bank details, PAN, provider JSON or personal messages.
- `GET /api/admin/system-logs` verifies Supabase Auth bearer token and an active Admin profile before querying via the service role; returns at most 100 latest rows filtered by severity, source/action/reference.
- Errors in `/api/admin/portal-access` now emit a reference code instead of passing the raw provider error through to the browser. Supabase Authentication > Logs remains necessary to diagnose vendor-specific SMTP errors.

## Schema deployment
- **Empty DEV database:** the canonical `database/01_install/01_CREATE_SCHEMA.sql` includes logs table.
- **Production:** no migration or change until tested, backed up and explicitly approved.

## Manual DEV acceptance
1. Admin navigates to `/admin/system-logs`; an empty log list is valid initially.
2. Trigger a **controlled synthetic failure** in DEV portal-access operation. Record displayed reference ID and match it to exactly one row in `portal_system_logs` (exclude raw email/token/provider error).
3. Verify severity filter, search and refresh. Empty results show a neutral state.
4. Trainer/Parent/Student receives HTTP 403 from logs API; anonymous receives HTTP 401. RLS direct query for non-Admin returns zero rows.
5. An Admin user marked inactive also receives HTTP 403.
6. Check the public browser bundle and network response contain no service-role key, raw SMTP password, finance values, sensitive support messages or Supabase JWT.
7. Temporarily disable DEV log insert permission; original error remains a controlled failure and logger failure does not throw additional unhandled errors.
8. Review indexing and retention policy with operator; **retention automation is not implemented yet**.
9. Confirm `check:release`, `build`, authentication and role suites pass against an exact commit and DEV schema.

## Still required
- Instrument additional Zoom, Razorpay, scheduling, onboarding and finance server routes with static error codes and safe reference IDs.
- Add alerting/retention/correlation policy; test provider webhook retry and log-write outage handling.
- Review safe-message allowlist, search query sanitization and usability under heavy log volume.


## QA branch scheduled-job instrumentation (2026-10-26)

Implemented on `fix/qa-onboarding-save-feedback-20261025`; **not deployed to production**:

- `process-reminders`: structured Netlify console summary on each invocation, with `inserted`, duration and correlation reference. A sanitized `portal_system_logs` entry is saved for failures and when notifications are actually created. Zero-insert successful checks remain console-only to avoid 288 routine database rows per day.
- `zoom-retention`: Netlify console summary with checked/deleted/failed counts and elapsed time. Recording-level failures and job failures are recorded as safe events through `logSystemEvent`, with reference IDs. Successful deletion batches generate an information event. No raw Zoom exception or provider response is returned to a caller by the API.
- `zoom-auto-reconcile`: class provisioning failures, fatal job errors, and successful creation/repair batches are recorded as sanitized events. This job is **not yet** the agreed just-in-time Zoom design.
- Admin empty-state clarifies that zero stored events does **not** prove all jobs are healthy.

### Verification before merging

1. Let GitHub release and security workflows complete successfully on the **exact latest commit**.
2. Confirm DEV `portal_system_logs` exists and service-role insert permission works, and that the server points at the correct DEV Supabase project.
3. On DEV only, execute a controlled failure and confirm one `error` row plus one console summary, with no leaked credentials, student details, or Zoom provider error text.
4. Run a DEV reminder with an eligible test class and verify `inserted > 0` plus exactly the expected portal notifications; verify an idle execution writes only to the Netlify console.
5. Check Zoom retention with no eligible recordings first. Do **not** force a production recording deletion for the sake of testing.
6. Validate monitoring-write failures are nonfatal to the business operation.
7. Verify trainer/parent/student cannot query Admin logs and refresh/search filters work.

### Remaining production observability work

This is an **incremental instrumentation release, not a completed monitoring platform**. We still need: comprehensive instrumentation of payment, enrollment, scheduling, onboarding and authentication workflows; persistent per-job health/heartbeat records and overdue-job detection; Admin alerts, retention enforcement, error aggregation, and automatic tests that exercise all failure paths. The existing scheduled functions use Netlify invocation logs for their idle-run heartbeat, not the Admin database. A separate availability monitor is needed to identify total Supabase outages.
