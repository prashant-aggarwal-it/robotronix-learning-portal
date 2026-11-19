# Phase 7C — Academy email foundation (DEV, partial)

## Architecture
Robotronix platform SMTP is for platform email only. Academy email sending MUST use the academy's own connected, authorized provider. There is no fallback to platform SMTP.

DEV migration 86 adds private service-role-only academy email connection metadata and an idempotent per-tenant delivery-event ledger. RLS is enabled, public/anon/authenticated table access revoked. Never store raw OAuth tokens or SMTP passwords in credential_reference; it must point to a future encrypted secrets vault.

A GET-only authenticated endpoint at /api/academy/email-connections?organizationId=<uuid> returns safe status fields after server-side membership authorization. No credentials or provider tokens are returned. Sending remains disabled unless a verified connection exists; no provider can yet be connected in this phase increment.

## Provider-integration prerequisites (Phases 7D/7E)
- Secure credential vault/KMS integration and rotation.
- Owner/admin-only connect/disconnect/update endpoints with reauthorization, CSRF protection and audit logging.
- Provider connection state machine, health checks and account verification.
- Academy Email Settings UI now shows real read-only provider status, but connect/disconnect actions are intentionally withheld until provider integrations exist.
- Cross-tenant integration tests with synthetic DEV users and negative permission tests.
- Final CI/typecheck/build validation.

Gmail OAuth, Microsoft OAuth and SMTP account connection belong to later phases. Do not expose pretend connection buttons or enable academy mail sending until those provider integrations exist.

No PROD changes or Netlify deployment.

The owner/admin academy management dashboard links to the email status screen. Email settings access requires academy.settings.manage capability; status responses contain no secrets. Credential storage, actual provider authorization and provider health checks are deliberately deferred until implementing Google OAuth and SMTP adapters; do not mark any provider as connected without verified credentials.

## Security hardening
Migration 87 enforces a composite foreign key from delivery events to connection id **and** organization id. A delivery event cannot reference a different academy's email connection, even if a privileged writer accidentally passes the wrong connection id. Verified in DEV via pg_constraint. Both private tables have RLS enabled and only service_role receives DML grants; anon and authenticated receive none.

## Completion boundary
Phase 7C establishes the tenant-owned metadata model, server authorization, read-only settings UI, sender gate and cross-tenant database integrity. Provider credential acquisition, secure storage, token refresh, connection lifecycle, and live provider health checks cannot be safely certified without implementing the actual providers; these are explicit prerequisites for Phases 7D (Google) and 7E (SMTP). No academy sending is enabled by this foundation. CI is not equivalent to a live provider test.
