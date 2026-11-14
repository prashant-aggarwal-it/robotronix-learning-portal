# Robotronix Education Suite — Phase 3E Production Release Plan (Not Executed)

**Status:** release-preparation document, NOT a deployment authorization.
**PROD project:** `njyktzenybimykpqaegn` — must remain untouched until separate approval.
**Feature branch:** `feature/education-suite-phase3e`

## Preconditions

1. Latest Phase 3E source certification and three-customer authenticated DEV E2E pass on a reviewed and frozen feature-branch commit.
2. Confirm CRM, Academy, Tasks and SaaS SQL packages are complete in a staging clone; perform additive migrations there first.
3. Confirm module combinations behave standalone and combined; check no feature flag accidentally enables a missing module.
4. Export a verified, restorable PROD database backup. Include Auth identities, relevant schemas, migrations, integration configuration, connected CRM handoffs and audit records.
5. Record baseline table counts, index definitions, RLS, function EXECUTE grants, module entitlements, portal admission handoff states, and active integration tenant counts.
6. Require deployment owner signoff for the code SHA, SQL upgrade hash, user-facing downtime/change window, rollback ownership and smoke checklist.

## Installation sequence (future, subject to approval)

1. Deploy no code yet. Take backup and evaluate migrations with `BEGIN` in staging clone.
2. Apply baseline Phase 3A–3D SQL migrations in correct order only when not already installed; reconcile database migration history, do not replay conflicting installers.
3. Apply canonical Phase 3E source 48: secured SaaS CRM↔Portal installation RPC; **retain global one-active index initially**.
4. Apply source 49: per-request authorized CRM↔Academy access scope, installer validity.
5. Apply source 50: database trigger for legacy/direct installation safety, then replace global unique active index with per-tenant index. Keep all changes in one controlled migration window.
6. Apply source 51: require BOTH CRM and Academy module entitlements on activation, access and direct integration writes.
7. Deploy matching application branch only after PROD SQL functions and policy grants are present; do not expose a window where SaaS clients can use an unscoped fallback.
8. Configure mapped organizations, CRM tenant links, Academy/CRM/Tasks module entitlements and owner/admin memberships. Confirm each tenant mapping is unique.
9. Activate first test tenant, then second, then third. Verify A/B/C active simultaneously with no data cross-over, then test B disable/re-enable and unchanged A/C behavior.
10. Verify approved Zoom, onboarding emails/WhatsApp, billing/Razorpay and background jobs separately. Never expose service-role secrets in browser variables.

## Rollback and recovery

- Before the database step, preserve backup plus the prior index, trigger and function definitions and migration plan.
- App rollback: redeploy last known-good approved code build only if its schema compatibility was tested in staging.
- DB rollback must **not** blindly recreate `connect_portal_single_active_integration` while multiple tenants are active: first disable all but a single active customer under an agreed maintenance window, notify affected operators, then restore old function/trigger definitions and index, or restore from the validated pre-change backup.
- Preserve all CRM admissions, handoff tokens, classes, task links, parent/student enrollment and payment transactions. Never reset PROD or delete records as a rollback shortcut.
- If a smoke test fails, stop activations; keep tenant-scoped checks fail-closed and recover with audited changes.

## Environment and scheduling checklist

- Verify domain/subdomain, Netlify runtime and correct Supabase DEV/PROD URLs, keys, OAuth redirect origins, cookie domains and secure session settings.
- Configure `PRODUCT_MODE`, `ENABLED_PRODUCTS`, `ENABLED_INTEGRATIONS` explicitly per deployment profile.
- Keep `SUPABASE_SERVICE_ROLE_KEY`, Zoom, Razorpay, WhatsApp and internal cron credentials in server-only environment.
- Evaluate Netlify schedules for `zoom-retention` (02:15), `zoom-auto-reconcile` (every 5 minutes), `system-log-retention` (03:30), `connect-history-drain` (every minute); ensure no equivalent pg_cron job overlaps. Activate module-specific runners only if owned by this deployment.
- Check error recording, retries, job ownership, idempotency keys, tenant-scoped jobs, dead-letter review and privacy-safe logs.

## Release smoke checklist

- Verify SaaS owner/admin/trainer/parent/student role matrix; customer A/B/C tenant switching; suspended and revoked membership denial.
- Verify CRM enquiry, demo scheduling and feedback, admission acceptance, verified parent onboarding, enrollment activation, CRM Won reconciliation and repeat-request idempotency in each tenant.
- Verify Tasks source links, reassignment/privacy and class follow-up; disabled optional module behavior.
- Verify per-tenant trainer discovery, schedule permissions, Academy finance and CRM contact privacy.
- Verify scheduled jobs and alerting in the actual deployment; inspect Netlify logs and Supabase logs.
- Monitor rate limiting, latency, deadlocks, failed job counts, pending admissions and cross-tenant authorization denials after launch.

## Go / No-Go criteria

**NO-GO** if any critical tenant-isolation test fails, more than one CRM maps to a SaaS organization unexpectedly, a SaaS auth RPC is missing, DEV certification is incomplete, rollback rehearsal fails, or live integration secrets/monitoring are absent.

The production deployment itself requires separate explicit user authorization and is outside Phase 3E DEV assignment.

## DEV advisor and additional go-live controls

- Supabase DEV security advisors currently report 15 anonymous EXECUTE grants on legacy SECURITY DEFINER helper functions, 35 authenticated grants, and leaked-password protection not enabled. Review each legacy helper for RPC exposure; do not blanket-revoke RLS helpers that application policies require. Enable supported authentication password protection before release.
- Explicitly verify Netlify job configuration and credentials for all scheduled functions; do not enable competing pg_cron or external schedules. Current DEV has no pg_cron extension installed.
- During production change control, verify migration step 51 and execute a staging three-customer test that disables CRM entitlement for one tenant without impacting the other two.
