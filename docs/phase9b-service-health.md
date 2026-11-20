# Phase 9B — Application and Database Service Health

## Implemented
- Privileged GET /api/platform-admin/service-health, protected by requirePlatformAdmin; no-store and Authorization Vary.
- Real on-demand API check measures server-side request and restricted PostgREST-to-PostgreSQL probe durations with performance.now().
- Healthy/degraded/down result for a single request. Database failures produce HTTP 503 and safe error summaries; only server logs contain error codes.
- Platform Operations > Services & APIs shows probe statuses, latency in milliseconds, observed timestamp and manual refresh.
- Monitoring Summary links to the live services view rather than claiming all systems are operational.
- Tests cover admin authorization, service-only RPC, no sensitive disclosure, timing, and honest null historical metrics.

## Explicit limits and release gates
- **Single current-request measurements do not establish uptime, error rate or p95 response time**. These are returned as null; permanent telemetry, multi-instance aggregation, and external uptime checks must be added before those historical measures are offered.
- The database probe uses the DEV `public.saas_platform_monitor_read_v1` service-only function introduced with the Phase 8 503 fix. Deploy this function to any test environment before expecting service-health to work there.
- This does not sample every platform endpoint or perform synthetic probes of customer login, payments, Zoom or email providers.
- Browser acceptance with an authenticated DEV platform administrator and a denied non-administrator remains required.
- No PROD changes, Netlify deployments, schema migrations or main branch merge.
