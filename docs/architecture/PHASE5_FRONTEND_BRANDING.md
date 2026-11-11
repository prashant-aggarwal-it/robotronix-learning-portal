# Phase 5 — Product-specific frontend, navigation and branding

**Branch:** `feature/modular-platform-architecture`  
**Status:** Implemented in source; automated test/build results and isolated app E2E still gate release. No changes to `main`, production databases, Netlify configuration or scheduled jobs.

## Objective

One codebase, three distinct product experiences. A Portal-only site should not advertise CRM/Tasks; CRM-only and Tasks-only sites should open their respective app and not inherit Learning Portal metadata. Combined installations should let each signed-in user switch only to products for which they actually have product-level access. Keep existing Portal, CRM and Tasks views, workflow routes and features.

## Implemented changes

| Source file | Function |
|---|---|
| `lib/platform/branding.ts` | Canonical name, metadata description, landing page by validated product mode; original Portal naming is retained when no mode is explicitly configured |
| `app/layout.tsx` | Deployment-aware root metadata and generic database configuration fallback; Portal canonical base URL is retained only for Portal-branded installation |
| `app/api/platform/my-products/route.ts` | Protected, no-cache, server-only product navigation list based on a validated bearer token **and** active Portal role, CRM workspace membership or active Tasks account |
| `lib/platform/deployment.ts` | Declare the signed-in product-navigation endpoint a shared route available in every deployment |
| `lib/platform/use-authorized-products.ts` | Browser UI hook fetches server-authenticated navigation, fails closed and refreshes when Auth session changes; no service role credentials shipped to browser |
| `components/ApplicationSwitcher.tsx` | Shows **only** authorized installed products; hides itself for a single available product. Portal target uses the actual role path, not an assumed `/admin` route |
| `features/connect/ConnectSidebar.tsx` | Connect switcher appears for authorised multi-product users even when Portal isn't installed (e.g. CRM+Tasks) |
| `components/AppShell.tsx` | Removes existing Portal sidebar `My Tasks` shortcuts when the signed-in account lacks Tasks access |
| `features/tasks/v2/TasksV2Connected.tsx` | Loads Portal profile only when both Portal and Portal–Tasks integration are enabled |
| `lib/platform/product-ui.test.mjs` | Metadata, role-aware navigation, switcher and Portal-free Tasks route regression checks |
| `package.json`, CI/release scripts | `check:product-ui` included in modular-branch Actions and release-gate scripts |

## Product/navigation matrix

| Deployment | Branding / landing | Navigation for a valid signed-in user |
|---|---|---|
| Legacy combined (no `PRODUCT_MODE`) | Existing Robotronix Learning Portal at `/` | Only products for which account-level access is verified |
| Portal only | Robotronix Learning Portal at `/` | Portal role menus; no CRM or Tasks links |
| CRM only | Connect CRM; standalone `/` redirects to `/connect` | CRM menus only |
| Tasks only | My Tasks; standalone `/` redirects to `/tasks` | Tasks menus only |
| CRM + Tasks | Robotronix Workspace; `/` redirects to `/connect` | CRM/Tasks switch when authorized for both |
| Portal + CRM | Robotronix Workspace at `/` | Portal/CRM switch for authorized users |
| Portal + Tasks | Robotronix Workspace at `/` | Portal/Tasks switch for authorized users |
| Full suite | Robotronix Workspace at `/` | Only subscribed/authorized products present on this installation |

**Important qualification:** `PRODUCT_MODE` and `ENABLED_PRODUCTS` describe installed products. `/api/platform/my-products` checks existing Portal roles, CRM membership and Tasks account state. It does **not** implement paid billing subscriptions. Business APIs must continue to enforce membership/role permissions independently; hiding a link is not security.

## Security and compatibility

- The navigation endpoint verifies the Supabase access token server-side via `auth.getUser`, and checks access to each enabled module against its own database records.
- The endpoint does not return service-role keys or privileged records. Disabled legacy Portal users receive no cross-app navigation.
- The browser UI starts with **no external links** until access is verified and clears links on sign-out or failed verification.
- CRM-only / Tasks-only deployments never query Portal profiles through the switcher.
- Empty/unlinked CRM or Tasks accounts can use their own onboarding UIs; no broad cross-product access is granted automatically.
- Existing business pages, forms, filters, task boards, reminders, Zoom, finance and message handling have not been redesigned or deleted.
- OAuth and login are Phase 3 features; Phase 5 updates product-level navigation and metadata, not authentication policies.

## QA and deployment checklist

```bash
npm run check:modules
npm run check:auth
npm run check:backend-modules
npm run check:product-ui
npm run check:schedules
npm run typecheck
npm run build
```

Before merging or shipping:
1. In an isolated Portal-only site: verify four Portal roles, role menus, disabled account, logout, no visible CRM/Tasks links, existing classes/Zoom/finance views.
2. In CRM-only with a real clean CRM schema: confirm root/metadata/login, workspace onboarding, CRM navigation, no Portal SQL reads or Portal links.
3. In Tasks-only with clean Tasks schema: confirm root/metadata/login, welcome onboarding, Tasks navigation, no Portal profile dependency or CRM links.
4. In CRM+Tasks: verify authorized cross-app switch in both directions; deny navigation and direct API access for missing membership or suspended Tasks accounts.
5. In Portal+CRM, Portal+Tasks and full suite: verify Portal role-specific switch targets and product-specific menus.
6. Verify responsive mobile sidebar, keyboard navigation, focus order, browser refresh and auth state changes.
7. Confirm production Netlify build variables and domain-specific OAuth callbacks. Browser smoke/E2E tests are **not** replaced by static CI.
8. No merge, deploy or production DB alterations without explicit user approval.

## Next phase

Phase 6: complete optional integrations and job activation contracts (CRM–Portal, CRM–Tasks, Portal–Tasks), then Phase 7 deployment configurations and Phase 8 isolated full QA/rollout.
