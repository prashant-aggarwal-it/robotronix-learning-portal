# Phase 9C — Background Jobs and Worker Monitoring

## Delivered
- DEV migration `database/saas/95_phase9c_worker_health.sql`: a tenant-independent worker heartbeat record in private `saas`, RLS enabled, with restricted service-role-only PostgREST functions.
- Worker records `started`, `success`, or `failed` after verifying its separate worker bearer secret. Heartbeat persistence is best effort and does not block processing.
- Privileged `/api/platform-admin/worker-health` reads aggregate queued, retry, failed, sending, due, retried and stale-sending jobs, oldest waiting age, last heartbeat and processing counts.
- Stalled or failed worker shows degraded; a worker with no recorded heartbeat is **unknown**, not healthy.
- System Health > Background Jobs now has real data with manual refresh, no secrets, recipient addresses, message bodies or student data.
- Phase 9A/9B and existing Phase 8 regression tests run in 9C CI.

## Operational constraints
- The GitHub scheduler must be configured, secrets set, and its branch/deployment context appropriate for worker execution. An absent heartbeat does not establish a worker failure if it has never been scheduled.
- This does not assert successful recipient email delivery or email provider acceptance; notification processing and provider health have separate checks.
- Worker API still uses existing notification processing implementation; this phase does not overhaul underlying email dispatch.
- DEV database function deployment performed; PROD unchanged. No Netlify deployment or main branch merge.
- Live authorized admin API and real scheduler execution remain browser/environment acceptance gates.
