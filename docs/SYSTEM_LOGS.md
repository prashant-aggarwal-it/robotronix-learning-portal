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
- **Empty DEV database:** the canonical `database/01_install/modules/schema/01_core_schema.sql` includes logs table.
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

## Consolidated feature SQL and background-job history (2026-10-26)

Canonical SQL for this feature is `database/01_install/modules/schema/08_operational_logging.sql`. Existing-database rollout: back up DEV, run this one additive module in DEV SQL Editor, validate job read/write privileges, and only then consider a separately approved production rollout. Do not run the fresh installer against an existing database. The fresh installer script includes the feature module as PART 3 after schema and master reference data, so definitions do not need to be copied into scattered SQL patches.

`portal_job_runs` records success, partial or failed outcomes per scheduled invocation, with counts, elapsed time and reference ID. Admin UI reads the latest execution per job; history is not yet an independent uptime check. Enabled row-level security permits only active Admins via `is_admin()`; browser clients have no write permissions. Service role writes the records. All job log writes are best effort, so a temporary monitoring failure should not make successful class operations fail. `purge_old_portal_job_runs(30)` is available for a later approved retention job; no automated cleanup is deployed by this change.

Current coverage: reminder processing and Zoom retention/reconciliation. **Not completed by this commit**: every enrollment, payment, user-session or browser workflow; an externally independent downtime detector; scheduled health notifications and automatic incident resolution. Do not classify these as verified without DEV tests.

## 2026-10-30 operational error coverage (PR #35)

All new operational events contain a short static error code and a generated reference ID. Operators can search the reference ID at **Admin > System Logs** and correlate it with Netlify's `[zoom-recording]`, `[zoom-reconcile]`, or `[portal-client-error]` messages. Never place third-party exception messages, bearer tokens, customer form values, signed media URLs, or personal messages in `safe_message`.

| Source | Failure categories recorded |
| --- | --- |
| `zoom-recording` | Details, playback stages (token/profile/meeting/authorization/upstream/refresh/retry), HTTP status, update stages (Zoom trash vs local database write) |
| `zoom-reconcile` | Failed meeting, failed recording and incomplete batch |
| `zoom-classroom` / `zoom-meetings` | Classroom reads, JIT sync/cancellation, general meeting list/create/cancel |
| `zoom-webhook` / `razorpay-webhook` | Provider webhook claim, retry and processing stages; raw provider errors are not persisted in operational history |
| `finance` | Invoice list and provider/ledger actions; exchange-rate provider failures |
| `client-runtime` | Authenticated React error-boundary failures (route bucket only) |
| `client-workflow` | Authenticated onboarding, enrollment, opening finance, cohort, scheduling, availability, and finance failure codes |

The client reporter sends only a server-allowlisted failure code via authenticated request; it sends no exception stack, email, student name, form value or payment data. Client-reported errors are **signals**, not proof that the server operation failed. A browser session must be valid for its report to persist, and reports are best effort.

### Daily operator workflow

1. Inspect **Admin > System Logs > Background job health**. Each expected job must have a recent heartbeat; missing jobs and runs older than three scheduled intervals are flagged. This is a browser-side view, not an external alert.
2. Filter operational events by `error` and investigate new reference IDs. Use error codes to select Zoom, Supabase Auth, Razorpay or Netlify diagnostic consoles; do not paste sensitive raw provider payloads into the portal.
3. For Zoom deletion errors, `ZOOM_UPDATE_ZOOM_TRASH` means Zoom did not confirm trashing, while `ZOOM_UPDATE_SAVE_DELETED_STATUS` means Zoom may have already trashed the file but portal status update failed. **Reconcile before retrying** the latter case.
4. For webhook errors, inspect the event retry ledger and provider delivery history before manually replaying anything. Do not issue duplicate invoices or notifications.
5. For `CLIENT_*` / workflow events, reproduce in DEV and use the code and time to locate the affected UI flow; never assume a user-generated report is authoritative.

### Known limitations / deployment gates

- Netlify deployment, Supabase table permissions and DEV end-to-end verification are **not** implied by a committed PR. Verify the service-role insert succeeds and all new browser workflow reports appear in DEV.
- Logging itself is best effort. If Supabase is down, the log table may be unavailable too; Netlify console logs and an **independent uptime monitor** are still required.
- There is **no configured out-of-band alert destination** for missed cron runs, database downtime or repeated 5xx responses. Admin dashboard overdue markers require someone to open the page. Add a separately authenticated external monitor/notification channel before claiming proactive alerting.
- Direct Supabase writes from screens not in the allowlist and some noncritical routes are not covered by named operational events. Use dedicated failure handlers when adding new workflows.
- Never deliberately delete real recordings, create financial transactions or force production failures for monitoring tests.

## Scheduled critical email alerts (implemented in PR #35; enable only after DEV verification)

`netlify/functions/operational-email-alerts.mjs` runs every **15 minutes (UTC cron)** and requires no new package. It checks:
- Error-severity `portal_system_logs` entries from the previous 30 minutes, summarized without PII.
- The latest recorded execution of each of four expected jobs. Runs are overdue after the greater of 15 minutes or 1.5 scheduled intervals. The latest `failed` or `partial` run also raises a warning.
- Email events are grouped into one critical-errors digest per hour and one job-health alert per six-hour period. `portal_alert_dispatches.dedupe_key` has a unique constraint; the first run claims delivery, and concurrent repeats do not send again. Failed sends are marked `failed` in the Admin alert history and can be investigated; automatic within-window retries are intentionally suppressed to avoid alert storms.

### Required setup in Netlify (server-only)

1. Verify the sender domain with an email provider that supports the Resend Emails API. Create a scoped API key.
2. Set `RESEND_API_KEY`, `ROBOTRONIX_ALERT_FROM_EMAIL` (verified sender address), and `ROBOTRONIX_ALERT_TO_EMAIL` (explicitly approved operator mailbox) as **server-side** environment variables. Do not add the `NEXT_PUBLIC_` prefix or put values in GitHub.
3. Back up DEV and apply the additive `database/01_install/modules/schema/08_operational_logging.sql` module. Confirm `portal_alert_dispatches` exists, its RLS is active, service-role can insert and authenticated non-admin roles cannot read it. The canonical fresh installer also includes this module. Apply to production only after separate migration review/approval.
4. Deploy to DEV and run a controlled synthetic `portal_system_logs` error row. Verify a single email and one `sent` row in `portal_alert_dispatches`; check the Admin > System Logs > Critical email alert delivery panel. Avoid testing with production recordings or payment transactions.
5. Confirm a simulated old heartbeat triggers one job-health email, and a second overlapping invocation produces `deduplicated`, not an extra email. Validate missing API key leaves the scheduled function disabled and does not throw.
6. After DEV acceptance, enable the three environment variables in the production Netlify context and deploy. Check both Netlify function logs and the delivery panel.

**Important:** Email is disabled if any of the three environment variables are absent. No recipient has been chosen by the code. Delivery is through Resend's HTTPS API, not Supabase Auth SMTP. The monitor cannot detect a complete Netlify or Supabase outage on its own; a separately hosted synthetic uptime check remains necessary for that guarantee. If the outbox claim is written but the provider call fails, the alert is not resent within the cooldown window. This is a deliberate anti-duplication safeguard and must be visible in Admin delivery history.

## Zoom recording reliability changes (2026-10-30)

A focused source audit found three tangible weaknesses in the existing playback/reconciliation path:
- The persisted download URL can contain an earlier `access_token`. The server now **replaces** it with the current host token on every media request (including after OAuth refresh), rather than retaining an expired query token.
- Recording reconciliation previously ignored duplicate file IDs, leaving stale provider download URLs untouched. For existing **completed** files it now refreshes provider-owned metadata while preserving deletion state, protection, visibility and retention. Deleted files are never resurrected by synchronization.
- An upstream login/JSON error page with HTTP 200 could be passed to the browser as a video. Streaming now rejects HTML/JSON content and emits `ZOOM_STREAM_NON_MEDIA`.
- Recording DELETE provider failures now add the safe upstream HTTP status to their stage-specific error code (for example `ZOOM_UPDATE_ZOOM_TRASH_HTTP_404`). The vendor response body is not written to the system log.

**Still required:** DEV test with a nonessential test recording for authorized playback, seek/Range requests, existing stale URL refresh, protection toggle and Zoom Trash. HTTP 404 during deletion must not be assumed to mean successful trashing; reconcile against Zoom first. No production recordings were deleted as part of this code audit. The Zoom API provider endpoint contract could not be independently retrieved during this session, so DELETE request semantics have not been changed speculatively.
