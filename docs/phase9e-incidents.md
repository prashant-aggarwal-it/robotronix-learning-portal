# Phase 9E — Security, incident management and alerts

## Implemented
- Service-only, invoker-privilege incident ledger and append-only history in DEV Supabase. No anonymous or normal authenticated access.
- Platform-admin gated GET/POST API supports listing, manual incident creation, acknowledgement and resolution; resolved incidents retain their audit history.
- Unique open fingerprint prevents duplicate open incidents, with occurrence tracking on repeat reports.
- Read-only recent history, severity and status counts, deduplication key and confirmation on resolution.
- Explicit **Scan operational signals** action checks existing service-only worker and customer aggregates for overdue email processing, stale sending jobs and failed owner invitation deliveries. These generate warning incidents with fixed fingerprints. Stale heartbeat alone does not imply failure while schedule execution remains unverified.
- Sensitive details such as credentials, message bodies and email recipients are never returned.
- Source tests, typecheck and Next.js build via GitHub CI.

## Remaining / limitations
- On-demand signal detection, **not** scheduled background alerting or outbound critical notifications. Notification destinations and retry/escalation policies require explicit safe configuration before release.
- Audit sources cover incident history and existing platform administrator actions, not all auth failures or all tenant security events. A comprehensive security event pipeline would be separate work.
- Recent incident and history lists show at most 100; the UI labels this limit.
- UI acceptance tests with a real authorized and unauthorized browser session remain required.
- DEV-only deployment; PROD, Netlify and main unchanged.
