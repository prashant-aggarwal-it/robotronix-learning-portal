# Phase 4 — Backend module isolation and API permission boundaries

**Branch:** `feature/modular-platform-architecture`  
**Status:** Implemented in source; requires real authenticated, empty-DB and tenant-isolation QA before deployment. No merge, database mutation or production deployment.

## What Phase 4 enforces

1. **Deployment-level availability is checked server-side, not only via frontend/Next Proxy.** `lib/platform/server-access.ts` validates `PRODUCT_MODE`, `ENABLED_PRODUCTS` and `ENABLED_INTEGRATIONS`; invalid configurations return 503; excluded products/integrations return 404. Checks rely on server environment, never client headers or self-declared subscriptions.
2. **Core CRM REST APIs** rely on `lib/server/connect-auth.ts::connectSession`, which now checks the requested product route **before** verifying the user JWT. Business RPC handlers pass the verified Supabase Auth user's ID (`actorId`) to tenant-membership-checked CRM SQL functions. Existing service-role keys remain server only.
3. **Core Tasks REST APIs** rely on `lib/server/tasks/auth.ts::taskSession`, which now checks route availability before authentication and the `tasks.accounts` active/suspended state. `app/api/tasks/onboarding/route.ts` independently checks availability, because it intentionally handles users without active Tasks accounts.
4. **Portal admin/helper APIs** using `lib/server/portal-api.ts::requirePortalUser` now also check deployment availability before Portal profile/role reads. Other existing Portal routes are isolated by the Next.js `proxy.ts` product boundary; their existing signed-token, role, webhook-signature and cron-secret checks must remain intact.
5. **Optional CRM–Portal APIs** check `crmPortal` before invoking `connect_portal_demo_bridge`/admissions/Portal handoff SQL. The shared `portalBridgeAccess` checks workspace membership and blocks viewer writes. A missing integration RPC is reported as unavailable, not a generic permission denial.
6. **Tasks product links** check `crmTasks` before optional link RPCs and `portalTasks` for learning-specific link resources. A Tasks-only install has no obligation to install any of these functions.
7. **Ingress paths** for Meta webhook GET/POST, Resend email inbound, CRM public form POST/OPTIONS, WhatsApp history processing and the old combined reminder route explicitly check CRM capability. Existing HMAC/signature/token, CORS, request limits and idempotency must remain active; a module flag is not an authorization mechanism.
8. **Scheduled workers** verify capability for the owning product or integration in addition to their feature flags. All 9 existing worker entrypoints are covered: five Portal, two CRM, one Tasks and one CRM–Portal. The helper lives at `lib/platform/scheduler-capabilities.mjs`, outside Netlify's auto-deployed `netlify/functions` folder. Worker/module parity is tested against the canonical TypeScript registry.

## Boundary matrix

| Installation | Portal APIs/jobs | CRM APIs/jobs | Tasks APIs/jobs | CRM–Portal jobs / admission APIs | CRM–Tasks links |
|---|---|---|---|---|---|
| Portal only | Enabled | Disabled | Disabled | Disabled | Disabled |
| CRM only | Disabled | Enabled | Disabled | Disabled | Disabled |
| Tasks only | Disabled | Disabled | Enabled | Disabled | Disabled |
| CRM + Tasks | Disabled | Enabled | Enabled | Disabled | Enabled when integration installed |
| Portal + CRM | Enabled | Enabled | Disabled | Enabled when integration installed | Disabled |
| Portal + Tasks | Enabled | Disabled | Enabled | Disabled | Disabled |
| Full suite | Enabled | Enabled | Enabled | Enabled when integration installed | Enabled when integration installed |

**Compatibility:** When `PRODUCT_MODE` is **unset**, the existing combined route surface is preserved, including its existing service-role jobs and any installed features. This does **not** prove every optional SQL module exists. Explicit product modes should only be activated after installing the corresponding SQL package.

## Verification and regression gates

```bash
npm run check:modules
npm run check:auth
npm run check:backend-modules
npm run check:schedules
npm run typecheck
npm run build
```

`check:backend-modules` asserts:
- All **45 CRM** and **26 Tasks** API routes use either the common verified session helper or explicit module/bridge protection; new unguarded module routes fail CI.
- Direct server API checks and Netlify worker checks return consistent results for all seven customer module combinations, plus the legacy default.
- Invalid configurations fail closed.
- Admission bridges, Tasks link RPCs, webhook routes and scheduled functions have independent checks.

The modular feature-branch CI runs these tests, TypeScript and a Portal-compatible build. **Static source/tests are not a substitute for exercising the actual deployed endpoints.**

## Ownership and security decisions

- Portal identity/role is managed by Portal tables; a CRM or Tasks account grants **no Portal admin rights**.
- CRM is multi-tenant: `connect.memberships` and SQL RPC actor/tenant validation are the business authorization authority. The server must pass the verified `auth.getUser` user ID, never an actor ID supplied by the browser.
- Tasks is account/task/workspace scoped. `tasks.accounts`, task access checks and workspace/collaboration RPCs are the authority.
- Product flags describe **which modules are deployed**, not individual customer subscriptions. **Commercial per-tenant entitlements, plans and product subscriptions are not implemented by these flags.** Add subscription enforcement when billing/entitlement source-of-truth exists; do not claim entitlement-based billing security yet.
- For separate Supabase projects, bearer tokens must be verified against **that product's** Auth issuer and records. Cross-project APIs require explicit scoped service contracts; reusing a user ID or bearer token is not an integration architecture.
- Disabled modules must not run background jobs. Keep overlapping DEV `pg_cron` and Netlify CRM jobs off during cutover.

## Remaining deployment gates

1. Clean-install CRM-only and Tasks-only databases and run actual signed user journeys (signup, confirmation, workspace creation/invitation, Tasks activation).
2. Attempt cross-tenant access and forged resource IDs; verify denial by business RPCs.
3. Verify disabled product endpoints return 404 in a running standalone app (GET/POST/webhooks) and unrelated jobs remain inactive.
4. Validate webhook HMAC/signature, JWT expiration, Portal disabled-account behavior and readonly role enforcement.
5. Confirm optional integration is gracefully absent and present only with its SQL package.
6. Complete Phase 5 independent shell/navigation, Phase 6 integration/runtime checks, Phase 7 deployment configuration and Phase 8 full-suite/production QA.

**Never merge into main, activate cron, execute SQL in production or deploy until explicitly approved.**
