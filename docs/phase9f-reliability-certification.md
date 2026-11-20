# Phase 9F — Reliability & Release Certification

## Delivered
- Service-only read-only reliability RPC in DEV. Reports the current database reachability and size.
- Admin-gated API and UI under System Health > Data & Reliability.
- Backup and restore evidence, RPO/RTO, external availability and storage usage are deliberately **unknown/unverified** until an independent provider record is available.
- Consolidated Phase 8E and Phase 9A–9F source regression tests, TypeScript validation and Next.js build.

## DEV security
- Supabase function is SECURITY INVOKER; EXECUTE is restricted to service_role, denied to anon/authenticated.
- Each monitoring route requires verified Super Admin authorization.
- No new external integration credentials, monitoring endpoints accessible to unauthenticated clients or PROD database changes.

## Certification interpretation
- CI success demonstrates code builds and source regressions pass, **not** a live browser or disaster-recovery certification.
- Final release requires manual responsive and keyboard review, two-tenant negative authorization testing, real worker execution and a provider-verified backup/restore drill.
- The currently connected Supabase tools do not independently verify managed backup configuration or perform a restoration. Do not mark those checks passed.

## Production
- DEV-only schema. No PROD changes, main merge or Netlify deployment.
