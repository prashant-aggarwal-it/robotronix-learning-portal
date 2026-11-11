# Phase 7 — deployment configurations and isolation readiness

**Source status:** Implemented on `feature/modular-platform-architecture`. This is a deployment preparation phase, not a Netlify deployment or database migration.

## Deployment model

Use one repository and one compiled application per deployment site. Select exactly one profile from `config/deployment-profiles.json` (Portal, CRM, Tasks, Portal+CRM, Portal+Tasks, CRM+Tasks, full suite), then install its corresponding database package from `database/packages.json` into that site's chosen Supabase project.

Each **site** uses one Supabase Auth/project URL for both its public and server clients. Independent sites may point at separate Supabase projects. A *combined site* must use one shared Supabase project with the selected core and optional integration packages installed there. **Cross-project CRM↔Portal/Tasks synchronization, identity federation and data migration are not implemented** and must not be assumed. A user having the same email in separate projects does not confer shared identity or automatic data linkage.

## Create a non-secret template

```bash
npm run deployment:profile -- crm
npm run deployment:profile -- portal-tasks
npm run deployment:profile -- full-suite
```

For each new Netlify site, copy the displayed *variable names* and replace placeholders in the Netlify environment settings. Set `NEXT_PUBLIC_SITE_URL` to the site's real HTTPS origin, both Supabase URL variables to the same project's HTTPS origin, the public anon/publishable key only in `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and the service role key **only** in server-side `SUPABASE_SERVICE_ROLE_KEY`. Do not save credentials in git or reuse production keys for isolated staging.

`PRODUCT_MODE`, `ENABLED_PRODUCTS`, `ENABLED_INTEGRATIONS` and the database package must agree. Start with all optional workers disabled. Only enable individual workers after the corresponding schemas are installed, competing `pg_cron`/external schedules are retired, and `OPTIONAL_JOB_RUNNER=netlify` is deliberately selected. Existing Portal cron jobs are unchanged.

Before enabling Google OAuth, register each site's `/auth/callback` as an allowed redirect in its Supabase Auth project. Configure Google provider credentials, site URLs, allowed redirects and provider integrations independently. Any Zoom OAuth callback must point to the Portal-enabled site; no Zoom functionality is needed on standalone CRM/Tasks.

## Pre-deployment checks

Run from repository root:

```bash
npm run check:deployment-profiles
npm run check:modules
npm run check:auth
npm run check:backend-modules
npm run check:product-ui
npm run check:schedules
npm run typecheck
npm run build
```

After setting environment variables securely in a **new staging deployment context**, run `npm run check:deployment-env` as a deploy-time preflight. It checks explicit product mode, HTTPS origins, matching client/server Supabase URLs, presence of keys, accidental browser-visible service secrets, site URL, enabled-worker ownership and incompatible module flags. It reports error codes only; it neither prints keys nor contacts/changes the database. This check is intentionally not part of the existing legacy Portal build because its historic mode is unset.

The manual workflow `.github/workflows/modular-deployment-matrix.yml` builds all seven profiles without live secrets. This is build/route verification only, not authenticated application testing.

## Live staging acceptance (not yet performed)

1. Create one disposable Supabase project per independent staging site; install its canonical product package. For combined sites, use one disposable project containing both/all chosen products and only matching optional integration SQL.
2. Run database clean-install checks, RLS/role isolation tests, fresh account onboarding, OAuth login/logout, navigation, and authenticated API smoke tests for each profile. Verify unavailable modules return 404 and invalid server configuration fails closed.
3. In CRM+Tasks, test explicit linked task creation, permission revocation and status synchronization; in Portal+Tasks, ensure class links do not require CRM or duplicate class records; in CRM+Portal, test demo/admissions/lifecycle with no Tasks dependency.
4. Verify scheduler ownership using `cron.job`, deployed Netlify settings and function logs, then activate only required optional workers. Check for duplicated deliveries and job errors.
5. Verify responsive UI, OAuth redirect targets, webhooks, branded metadata and site domain/TLS. Record evidence and approve cutover separately.

**No action in Phase 7 changes `main`, production secrets, live cron schedules, Netlify sites, Supabase schemas or user data.** A later release phase must explicitly approve real staging/production provisioning and database execution.
