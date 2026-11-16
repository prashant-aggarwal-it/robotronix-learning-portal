# Robotronix Education Suite — DEV Fresh Start: Master Installation Guide

**Scope:** DEV project `uzzuquxeeqonxeqcuohh` only. **NEVER** reset PROD `njyktzenybimykpqaegn`.

This is the operator checklist for a clean, repeatable **application** installation, not a Supabase project factory reset. It describes the repository's existing workflow; the six-file SQL Editor installer is **not yet live clean-install certified**. Do not interpret this guide as certification.

## Before starting

1. Confirm the Supabase dashboard URL contains DEV project ref `uzzuquxeeqonxeqcuohh`. Never run destructive steps on PROD.
2. Back up any DEV data you want to keep. Reset destroys application schemas/data. Confirm whether any Auth users or Storage files must also be removed.
3. From the repository root, select the intended branch and update your checkout:

   ```powershell
   git switch feature/education-suite-phase3g
   git pull
   npm install
   ```

4. Read `database/01_reset/README.md` and `database/02_install/README.md`. If the database is already empty from a successful reset, **skip reset**.

## 01 — Reset (ONLY when you want to discard existing DEV application data)

- Open `database/01_reset/01_dev_reset.sql`. It is guarded and intentionally refuses to execute until you explicitly edit the confirmation token **in your local copy**.
- Verify DEV project ID again in the dashboard; the SQL script cannot independently establish the project ref.
- Run the guarded script in the **DEV SQL Editor**, after deliberate confirmation.
- It drops `saas`, `ai`, `operations`, `tasks`, `connect`, and `public` application schemas and unschedules pg_cron jobs. **It does not reset Supabase-managed Auth, Storage, settings, or other possible application schemas**. Review remaining objects before installing.
- To remove DEV Auth users, use the separate `scripts/reset-dev-auth-users.mjs` Admin API workflow described in `01_reset/README.md`; it is dry-run by default. Review its configuration and output before permitting any deletion. Do not delete users by direct SQL.
- Clear Storage files/buckets through Supabase Storage tooling if your test requires empty Storage. Do not drop Supabase-managed schemas.
- Stop if the reset reports an error or if unexpected application schemas remain. Do **not** install over a partially reset database.

## 02 — Generate and run the six SQL Editor installation files

From repository root:

```powershell
npm run db:build-editor
```

This runs the generator configured in `package.json`. It writes the ordered SQL files and **generates** `database/02_install/sql_editor/ORDER.md`. The generated ORDER file may not be committed; this is normal.

**Open `database/02_install/sql_editor/ORDER.md` and follow its exact six-file order.** Do not infer filenames from this guide, and do not execute all files under `database/` or `supabase/migrations/`.

For each listed SQL file:
1. Confirm you are in DEV SQL Editor.
2. Execute the file completely and individually.
3. Confirm success before moving to the next.
4. **Stop at the first error.** Do not skip a failed chunk, resume blindly, or rerun the entire installer on a partially installed DB. Diagnose the failure and use a deliberate clean reset before retrying if necessary.

The consolidated installer includes Academy reference data. Do **not** separately rerun `database/03_reference/` sources.

## 03 — Verify schema installation (before adding users)

Run these read-only files individually in the DEV SQL Editor, in order:

1. `database/06_verify/01_academy.sql`
2. `database/06_verify/02_tasks.sql`
3. `database/06_verify/03_crm.sql`
4. `database/06_verify/04_saas_membership.sql`

Review returned checks, not just whether SQL executed. The SaaS membership file is **not** a substitute for cross-tenant isolation testing.

Optional local consistency check:

```powershell
node scripts/check-db-operator-layout.mjs
```

If the check fails or any script is absent, stop and investigate rather than assuming success.

## 04 — Create Auth users and tenant memberships

- Read `database/04_users/README.md`.
- Create the first owner via the app's `/signup` flow; create organization(s) through the application onboarding process.
- Use organization invitations and app onboarding for Admin, Trainer, Parent and Student roles. **Auth identity creation does not automatically grant SaaS organization membership.**
- For **optional DEV QA identities only**, use `npm run qa:create-users` after checking required private environment variables and the target DEV URL. Do not commit passwords or service-role credentials. This command does not assign tenant membership.
- Do not insert into `auth.users` directly.

## 04A — Platform Super Admin bootstrap (DEV only)

The canonical installer now includes `database/saas/59_platform_admin_foundation.sql` and `database/saas/60_platform_overview_rpc.sql`. For an already-installed DEV database, apply this additive migration once; both were applied to DEV on 16 November 2026.

1. Create or sign in to an existing **verified** non-anonymous Supabase Auth account. Do not insert into `auth.users` manually.
2. Obtain its exact Auth user UUID from the DEV Auth dashboard.
3. Set `SUPABASE_URL=https://uzzuquxeeqonxeqcuohh.supabase.co` and `SUPABASE_SERVICE_ROLE_KEY` in your local **private environment**, never source control.
4. Preview (no mutation):

   ```powershell
   node scripts/bootstrap-platform-admin.mjs --user-id YOUR_VERIFIED_AUTH_UUID
   ```

5. After reviewing the target and user, explicitly apply:

   ```powershell
   node scripts/bootstrap-platform-admin.mjs --user-id YOUR_VERIFIED_AUTH_UUID --apply --confirm uzzuquxeeqonxeqcuohh
   ```

The script refuses non-DEV URLs and unknown/unverified identities. It calls a service-only RPC, audits the first bootstrap and verifies the resulting authorization. A different second identity cannot be bootstrapped using this method. Administrator recovery and platform dashboard are **not yet implemented**; do not claim those features are operational.

## 05 — Optional DEV sample/test data

- Read `database/05_seed/README.md`.
- QA fixtures live under `database/portal/qa/`, `database/crm/qa/`, `database/tasks/qa/`, and `database/saas/dev_only/`.
- Only use fixture instructions that match the newly installed schema, and only **after** the required Auth users, organizations and memberships exist. There is **no verified one-command universal seed** documented here. You can skip this stage for an empty production-like starting state.
- Never seed PROD.

## 06 — Configure services and perform final QA

- Read `database/07_operations/README.md` and `docs/operations/SCHEDULED_JOBS.md`.
- Configure Supabase Auth providers/redirects, Storage, scheduled jobs, Zoom, Razorpay and external webhooks as required for the environment. These are **not** installed solely by SQL.
- Test app signup, organization creation, role onboarding, tenant isolation, and Academy/CRM/Tasks workflows using DEV identities. Do not claim full certification based only on the four read-only verification scripts.
- Record successful checks, failures, and any missing configuration.

## Quick checklist

- [ ] DEV project ref verified; backups reviewed
- [ ] Reset succeeded or database was already clean
- [ ] No unexpected Robotronix application schemas remain
- [ ] Six generated SQL files executed in the exact generated `ORDER.md` sequence
- [ ] Academy, Tasks, CRM and SaaS read-only checks reviewed
- [ ] Reference data present (bundled in installer)
- [ ] Owner signed up and organization created
- [ ] Role memberships/invitations configured
- [ ] Optional QA users and sample data configured, if needed
- [ ] External services configured as needed
- [ ] Tenant-isolation and end-to-end DEV tests passed

## Where to go for details

- `database/README.md` — canonical numbered-stage index
- `database/01_reset/README.md` — destructive reset and separate Auth-user cleanup
- `database/02_install/README.md` — installer generation and certification warning
- **Generated** `database/02_install/sql_editor/ORDER.md` — authoritative SQL chunk order
- `database/03_reference/README.md` — bundled master data
- `database/04_users/README.md` — Auth identities and memberships
- `database/05_seed/README.md` — optional fixtures
- `database/06_verify/README.md` — verification scripts
- `database/07_operations/README.md` — external services

**Current status:** This is a documented operator procedure. A complete reset → six-chunk install → users → data → QA execution still requires live DEV certification.

## Platform Admin implementation status (16 November 2026)

The branch contains the protected `/platform-admin` organization overview UI and `/api/platform-admin/overview` API. Both require a verified Supabase bearer token and service-only `saas_is_platform_admin_v1` authorization; the data RPC `saas_platform_overview_v1` independently checks the administrator identity. The overview is read-only, not the full customer-management control plane. It has **not** been browser E2E certified. No platform administrator has yet been bootstrapped in DEV.

Hybrid automatic trials, assisted onboarding, plan changes, platform-admin recovery, and billing lifecycle are still outstanding. Do not advertise these as implemented or production-ready.

## Hybrid onboarding migration (16 November 2026)

`database/saas/61_hybrid_onboarding.sql` was applied additively to DEV and is included in the source inventory for the canonical installer. It adds a service-controlled idempotency ledger and one atomic provisioning RPC for organization, verified Owner, organization type, 14-day trial subscription and requested module entitlement records.

Self-service entry: `/saas/start-trial` calls `POST /api/platform/onboard` with a verified signed-in user. Assisted entry: `/platform-admin` creates an organization for an **existing verified** Auth owner UUID using the same RPC, after independent Platform Admin authorization. Assisted invitations for users without an account, module-specific CRM/Tasks workspace linking, trial-expiry API enforcement and paid conversion are **not implemented**. Do not mistake entitlement rows for completed module workspace provisioning.

The new API and pages have not passed local TypeScript/build or live authenticated E2E testing. No platform administrator or tenant has been created in DEV by this change. Do not deploy before testing these prerequisites.

## Phase 4A — atomic tenant/module onboarding (16 November 2026)

For an **existing DEV** installation, apply the bounded additive migrations in order:

1. `database/saas/62_phase4a_atomic_modules.sql` — updates `saas_onboard_organization_v1` so the initial owner, trial, entitlements, CRM tenant/membership/link and Tasks account/workspace/membership/link are committed together. Adds an idempotency request fingerprint.
2. `database/saas/63_phase4a_close_legacy_signup.sql` — revokes the old unaudited two-step organization-creation RPC from authenticated users. The existing onboarding organization page now calls `POST /api/platform/onboard` instead.

Both migrations were applied successfully to the verified DEV project `uzzuquxeeqonxeqcuohh`. The fresh-install generator inventory now expects 63 numbered SaaS source files. Do not run the fresh-install bundle against populated DEV.

**Verified negative checks:** anonymous onboarding execute denied; authenticated legacy signup execute denied; authenticated unified onboarding execute granted; a no-session invocation raised insufficient privilege; no organization or onboarding request was created. **Live positive-path testing is blocked:** DEV currently has zero verified Auth accounts, and this procedure intentionally does not create fake Auth rows directly in PostgreSQL. To complete Phase 4A acceptance, register two verified DEV test users via Supabase Auth, sign in through the application, run academy and tutor onboarding with all modules, retry the same request key, test duplicate slugs, organization switching and cross-tenant denial. Record evidence and fix any failures before certifying. Build/typecheck and UI tests have not been executed through the connected tools.

**Boundary:** Phase 4A provisions linked workspaces and entitlements. Subscription-expiry enforcement and plan conversion belong to Phase 4C; this is not authorization to deploy the trial to customers before Phase 4C.

## Phase 4B — platform operations and owner handoff (16 November 2026)

Migration `database/saas/64_phase4b_platform_management.sql` was applied additively to DEV. The canonical SQL Editor generator now inventories 64 SaaS files. The new service-only RPCs support audited organization rename/suspend/activate, grant/revoke platform administrators (with final-active-admin guard), and email-bound owner invitation create, rotation/resend, revoke, list and one-time acceptance. Invitation tokens are 256-bit random values; only SHA-256 digests are stored in PostgreSQL. The owner must sign in with an existing verified Auth account whose confirmed email matches the invitation; acceptance is atomic and expires after seven days. Platform admin actions are routed through `/api/platform-admin/manage`, and owner acceptance through `/api/platform-owner-invite/accept`. UI lives at `/platform-admin` and `/platform-owner-invite`.

**Operator bootstrap:** The first verified DEV Auth user must be provisioned by supported Supabase Auth registration. Run `node scripts/bootstrap-platform-admin.mjs --user-id <verified-auth-uuid>` (dry run), then explicitly `--apply --confirm uzzuquxeeqonxeqcuohh`. Never bootstrap from public signup or user-editable metadata. Subsequent grants/revocations are available only to an existing authorized platform admin. If all administrators are lost, the service-role bootstrap operator procedure is the recovery boundary; do not expose it in the browser.

**Invitation delivery limitation:** The dashboard returns a secure, expiring, one-time link to be shared out of band; it **does not send email**. An SMTP/email provider integration must be added and tested before claiming automated invitation delivery. Resend currently rotates the secret and generates a fresh link, rather than sending an email. The link is returned once and not persisted in plaintext.

**DEV negative verification:** anonymous and authenticated roles cannot execute management or acceptance RPCs directly; the unauthenticated SQL calls were denied; no organizations, invitations or audit records were created. DEV still has no verified Auth users or platform administrators, so full authenticated browser/HTTP E2E and admin recovery exercises cannot yet run. TypeScript/build, real invite acceptance, resend, owner handoff, suspension and audit E2E are **not certified**. No PROD operations or deployments occurred.

## Phase 4C — subscription lifecycle and entitlement gate (16 November 2026)

Apply additive DEV migrations **in order**: `65_phase4c_subscription_lifecycle.sql`, `66_phase4c_module_workspace_guard.sql`, `67_phase4c_toggle_guard_correction.sql`. Migration 67 removes the temporary entitlement trigger from migration 66 because the existing atomic onboarding transaction inserts entitlements before CRM/Tasks links; the final guard runs **only** inside the authorized platform module-toggle RPC. All three migrations were applied to DEV. The SQL Editor installer source inventory expects 67 numbered SaaS files.

Subscription lifecycle API: `GET/POST /api/platform-admin/subscriptions`; Platform Admin UI: `/platform-admin`. Operations: trial extension (future date, capped at 90 days), manually activate a paid plan, mark past due, suspend, cancel, resume unexpired suspended/past-due plans, and enable/disable an already provisioned module. The management RPC requires an existing active Platform Super Admin and service role, with an immutable subscription-event history. **Manual paid-plan activation does not process or verify a payment.** There is no automated billing provider, scheduled expiration mutation, or automated renewal. Expiry is evaluated on every shared entitlement lookup, so a scheduled expiry job is not necessary for that gate. Past-due, suspended, cancelled, expired, missing-subscription and suspended-organization cases are denied through the shared module gate; no grace period is granted by default. The latest subscription event row is authoritative.

**Verification:** DEV migration execution passed; direct execute grants for anonymous/authenticated subscription management and module lookup are false; service role management is granted. A transaction-rolled-back database check verified that an expired trial denies access, an unexpired active plan grants access, and a subsequent suspended plan denies access. The test left no organization records. The workspace guard was confirmed installed in the management function, and the onboarding-blocking trigger was confirmed removed.

**Not certified:** Legacy Academy/CRM/Tasks APIs that do not call the shared SaaS entitlement gate may still bypass subscription expiry. This must be audited and corrected in Phase 4E before production. Authenticated E2E, UI/build/typecheck and payment integrations are not tested. No PROD operations were performed.

## Phase 4D — first tenant integration (16 November 2026)

Migration `database/saas/68_phase4d_first_tenant_integration.sql` was applied to DEV. It provides a service-only, audited tenant branding RPC requiring a real active organization with an active Owner and Academy entitlement; updates `saas_my_workspaces` to filter module availability and CRM/Tasks launch access by live subscription status; and filters public Academy branding by subscription access. The Platform Admin branding UI/API use this RPC. The existing organization onboarding page now routes directly to `/workspace` after atomic Phase 4A provisioning instead of invoking the obsolete second module-provisioning screen. The SQL Editor source inventory expects 68 numbered SaaS files.

**Actual first tenant remains pending:** DEV has zero verified Auth users and zero organizations. Do not fabricate auth users or hardcode privileged Robotronix tenant IDs. To complete the first-tenant acceptance, create/verify a DEV Auth user, bootstrap a Platform Super Admin using the documented DEV-only operator script, provision `Robotronix Academy` through the existing authenticated trial/assisted onboarding flow, configure branding in the Platform Admin UI, then verify Academy/CRM/Tasks, Trainer/Parent/Student role paths and cross-tenant isolation. There is no automatic migration of legacy production Academy data into DEV. The production tenant is untouched.

**Verified:** migration applied, anonymous/authenticated roles cannot invoke the privileged branding RPC, service role can. Authenticated browser and build/E2E verification remain pending; do not claim Phase 4D certification until completed.

## Phase 4E — security hardening and regression audit (16 November 2026)

DEV migration `database/saas/69_phase4e_subscription_bypass_hardening.sql` was committed and applied. It patches the existing mapped CRM Portal access/install RPCs and Academy family-access RPC to deny suspended, cancelled, past-due and expired SaaS subscriptions. It preserves the legacy unlinked CRM path but continues to prohibit SaaS users from using that fallback. Phase 4D already made workspace discovery and public Academy branding subscription-aware, and Phase 4C made shared module authorization subscription-aware.

**Executed DEV checks:** `database/saas/PHASE4E_SECURITY_GATE_READONLY.sql` passed, validating live subscription gates in six RPCs and non-public grants for privileged functions. Transaction-rolled-back tests passed for expired trial (denied), active unexpired subscription (allowed) and cancelled subscription (denied); no test tenant remains. DEV still has no verified Auth users and no organizations. No production database was touched.

**Repository regression contracts:** `npm run test:phase4e` runs `lib/server/saas/phase4e-subscription-security.test.mjs`. The test was committed but **not executed**: this session cannot run the private GitHub repository locally or dispatch an existing CI workflow. Run the Node test, `npm run typecheck`, `npm run build`, and existing SaaS/Playwright E2E checks in a configured DEV environment. Full API-route inventory, RLS cross-tenant testing with two authenticated tenants, Trainer/Parent/Student journeys, CRM/Tasks legacy endpoint enforcement, and actual first-tenant provisioning remain outstanding. Do not declare production certification from static SQL checks alone.
