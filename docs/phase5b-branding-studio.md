# Phase 5B — Tenant Branding Studio

**Branch:** `feature/education-suite-phase5b-branding-studio`  
**Baseline:** Phase 5A `948dbe0dda348aad59468a719c4f54aeb45e6b64`  
**Scope:** Branding configuration, preview and save only; Phase 5C will apply branding to authenticated Academy, CRM, Tasks and Suite screens.

## User journey

1. From Platform Admin → Tenant branding, select an organization. Academy Owners use `/onboarding/branding` and can choose only their verified owned, Academy-entitled organizations.
2. Choose/drag a PNG, JPEG or WebP logo (3 MB limit), or provide a compatible HTTPS image URL.
3. The browser analyzes logo pixels and recommends primary, secondary and accent colors. Cross-origin image URLs require CORS permissions; a local upload works without a remote proxy.
4. Adjust colors and tagline. Preview uses the canonical `--brand-*` variables **scoped to the preview element**, never the entire application. It shows an example sidebar, selected navigation, cards, buttons and input.
5. Save. The server uploads the candidate file (if chosen), verifies the authenticated user and tenant membership, then stores the logo reference, tagline, accent color and palette. Reopening the form reads the saved values.

## Architecture

- `lib/theme/logo-palette.ts`: pure deterministic pixel histogram, RGBA filtering, coarse RGB bucket grouping and contrast-aware palette suggestion, plus browser Canvas pipeline. Near-white/neutral and transparent pixels are excluded so backgrounds do not dominate. Monochrome images use a stable Robotronix fallback.
- `lib/theme/tokens.ts`: canonical Phase 5A hex validation, CSS-token mapping and contrast calculations. Phase 5B reuses these utilities.
- `features/branding/BrandingStudio.tsx`, `branding-studio.css`: responsive client component with drag/drop, upload, URL analysis, editable palette, isolated live preview, reset and success/error states.
- `app/api/branding-studio/route.ts`: authenticated GET/POST using actor-checked service-only RPCs; POST saves all branding fields atomically.
- `app/api/branding-studio/upload/route.ts`: verifies the authenticated actor/organization, checks file size/MIME and raster magic bytes, uploads a new immutable image object, and bounds abandoned candidate assets.
- `app/api/branding-studio/owner/route.ts`: finds an authenticated Owner's Academy-entitled organizations through a narrowly scoped RPC.
- `database/saas/72_phase5b_tenant_logo_bucket.sql`: public-read bucket `tenant-brand-logos` with PNG/JPEG/WebP restrictions and 3 MB limit; **client-side writes are not granted**.
- `database/saas/73_phase5b_branding_rpc.sql`: service-only public RPC wrappers for the private SaaS schema, each verifying the passed actor's organization-specific access.

## Persistence and compatibility

The existing `saas.organization_settings` table is reused:
- `tagline`: string
- `logo_url`: HTTPS public object URL
- `accent_color`: primary brand hex value for legacy Academy entry-page compatibility
- `theme_palette`: JSON object with primary, secondary, accent, hover, soft, and foreground colors

Existing Academy entry-page lookup and previous branding RPCs remain unchanged. No second branding table or theme system was introduced. Phase 5B does not globally change authenticated UI themes.

## Permissions and security

Endpoints validate a bearer token with Supabase Auth, require an email-confirmed, non-anonymous user, and pass that verified actor ID to service-only database RPC functions. DB access requires an active organization with Academy entitlement and either active Platform Admin privileges or active Owner membership in **that exact organization**. Other roles receive no save/upload permissions. The four new RPCs explicitly revoke EXECUTE from PUBLIC, anon and authenticated; only service_role is granted.

The bucket permits public **reads** because academy entry-page logos are public; service-only server routes are the only intended upload path. No arbitrary server-side URL fetch is performed. Content-type is checked against leading image bytes. Logo files remain under organization-specific paths. New uploaded versions do not overwrite a currently published logo before Save succeeds.

**Important:** Uploaded images are public assets and should contain no personal/confidential material. Failed saves may leave temporary candidate images; the upload endpoint prunes stale candidates while retaining the current published image.

## DEV database verification

Migration `phase5b_public_tenant_logo_bucket` and `phase5b_tenant_branding_rpc` applied **only** to DEV project `uzzuquxeeqonxeqcuohh`. Direct SQL verified the bucket's MIME/size limits and that all new public RPC functions have EXECUTE disabled for anon/authenticated and enabled for service_role.

## Tests

**Certification update:** The browser workflow `.github/workflows/phase5b-branding-browser-qa.yml` exercises a route only enabled for dedicated development QA (`/qa-branding-preview`). All **8/8 Chromium scenarios passed** in run `44149518918`. Phase 5A and 5B source checks plus TypeScript and app regression checks passed in run `44149518991`. The DEV Owner authorization subtransaction passed and left no test data. 

Run `npm run test:branding-studio` and `npm run test:theme-foundation`. The Phase 5B branch runs these before TypeScript, Academy billing, authentication, canonical DB, CRM, Tasks and security source checks via `.github/workflows/qa-branch-static.yml`.

The palette unit tests use synthetic RGBA arrays (transparent/white, saturated multi-color, monochrome, invalid URLs and contrast). Source/contract tests check authorization and scoped preview. They do **not** simulate authentic uploaded photographic logos or authenticated browser interactions.

## Known limitations and Phase 5C requirements

- **Completed:** Eight Chromium interaction scenarios with synthetic auth and mocked HTTP API: save/reload, tenant switching, actual PNG Canvas extraction, corrupt-image rejection, denied writes, failed upload rollback, reset, and mobile layout (CI run `44149518918` PASS). These verify browser UI, not a real Supabase sign-in or Storage round trip.
- **Completed:** DEV database authorization tests with an existing non-Platform Admin actor and a temporary Academy Owner membership in a rollback-only PL/pgSQL subtransaction. Tested positive Owner access, denied non-owner and cross-tenant access, and save/read recovery. No test membership or branding persisted.
- **Pending for production acceptance:** End-to-end HTTP smoke using real DEV Supabase sessions, and an actual Supabase Storage upload and restore through the Next.js API.
- **Completed:** Playwright rendered the Branding Studio on desktop and 390px mobile widths, tested preview visibility and horizontal overflow. Full pixel-diff approval against design references was not performed.
- Remote URL extraction depends on the host allowing browser CORS; uploaded files are the reliable path.
- Image decode is browser-based; malformed image data can fail detection and display an error.
- Existing-logo storage management is bounded opportunistically; future production hardening can introduce scheduled orphan cleanup and image dimension/antivirus policy if required.
- Existing `/onboarding/branding` Academy Owner flow still exposes a legacy account-level setup contract elsewhere; Phase 5C should standardize organization choice, login/entry-page branding and tenant switch cache invalidation.
- Phase 5C must load only the approved tenant settings, apply scoped CSS design tokens and correct logo identity across Academy, CRM, Tasks, Suite, and customer login. Platform Admin remains corporate branded. Add authenticated tenant-isolation and visual regression tests.

**Release gate:** Phase 5B is implemented and automated source/browser-UI verified for continued DEV development. Production release still requires authenticated HTTP and actual Storage integration acceptance. Do not merge, modify PROD or deploy before those checks.
