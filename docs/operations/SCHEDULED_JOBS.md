# Robotronix scheduled jobs — modular deployment runbook

**Scheduler source of truth:** [config/scheduled-jobs.json](../../config/scheduled-jobs.json).  
**Default for new CRM/Tasks modules:** disabled until installed, validated and deliberately enabled.  
**Optional worker ownership:** `OPTIONAL_JOB_RUNNER=netlify` must also be set before CRM reminders, Tasks reminders or CRM–Portal operations can run. This is an explicit cutover acknowledgement, not automated proof that a `pg_cron` job has been removed. Existing Portal workers are unchanged.
**Execution engine for this Next.js/Netlify deployment:** Netlify Scheduled Functions (UTC). No new database cron registration is part of the canonical SQL.

## Job ownership

| Module | Job | UTC cron | Enablement |
|---|---|---|---|
| Portal | `process-reminders` | Every 5 min | Existing Portal deploy |
| Portal | `zoom-auto-reconcile` | Every 5 min | `INTERNAL_CRON_SECRET` |
| Portal | `zoom-retention` | 02:15 daily | `INTERNAL_CRON_SECRET` |
| Portal | `system-log-retention` | 03:30 daily | Existing Portal deploy |
| Portal | `operational-email-alerts` | Every 15 min | Verified sender, recipient, `RESEND_API_KEY` |
| Tasks only | `process-task-reminders` | Every 5 min | `TASKS_SCHEDULER_ENABLED=true` |
| CRM only | `connect-reminders` | Every 5 min | `CONNECT_SCHEDULER_ENABLED=true` |
| CRM only | `connect-history-drain` | Every minute | `CONNECT_HISTORY_DRAIN_ENABLED=true`, `CONNECT_HISTORY_JOB_SECRET` |
| CRM + Portal | `connect-portal-ops` | Every 5 min | `CONNECT_PORTAL_JOBS_ENABLED=true` |

The CRM + Portal worker runs the *final* existing RPCs `connect_process_portal_demo_followups`, `connect_reconcile_portal_enrollments` and `connect_sync_portal_lifecycle` with independent success/error reporting. CRM-only worker runs only `connect_run_reminders`; Tasks-only worker runs only `task_reminder_process`. WhatsApp history worker runs only when coexistence import/drain is enabled.

The Portal log-retention worker now has **one canonical implementation**: `netlify/functions/system-log-retention.mjs`. The duplicate `.mts` implementation was deleted; `netlify.toml` owns its schedule.

## Installation/activation by customer package

1. Install the appropriate **core database package** from [database/canonical](../../database/canonical/README.md) and optional SQL integrations from [database/integrations](../../database/integrations/README.md). Verify the database before activating any background processing.
2. Deploy only the selected product's application or configure the feature flags listed above in Netlify. Keep flags unset/false for products not purchased or schemas not installed.
3. Configure `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`) and `SUPABASE_SERVICE_ROLE_KEY` **as server-side Netlify environment variables**, not browser-exposed variables. Secrets must never be committed.
4. **Before enabling a Netlify CRM worker, check the target Supabase project for active `cron.job` rows running the same RPCs.** Disable/retire *overlapping* `pg_cron` jobs first in a separately approved deployment change; two schedulers must not invoke the same CRM follow-ups/reminders. This is particularly relevant to the current Development database, which still has active CRM `pg_cron` registrations.
5. After verifying the old schedules are disabled, set `OPTIONAL_JOB_RUNNER=netlify` and only the appropriate enable flags to `true`, deploy, and confirm the first successful Netlify invocation and subsequent consecutive runs in function logs. Validate expected database effects with test data. Configure failure notifications/monitoring for optional workers before treating them as production ready.
6. For **CRM-only** and **Tasks-only**, do not rely on Portal-specific `portal_job_runs` telemetry tables; monitor the job directly through Netlify until each standalone product has its own persistent operational telemetry.

## Important cautions

- In existing Robotronix **Production**, the four established Portal job types have recent successful entries in `portal_job_runs`. Do not change or replace them during CRM/Tasks rollout without a specific cutover plan.
- In existing Robotronix **Development**, two CRM database cron registrations are active. Their presence does not prove the CRM/Tasks *new clean-install package* is installed or runnable in production.
- `app/api/connect/jobs/reminders` is an older authenticated manual/external scheduler route that bundles CRM and Portal operations. Do **not** attach a second cron service to it while the new module workers are scheduled. It is not an installer or Netlify cron registration.
- `netlify.toml` owns schedules for selected `.mts` workers; others export their `config.schedule` in code. Define each schedule in **one location only**.
- Netlify scheduled-function logs, deployed configuration, environment variables and delivery are external state; static code checks do not confirm that a job ran.
- Cron expressions above are **UTC**, not India time.
- No automated rollout or production cron changes have been made by this repository refactor.

## Local static verification

```bash
npm run check:schedules
npm run db:check-canonical
npm run db:check-packages
```

These verify schedule ownership and module SQL manifests. Follow with isolated database installation tests and live Netlify log checks.
