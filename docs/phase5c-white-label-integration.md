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

## UI consistency and first-paint guard
The shared TenantIdentity component renders a neutral loading placeholder instead of momentarily showing the Robotronix corporate logo while the selected tenant is being authenticated and resolved. Scoped navigation active states in Suite Home, CRM, Academy and Tasks use the saved primary/soft theme variables, preserving default corporate surfaces. This does not constitute a complete pixel-by-pixel audit or server-rendered tenant first paint; the current Supabase browser-local session means client authentication must occur before private branding can load.

## Real HTTP finding: privileged role claim compatibility
The first authenticated DEV integration discovered 403 on an otherwise valid synthetic Academy Owner's Branding Studio GET. The member and entitlement were correct in DEV SQL. Migration `phase5c_branding_service_claim_compat` replaces legacy per-claim `request.jwt.claim.role` checks with `auth.jwt()->>'role'` in three service-only branding entry functions, retaining explicit EXECUTE revocations, membership checks and service-role-only grants. Re-run real HTTP acceptance; do not infer a pass from SQL role impersonation alone.

## Latest DEV verification — 18 November 2026

GitHub commit `063ce4fc12294050932559384e8b437311af9cd5` passed all three available Phase 5C validation workflows:
- Source / typecheck / Phase 5A–5B regression / Next.js build: https://github.com/prashant-aggarwal-it/robotronix-learning-portal/actions/runs/44156791789
- Three Chromium synthetic browser scenarios (Suite organization switching, mobile viewport, CRM workspace branding isolation): https://github.com/prashant-aggarwal-it/robotronix-learning-portal/actions/runs/44156792084
- Real authenticated DEV HTTP/Storage roundtrip (synthetic Owner, real image upload, save/reload, unsigned/nonmember rejection, failed update rejection, restore): https://github.com/prashant-aggarwal-it/robotronix-learning-portal/actions/runs/44156791785

The real test exposed and resolved a legacy service-role claim compatibility defect. DEV migration `phase5c_branding_service_claim_compat` passed a post-install privileges check: the service-only functions have EXECUTE denied to `anon` and `authenticated`, and granted to `service_role`.

Two synthetic `phase5c-qa-*` DEV organizations were created by the test attempts. Their logo Storage objects were removed, and both organizations were individually verified as **archived** after testing. Their synthetic Owner accounts remain because the `guard_last_active_owner` trigger prevents deleting the sole Owner; this security trigger was **not** disabled or weakened. A deliberate, appropriately authorized cleanup migration would be needed for full physical deletion.

**DEV code/regression and real API acceptance: passed.** This is not a full white-label production sign-off. Remaining work includes cross-role authenticated browser acceptance (Parent/Trainer/Student and Google OAuth), complete legacy CSS/state visual audit, and organization-specific Tasks UI branding when the screen is scoped to a verified single shared workspace. The aggregated personal/connected Tasks view intentionally stays corporate to avoid attributing mixed-organization task data to one tenant. Application module switches still use a full reload to clear sensitive caches; Suite Home itself switches without a full reload. Production database and `main` remain unchanged.

## Organization-scoped Tasks identity
Normal personal Tasks and unscoped connected Tasks retain the corporate theme. For `/tasks/connected?suiteWorkspace=<id>`, Tasks verifies the requested workspace against its authenticated workspace membership response and filters visible tasks/workspaces/module links to that ID. The theme provider independently requires that the workspace be mapped to the selected Suite organization via the server-controlled organization-links API and checks the Tasks entitlement before applying tenant tokens. Invalid or mismatched IDs fail closed to corporate styling. No Tasks RLS permissions were changed.
