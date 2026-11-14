# Robotronix Education Suite — Release 1 DB preparation, installation gates and rollback

**State:** NO EXECUTION AUTHORIZED. No DEV or production changes permitted by this document.

## Current source of truth

- Repository: `prashant-aggarwal-it/robotronix-learning-portal`
- Feature branch: `feature/portal-canonical-db-package`
- DEV: `uzzuquxeeqonxeqcuohh`; PROD must be untouched.
- Existing canonical installer manifest: `database/packages.json`, `database/portal/manifest.json`.
- Canonical packages are marked `static-validation-only-not-clean-install-certified` and `productionExecutionAllowed:false`.
- `database/platform/01_additive_foundation.sql` is **a candidate** and must not silently be inserted into the package chain.
- The old 70-table redesign is abandoned.

## Architecture constraints

1. **One Education Suite:** CRM, Academy and Tasks must ship as integrated customer experience; separation is internal engineering hygiene, not independent sales packaging.
2. Existing objects remain intact until exact compatibility and data reconciliation are demonstrated.
3. Do not introduce standalone-product-dependent privileges into organisation subscriptions.
4. Multi-organisation tenancy must not convert the global `public.profiles.role` into a trusted per-organisation decision without migration tests.
5. `connect.tenants`, `tasks.workspaces` and target `platform.organizations` are **not automatically equivalent**.

## Engineering gates in order

### Gate A — Static/catalog compatibility (automated; existing state)

- `node scripts/inventory-db-callers.mjs artifacts/db-call-inventory`
- `node scripts/check-db-catalog-compatibility.mjs artifacts/db-compatibility`
- `node scripts/export-db-disposition-register.mjs artifacts/db-object-dispositions`
- `npm run check:deployment-profiles`, `npm run check:modules`, `npm run check:auth`, `npm run check:backend-modules`
- Security and release workflows must pass with their actual checks intact.
- Outputs are baseline compatibility evidence only, not runtime proof.

### Gate B — Exact contracts

- Link every source RPC to the PostgreSQL signature (parameter names, defaults, return type and SQLSTATE), with dynamic call allowlists explicitly resolved.
- Audit all `SECURITY DEFINER` functions for privileges/search_path and every service-role RPC for actor/tenant validation.
- Trace all 92 trigger side effects and nine scheduled jobs, especially Tasks/CRM synchronization, admission conversion and payroll.
- For any change, regenerate object/caller map and ensure there are no unresolved references.

### Gate C — Isolated full-suite clean-install

Create a **new disposable Supabase project or local PostgreSQL/Supabase environment** separate from DEV/PROD. Supply safe test credentials via secrets, not source. Confirm the exact installation order generated from the canonical manifests; apply it only in disposable environment. Prove all expected objects and functions exist; run RLS and role-negative tests with real authenticated claims.

If clean-install fails, fix the canonical package (not the production database), repeat the test, and keep the failure evidence.

### Gate D — Feature parity

E2E workflows must cover:
- Admin/Trainer/Parent/Student and CRM organisation-role access including cross-tenant denial.
- Enquiry → demo → approval → onboarding → enrollment → schedule → attendance → progress.
- Billing: upfront, prepaid blocks, rolling monthly, partial payment, international currency, webhook replay, receipt numbering and trainer payroll.
- Tasks privacy, collaboration, delegated assignment, CRM links and follow-up idempotency.
- Zoom host allocation, recording visibility, retention, provisioning and retries.
- WhatsApp Business/API, email/Meta webhook signatures, consent, deduplication and job retry.
- Existing quizzes, XP and learner projects without new data duplication.

### Gate E — DEV installation approval

Only when Gates A–D pass and the user explicitly approves DEV installation:
1. Capture a current DEV backup and test restore into a separate environment.
2. Record catalog hash/object count and non-sensitive application fixture checksums.
3. Choose **fresh isolated DEV install versus in-place additive migration**; do not mix them.
4. Apply only the approved, versioned SQL with a recorded installer version.
5. Run negative auth tests and E2E workflows after installation.
6. Revert with tested restoration plan on regressions; do not make ad hoc repair writes.

### Gate F — PROD decision

Separate explicit user approval required. Produce signed-off schema/data diff, migration dry run, downtime estimate if any, backup/restore validation, rollback rehearsal, user acceptance and monitoring plan. Execute nothing implicitly.

## Immediate product release priority

Release 1: CRM (lead-to-admission), Academy (student-to-class delivery), Tasks (personal/team + followups), supported by existing Finance, Zoom, Communications and learning progress. Avoid release-blocking advanced LMS/gamification/AI implementation.

Release 2: advanced LMS, assessment, gamification, certificates, analytics.
Release 3: AI agents, operations/multi-branch and advanced automation.

## Known verification limits

- Static checks show object name presence; no clean-install certificate.
- No executing DEV schema changes while audit approval is pending.
- Full RLS/policy behavioral tests require an isolated database with authenticated identities.
- No claim of 100% feature parity until the complete parity suite is executed.

## Rollback policy

**Before any deployment:** snapshot/restore both schema and user data; record application commit/tag, database version and feature flags; verify webhook and cron replay safety. Prefer feature flags and compatibility adapters for reversible application changes. Destructive table/column changes require separate signed-off data preservation and backward-compatibility decisions.
