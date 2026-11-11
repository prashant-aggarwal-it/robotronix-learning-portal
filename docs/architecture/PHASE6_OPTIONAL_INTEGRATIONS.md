# Phase 6 — optional integrations and background jobs

## Installation contract

Deployment flags are server-controlled; enabling a UI link does not install SQL or grant access.

| Package | Integration SQL | Behavior |
| --- | --- | --- |
| CRM + Portal | 01 | Admissions, demos, enrollment reconciliation and lifecycle bridge |
| CRM + Tasks | 02, 03 | Explicit per-user CRM task links; status sync only for linked CRM tasks |
| Portal + Tasks | 04, 06 | Optional Portal notification fan-out and explicit class-to-task links; no CRM dependency |
| All three | 01, 02, 04, 05 | Both link sources, independent workflows and optional notification bridge |

Task-link implementation SQL 03, 05 and 06 are alternatives, not cumulative migrations. Each class/source link creates at most one personal task for each account. Portal class records remain authoritative and are never copied into the Tasks schedule. CRM synchronization updates only explicitly linked records and respects CRM tenant membership.

## App and worker behavior

- `ENABLED_INTEGRATIONS` controls which authenticated cross-module routes can be reached. The task link endpoint accepts CRM links only with `crmTasks` and Learning links only with `portalTasks`; the endpoint is unavailable without either integration.
- Standalone CRM, Portal or Tasks APIs continue working even if an optional integration is absent or its job fails.
- `CONNECT_SCHEDULER_ENABLED`, `TASKS_SCHEDULER_ENABLED` and `CONNECT_PORTAL_JOBS_ENABLED` remain per-worker opt-in flags. Additionally, `OPTIONAL_JOB_RUNNER=netlify` is required for these three workers. Setting the flag is an operator acknowledgement; it does not detect a live competing `pg_cron` job.
- The legacy combined CRM reminder endpoint rejects requests once modular scheduling is configured. The CRM and Portal workers invoke separate RPCs, while CRM–Tasks status propagation is trigger-driven and does not require a cron job.
- A missing optional RPC returns a worker-level failure, not an exception in unrelated core endpoints. Worker errors must be monitored and addressed before production rollout.

## Release verification (not yet a production cutover)

1. Run `npm run db:check-canonical`, `npm run db:check-packages`, `npm run check:modules`, `npm run check:backend-modules`, `npm run check:schedules`, and `npm run build`.
2. On a disposable database, install each product combination from `database/packages.json`; verify authenticated CRM/Portal workflows and task links, duplicate requests, permission changes, CRM status roundtrips and missing-module behavior.
3. Query `cron.job` on the target Supabase project and inspect any other external scheduler. Disable overlapping job owners before setting `OPTIONAL_JOB_RUNNER=netlify`.
4. Verify first and successive Netlify invocations and log alerts. Observe existing production Portal jobs without changing them.

No production SQL execution, cron cutover, deployment or main-branch merge is authorized by this document.
