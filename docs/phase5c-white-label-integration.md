# Phase 5C — Tenant-wide white-label integration (DEV progress)

**Branch:** `feature/education-suite-phase5c-white-label-integration`  
**Baseline:** Phase 5B commit `00ed6244fd188e98913793b0d5dda67bf9064fea`

## Implemented
- `database/saas/74_phase5c_branding_view.sql` adds a service-only, active-member, actor-checked read RPC for organization identity and saved branding. It does not grant anonymous or authenticated roles direct EXECUTE.
- `app/api/tenant-branding/route.ts` verifies a real bearer user, validates organization UUID, and uses the actor-scoped RPC. Private responses are `no-store`.
- `lib/theme/tenant-runtime.ts` normalizes saved colors via Phase 5A tokens and provides safe logo fallbacks.
- `TenantBrandingProvider` applies a scoped theme to authenticated tenant screens; corporate Platform Admin, login, registration, QA, and personal Tasks screens keep corporate defaults. Login has its own narrowly scoped approved-public Academy branding.
- Shared Academy role shell uses `TenantIdentity`. Suite Home, CRM sidebar and organization-connected Tasks include identity integration.
- Phase 5B Branding Studio emits `robotronix:branding-saved` after a successful database save; provider refetches the selected organization. Unsaved Studio preview remains isolated.
- CRM and connected Tasks inherit organization semantic token overrides. Personal Tasks intentionally keep corporate styling and their original authorization model.

## DEV verification
- Migration `phase5c_branding_member_read` applied to project `uzzuquxeeqonxeqcuohh` only.
- Read-only grant inspection: anon=false, authenticated=false, service_role=true for `public.saas_branding_view_v1(uuid,uuid)`.
- Rollback-only SQL tested a current active member's authorized read and denial to a synthetic nonmember actor: both passed.
- GitHub Phase 5C workflow validates TypeScript, Phase 5A and Phase 5B tests, Phase 5C source contracts and the Next.js build. Use the **latest** branch commit result, not earlier intermediary results, for release qualification.
- No production Supabase changes, main merge, or Netlify deployment.

## Remaining work / certification gate
**Phase 5C is PARTIAL until these pass:**
1. Actual authenticated DEV Owner, Trainer, Parent and Student HTTP response tests plus real Storage upload/reload/rollback against running DEV Next.js.
2. Complete page-by-page audit of hardcoded Academy/CRM/Tasks visual colors, active states and logo instances, including all CRM and Tasks subviews.
3. Playwright multi-organization switching, race conditions, browser back/forward, desktop/mobile rendering, login OAuth return, and theme flash/hydration checks.
4. Verify CRM workspace-to-selected-SaaS-org correspondence and org-connected Tasks workspace selection before applying corporate-level organization brand throughout nested workspaces. A selected SaaS org is not automatically the active CRM tenant.
5. Confirm zero full-reload switching can safely replace the current hard-reload mechanism without retaining stale module state; currently it deliberately reloads to flush module-specific caches.
6. Validate accessibility/contrast and production security audit with real credentials and full regression gates; certify only when checks succeed.

## Scope and design notes
- The authoritative organization context remains the server-revalidated organization-discovery API and independent module access checks.
- A branding lookup is not proof of CRM or Tasks workspace access.
- Branding changes do not alter RLS, organization membership, module entitlements or finance data.
- Tenant-branded login uses the existing public `saas_public_academy_brand` RPC scoped to a known Academy slug, not the private member branding API.
- This branch is for DEV development only. Do **not** promote to production until the remaining acceptance gates are closed.

## Tenant linkage safety improvement
The CRM theme now requires the Suite organization's CRM entitlement, a membership-checked `organization-links` mapping, and an active CRM tenant ID emitted by the CRM page. A mismatch deliberately shows corporate branding rather than attributing one tenant's data to another tenant's identity. Connected Tasks remains corporate for now because its aggregated list can include tasks from more than one workspace. Branding that aggregated view as one organization would be misleading. The existing full reload on organization change is deliberately retained until underlying module caches and record subscriptions are proven safe to reuse without a reload.

## Safe Suite-only organization switch
Suite Home now listens to the existing server-validated organization-switch event and refetches module entitlements/mappings without forcing a browser reload. Academy, CRM, and Tasks preserve their full reload because those modules manage potentially sensitive in-memory and subscription caches. The theme provider clears its old snapshot and uses a route-context discriminator so a previous module's tenant identity cannot render during a route transition.

## DEV HTTP integration harness
A real DEV-only HTTP and Storage acceptance script is at `scripts/qa-phase5c-live.mjs`. The dedicated CI workflow runs only on manual dispatch or a commit explicitly tagged `[live-dev]`, requires three E2E Supabase CI secrets, verifies the exact DEV project ref, uses disposable authenticated actors and a synthetic organization, and tests actual Next.js Owner/foreign-user APIs, Storage image upload, save/read, rejected writes and restoration. It deletes its uploaded logo and attempts to delete test actors. A synthetic DEV organization may remain for deliberate safe database cleanup; do not run it against customer data. A missing secret or failing test is an acceptance blocker, not a pass.
