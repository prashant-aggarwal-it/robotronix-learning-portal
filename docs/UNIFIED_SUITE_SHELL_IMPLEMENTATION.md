# Unified Suite shell — implementation and safety boundaries

The shared suite landing route is `/suite`. It obtains signed-in product membership from `/api/platform/my-products`, and when SaaS organization membership exists, also checks `/api/platform/organizations` and `/api/platform/organization-modules`. Failure to verify the SaaS organization service results in an unavailable state; no SaaS entitlement is inferred.

The codebase retains its established Academy, CRM and Tasks shells, routes and within-module navigation. A shared `SuiteContextLink` provides consistent suite identity in existing headers; the shared `ApplicationSwitcher` provides module navigation. `suite-modules.ts` centralizes module names, icons, entitlement keys and future contextual navigation metadata. The `SuiteOrganizationSwitcher` is intentionally presented **only on Suite Home**, not in legacy Academy, CRM or Tasks screens. Changing SaaS organization currently does **not** switch the CRM tenant, Tasks workspace or legacy Academy query context.

## Not certified as multi-tenant

1. `lib/repository.ts` and legacy `app/admin/**` continue to use single-institution queries and legacy access policies. Organization selection must not be represented as scoping those routes.
2. CRM uses `connect.tenants` and its own workspaces. Do not assume a SaaS organization ID equals a CRM tenant ID. Verify `saas.legacy_tenant_links` and actual workspace membership before adding cross-module selection.
3. Tasks uses private user context and `tasks.workspaces`; do not automatically share personal tasks when selecting a SaaS organization. Verify `saas.workspace_links` and Tasks permissions before changing context.
4. Existing parent/student/trainer roles and standalone installations should preserve independent navigation. New navigation is not a substitute for API, RLS and business-logic authorization.
5. Module-availability metadata does not establish module installation or membership. `/api/platform/my-products` remains the authoritative legacy product admission endpoint; SaaS APIs verify membership and entitlements when available.

## Next engineering gates

- Add explicit SaaS-to-CRM and SaaS-to-Tasks mapping APIs with backend membership checks.
- Migrate legacy Academy data access and RLS for every tenant-owned table and feature, including finance, parents, classes and Zoom.
- Then enable organization scope inside each module, with all affected client caches reset on switch.
- Run real DEV user role E2E tests and cross-organization negative tests for each module, including direct requests and exports.
- Verify accessibility, responsive navigation, all seven modular deployment combinations and production-readiness checks on a single release-candidate commit.

No production database, customer data, main branch or deployment is changed by this UI integration.
