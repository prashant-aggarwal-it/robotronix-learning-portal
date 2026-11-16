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
