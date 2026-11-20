# Phase 8 Super Admin monitoring 503 repair

## Symptoms
Three authenticated platform admin GET endpoints returned 503 while the existing overview RPC succeeded:
- /api/platform-admin/operations-summary
- /api/platform-admin/email-health
- /api/platform-admin/administrators

The failing routes directly queried `db.schema("saas").from(...)` via PostgREST. Their errors were masked with generic safe messages, so the exact PostgREST error code was not available in the browser.

## Repair
Added the `public.saas_platform_monitor_read_v1` monitoring read function in DEV, versioned in `database/saas/94_phase8_monitor_service_only_read.sql`. It is `security invoker` and executable **only by service_role**; anonymous and authenticated roles cannot execute it. Application routes still require `requirePlatformAdmin` before invoking the RPC with the private service-role client.

This leaves `saas` tables unexposed to ordinary clients; no change to Supabase exposed schema configuration. Response payloads do not contain recipient email, invitation hashes, message text, or credentials.

## Verification
- Direct DEV SQL function invocation returned email health counts (zero), administrator roster (one) and subscriptions (five).
- Privilege probe: anon=false, authenticated=false, service_role=true for EXECUTE.
- Automated source regression and Next.js build via GitHub Actions workflow `fix-phase8-monitoring-503.yml`.
- No changes made to PROD or Netlify.

## Remaining local browser check
Switch to this branch, run `git pull`, restart `npm run dev` and refresh `/platform-admin`. The three GET endpoints should return 200 under a verified platform admin session. Only that final browser test can confirm the exact user's environment is repaired.
