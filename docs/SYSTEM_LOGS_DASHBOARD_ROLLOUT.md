# System Logs — operational dashboard rollout (PR #37)

## Implemented
- Admin-only summary of error/warning events over the last 24 hours, recent job exceptions and email delivery history.
- Source, severity, reference/code and UTC date filters; 25-row pagination and sanitized current-page CSV.
- Expandable immutable event details with stage and HTTP status inferred from structured safe error codes; copyable reference ID.
- Repeated-error grouping (within latest 2,000 24-hour events) and Admin-only issue status (open/investigating/resolved) plus a 500-character internal note in `portal_log_issues`.
- Expected job schedule, last run, next expected run and missing/overdue indicator.
- Dedicated daily Netlify `system-log-retention` function calling `POST /api/cron/system-log-retention`, protected with `INTERNAL_CRON_SECRET`, saving its heartbeat into `portal_job_runs`.
- Log and job-history retention uses existing bounded `purge_old_portal_system_logs(30)` and `purge_old_portal_job_runs(30)` RPCs.

## Database migration required (do **not** run fresh installer on populated DB)
After backup, apply only `database/01_install/modules/schema/09_system_log_issues.sql` to DEV first; test Admin read/write and deny non-admin browser access. For an existing PROD database, apply the additive module before deploying this UI if incident status controls must be available. Without this table, the screen shows other logs and explicitly indicates issue management is unavailable.

The migration adds **one** table and no existing business data is rewritten. Original log events remain immutable.

## Production gates
1. Run `npm run check:release`, `npm run typecheck` and `npm run build`; review GitHub release/security results.
2. DEV verification: Admin sees correct filters, summary, pagination, error details and safe CSV. Test code that includes HTTP 400/401/403 and `refresh-url`; confirm no stack traces or secrets are shown.
3. DEV verification: update issue status, refresh, verify persistence and that all matching occurrences share state; verify non-Admin GET/PATCH receives 403 and unauthenticated receives 401. Do not include secrets or personal data in notes.
4. Run the retention job only in a disposable DEV environment with synthetic log entries older than 30 days. Verify the two RPCs remove only eligible data and `portal_job_runs` contains a new `system-log-retention` heartbeat.
5. Confirm `INTERNAL_CRON_SECRET` and production URL are configured in Netlify; inspect scheduled function's production logs after deployment. The job runs daily at **03:30 UTC (09:00 IST)**; the missing-heartbeat marker should clear only after a real completed execution.
6. Confirm email alert sender, recipient and API key separately. The UI **does not enable delivery** by itself.
7. Deploy and verify main branch SHA in Netlify; do not merge this branch before DEV signoff.

## Known limits
- Counts/grouping use the latest 2,000 events within 24 hours (screen signals when truncated); not a full analytical warehouse aggregation.
- Status/notes are associated with safe source/action/error-code fingerprints, not with individual customer or payment records.
- The dashboard is not a substitute for an external uptime monitor when Supabase or Netlify itself is unavailable.
- A job heartbeat confirms execution was recorded, not that external provider integrations are healthy.
