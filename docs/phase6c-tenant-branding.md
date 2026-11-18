# Phase 6C — Effective tenant branding

The authenticated `/api/tenant-branding` response now combines the existing service-only `saas_branding_view_v1` and Phase 6A `saas_branding_tier_read_v1` RPCs. Both check organization membership / active status independently. No new database structure was required.

The pure `parseTenantBranding` resolver emits **Robotronix default colors, no custom logo and no custom tagline** for `standard`, even if older saved custom values remain stored. It emits saved customer theming for `custom` and `white_label`. This is presentation tier enforcement only; complete vendor identity removal is Phase 6D.

`TenantBrandingProvider` already scopes Academy, Suite, CRM and connected Tasks to authorized organizations with module and workspace mapping checks. This phase clears rendered branding as soon as a Suite organization switch or branding-save event is dispatched. Pending fetches are generation-checked; links and enabled-module checks remain in place. Unlinked personal Tasks and Platform Admin stay on corporate defaults. Cross-tab storage updates also request re-resolution; a different browser tab's branding save is not guaranteed to propagate immediately without an auth/storage event or reload.

Run `node --test scripts/test-phase6c-branding.mjs` and browser acceptance for actual theme rendering, multi-org switching, Standard fallback and module mappings. Two-org real DEV HTTP acceptance is a separate gate and must be reported separately.

The saved settings are not removed when a tier is downgraded. No PROD or Netlify changes.
