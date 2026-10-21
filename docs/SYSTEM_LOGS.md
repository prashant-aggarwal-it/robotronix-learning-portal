> **Fresh database consolidation (2026-10-21):** Former incremental SQL scripts 04–09 were included once in `database/01_install/01_CREATE_SCHEMA.sql` and removed from this branch. Follow [the current 2-file fresh installation and conditional Admin bootstrap](DATABASE_MIGRATION_ORDER.md). Historic upgrade instructions below are superseded; **do not execute the canonical fresh schema against an existing database**.

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
