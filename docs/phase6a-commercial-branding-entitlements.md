# Phase 6A — commercial branding entitlement foundation

Branch: `feature/education-suite-phase6a-branding-entitlements` (DEV only).

## Effective levels

- `standard` — default for all organizations, including existing ones without a setting.
- `custom` — authorized tenant theme and logo.
- `white_label` — tier reserved for Phase 6D vendor-brand handling.

The setting is `saas.organization_settings(organization_id, 'branding_tier')`; no new tenant or entitlement tables are necessary. Existing `logo_url`, `theme_palette`, `tagline` and `accent_color` are preserved. No backfill means upgrades/downgrades can restore saved branding.

## API

`GET /api/platform/branding-entitlements?organizationId=<uuid>` — requires a verified user and active organization membership or active Platform Super Admin. Returns `{ok,organizationId,level,isDefault}`.

`POST /api/platform/branding-entitlements` with JSON `{organizationId,level}` — only active Platform Super Admin. Returns `{ok,organizationId,level,previous,changed}`.

Service-only Postgres RPCs `saas_branding_tier_read_v1` and `saas_branding_tier_set_v1` additionally validate claimed service role and actual actor membership / platform-admin status. No untrusted actor IDs are accepted from the API caller. Direct `organization_settings` writes with an invalid tier are rejected by trigger. Every changed tier records old and new in `saas.audit_events` and an entry in `saas.platform_admin_audit`; idempotent no-op requests do not create change records. All API responses are `private, no-store`.

## Boundaries and handoff

Phase 6A only adds commercial entitlement administration and safe storage. Existing Phase 5 branding preview/save/runtime continue unchanged until Phase 6B (Owner controls/write gating) and Phase 6C (effective tier-aware theme rendering). **Do not claim tier enforcement in those existing Phase 5 paths before those phases land.**

No PROD Supabase, main branch, Netlify deploy or schema changes beyond DEV. Tests: `node --test scripts/test-phase6a-branding.mjs`, `npm run typecheck`, `npm run build`.
