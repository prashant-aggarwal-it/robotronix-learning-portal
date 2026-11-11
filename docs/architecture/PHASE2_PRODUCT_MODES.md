# Phase 2 — Product modes and deployment capability registry

**Branch:** `feature/modular-platform-architecture`  
**Status:** Implemented in source; requires CI/local test execution and isolated deployment verification before merge.

Phase 2 establishes **deployment-scoped availability**, not user subscription entitlement, standalone authentication, or proof that a database schema is installed. The application stays a single Next.js repository; do not split it into three copies.

## Configuration

| Variable | Allowed | Behavior |
|---|---|---|
| `PRODUCT_MODE` | `portal`, `crm`, `tasks`, `combined` | Chooses standalone product or combined mode |
| `ENABLED_PRODUCTS` | Comma-separated `portal,crm,tasks` | Optional for combined; defaults to all products in combined |
| `ENABLED_INTEGRATIONS` | Comma-separated `crmPortal,crmTasks,portalTasks` | Explicit optional installation of cross-product interfaces |

All fields are **server-side**. Do not expose secrets to browser configuration.

- When `PRODUCT_MODE` is **omitted**, the existing combined application's legacy route surface remains available. This compatibility default prevents silent regressions in the current Portal deployment, which already carries combined-app links.
- For an **explicit** `PRODUCT_MODE`, integrations default to **off** until explicitly selected after the corresponding SQL is installed and tested.
- In a **standalone** mode, `ENABLED_PRODUCTS` may be omitted or may contain only that product.
- Invalid IDs, conflicting combinations, duplicates and blank allowlists **fail closed** with configuration errors.
- `crmPortal` requires CRM+Portal; `crmTasks` requires CRM+Tasks; `portalTasks` requires Portal+Tasks.
- **No new scheduler flags are enabled by this phase.** Database/package installation and module runtime activation remain separate.

### Examples

**Legacy existing deployment (no change):**
```env
# Leave PRODUCT_MODE/ENABLED_PRODUCTS/ENABLED_INTEGRATIONS unset
```

**Portal only:**
```env
PRODUCT_MODE=portal
```

**CRM only:**
```env
PRODUCT_MODE=crm
```

**Tasks only:**
```env
PRODUCT_MODE=tasks
```

**CRM + Tasks:**
```env
PRODUCT_MODE=combined
ENABLED_PRODUCTS=crm,tasks
ENABLED_INTEGRATIONS=crmTasks
```

**Portal + CRM:**
```env
PRODUCT_MODE=combined
ENABLED_PRODUCTS=portal,crm
ENABLED_INTEGRATIONS=crmPortal
```

**Complete suite (only after all core + integration SQL is installed):**
```env
PRODUCT_MODE=combined
ENABLED_PRODUCTS=portal,crm,tasks
ENABLED_INTEGRATIONS=crmPortal,crmTasks,portalTasks
```

## Implemented files

| File | Purpose |
|---|---|
| `lib/platform/deployment.ts` | Validated mode and product/integration capability registry; pure route eligibility calculation |
| `proxy.ts` | Next.js 16 request-level availability guard: disabled product pages return 404; disabled APIs return JSON 404; invalid config returns 503 |
| `app/api/platform/capabilities/route.ts` | Public, no-cache deployment capability discovery, with no secrets or user entitlements |
| `lib/platform/deployment.test.mjs` | Package matrix, legacy compatibility, strict configuration, shared routes and integration routing tests |
| `package.json` and `scripts/check-release-all.mjs` | `npm run check:modules` wired into release static checks |
| `.env.example` | Opt-in mode variables and safe defaults documented |

The default landing `/` redirects to `/connect` or `/tasks` for standalone deployments without the Portal. **The shared login, OAuth callback and app switcher are intentionally not refactored until Phases 3/5.** They can still mention or attempt Portal-specific flows; this phase does **not** certify standalone app journeys.

### Route boundaries

- `/connect/**` and `/api/connect/**` are CRM, except Portal demo/admissions/lifecycle endpoints, which require `crmPortal`.
- `/tasks/**` and `/api/tasks/**` are Tasks, except Tasks CRM link views/endpoints, which require `crmTasks`.
- Portal administration, student, trainer, parent, Zoom, finance and remaining Portal API paths require `portal`.
- `/login`, `/auth/callback`, `/api/health` and `/api/platform/capabilities` are shared routes. Shared login is a Phase 3 blocker.
- Static images/assets are shared. The proxy does not expose module-specific APIs through paths containing periods.

**Security note:** Next.js Proxy cannot substitute for authorization. Phase 4 must explicitly enforce deployment access, tenant membership, user subscription and role inside every API handler and cross-product service, including signed/server-side actions. Netlify workers execute outside Proxy, controlled by their own server-side enable flags.

## Acceptance tests

```bash
npm ci
npm run check:modules
npm run typecheck
npm run check:release
```

`check:modules` tests Portal-only, CRM-only, Tasks-only, CRM+Tasks, Portal+CRM, Portal+Tasks and full suite; it also checks invalid settings and the unconfigured legacy default.

Test actual Next.js builds and API HTTP responses with isolated dummy projects before claiming the standalone applications work. Do not run on production or turn on product integration flags prematurely.

## Remaining work, not Phase 2

- **Phase 3:** standalone Tasks/CRM authentication, Portal `profiles` dependencies, onboarding and OAuth redirect flows.
- **Phase 4:** authoritative per-API protection; no reliance on Proxy alone; graceful optional RPC handling.
- **Phase 5:** product-specific shell, branding, subscription-aware navigation and application switcher.
- **Phase 6:** integration contracts, live scheduler activation, health and job logs.
- **Phase 7/8:** independent hosting/build validation, clean SQL installs and full regression QA.

**Do not merge into main, deploy, reset databases or enable cron in production without explicit approval.**
