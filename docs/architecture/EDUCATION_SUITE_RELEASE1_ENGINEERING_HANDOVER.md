# Robotronix Education Suite v1.0 — Engineering Certification Handover

## Status

**Source-certified only, not database-installation-certified.**
This is the summary of the work on `feature/education-suite-release1`. The baseline branch `feature/portal-canonical-db-package` is preserved at `f7d77c9d37bcbb32a19ce4abea39cd638b2cc99e`.

**Safety boundaries:** Existing DEV `uzzuquxeeqonxeqcuohh` and PROD `njyktzenybimykpqaegn` were read-only/unmodified. No merge, release or deployment. No paid Supabase project was created.

## Existing, preserved canonical architecture

The product is **one integrated Education Suite** with existing `public` Academy/Finance/Zoom/Progress, `connect` CRM, `tasks` Tasks, and Supabase Auth. The schema currently consists of 167 tables. All existing tables remain. No 70-table rewrite, destructive migration or speculative entity consolidation is approved.

The existing canonical installers are defined in:
- `database/packages.json` — seven package configurations including `full-suite`
- `database/portal/manifest.json` — ordered Academy schema and reference sources
- `scripts/build-db-installers.mjs` — one-file generated package installers, with isolation guards
- `database/shared/integrations/01_crm_portal.sql`, `02_tasks_crm.sql`, `04_tasks_portal_notifications.sql`, `05_full_suite_task_links.sql` — optional integration contracts

**Important:** `database/packages.json` remains labelled `static-validation-only-not-clean-install-certified`, with `productionExecutionAllowed:false`. The platform additive foundation SQL is **not included or approved for installation** until identity/tenancy migration semantics and RLS pass an isolated test.

## What was implemented in this branch

1. `scripts/check-release1-db-preflight.mjs`: checks all seven package manifests/physical source paths, required integrations, baseline tables and the non-production certification state.
2. `scripts/check-release1-dynamic-db-targets.mjs`: enumerates source-defined target lists for dynamic Tasks collaboration, CRM ingestion, retention, CRM–Academy jobs and administrative alert routes. Explicitly retains the generic `invokeConnect` upstream actor/tenant call-graph limitation.
3. `scripts/check-release1-rpc-arguments.mjs`: conservative literal RPC argument-name comparison against DEV `pg_proc` signature snapshot; flagged ambiguities are tracked, not silently accepted.
4. `.github/workflows/db-dependency-inventory.yml`: enabled on new branch and publishes dependency, object-disposition, dynamic-target, package and signature evidence.
5. `.github/workflows/release1-source-certification.yml`: runs typecheck, full source release checks, security, actual canonical installer generator, package preflight and focused offline Playwright tests.

These changes validate and protect **existing** canonical SQL; they do not replace it with an unverified installer.

## Verified CI evidence

- GitHub Actions `Database dependency inventory` success for `c7bb34cc` and `b1b362b2`.
- GitHub Actions `Education Suite Release 1 source certification` passed at `21018dbb` and `daff89ec`, with typecheck, release source checks, security and package-generator preflight.
- The source-certification run `bae94f72` passed with the dynamic signature audit code present.
- - Latest targeted offline Playwright rerun on commit `2f047aa1` completed successfully: GitHub Actions run `43551387784`, including typecheck, source release suite, targeted finance/scheduling/form checks, security, canonical installer generation and preflight.
- Database dependency inventory on commit `08c86a24` completed successfully: run `43551233241`; 619 recognised literal DB calls had no missing names, 35 dynamic targets resolved, and 93 inline literal RPC argument-key checks matched their signature names.

Additional commits will require current-run verification; do not infer success from prior runs.

Generated SQL presence and package/marker checks are **static**. No isolated database execution, true RLS behavioural proof or payment/Zoom/CRM provider E2E proof occurred.

## Safe Release 1 architecture decisions

- Retain all old tables and RPC signatures during first launch. Physical schema migrations are only additive where essential and independently approved.
- `public.profiles.role` is global; `connect.memberships` belongs to CRM tenants; Tasks owns its own workspace roles. No silent unification into Platform memberships.
- CRM/Tasks service-role APIs derive actor identity via `auth.getUser(token)`; RPC implementation must then independently check actor and target scope.
- Payment receipts, invoices, attendance, trainer earnings and payroll require immutable historical semantics and idempotent retries.
- CRM opportunities are not equivalent to Academy enrolments; preserve consent and admission handoffs.
- Task ownership/privacy and CRM/Academy resource links need explicit tenant and assigned-trainer checks.
- Zoom, WhatsApp/Meta/email integrations and nine scheduled jobs require one active processor owner and replay-safe job execution.
- Future LMS, Assessments, Gamification, Certificates, AI, Operations and Analytics remain extensions, not Release 1 blockers.

## Remaining release gates — mandatory

| Gate | Evidence required | State |
|---|---|---|
| Full dynamic RPC upstream call graph | Complete `invokeConnect` actor/tenant authorization audit | Not certified |
| Function argument/default/result/error shape parity | All RPC variants + callers + granted roles | Partially audited |
| Full RLS and negative authorization | Authenticated tests for Admin/Trainer/Parent/Student, CRM and Tasks roles, cross-org denial | Not run |
| Full-suite clean-install | Apply `ROBOTRONIX_FULL_SUITE_FRESH_INSTALL.sql` to isolated Supabase with Auth, run verification SQL | Not run |
| Academy, CRM, Tasks lifecycle E2E | Admissions→enrollment→schedule→attendance→finance→follow-up | Not run against installed target |
| Provider regression | Zoom, Razorpay, WhatsApp/email real sandbox callbacks and retries | Not run |
| Backups and rollout rehearsal | Restore proof, schema/data reconciliation, rollback rehearsal | Not run |

No disposable Supabase project is present among accessible projects. The only two available projects are protected DEV and PROD. Do not create a potentially billable project without user approval.

## Next decision

Create/authorize a **cost-confirmed disposable Supabase project** or connect an already-created isolated test project. Apply the canonical full-suite SQL only there, then conduct role, finance, Zoom and CRM/Tasks integration E2E. **Do not approve installation on existing DEV until the clean-install, negative-security and parity gates pass.**

## Runbook — once isolated environment is available

1. Generate installer using `npm run db:build-installers` in a clean checkout of `feature/education-suite-release1`.
2. Snapshot its SHA, manifest hash and the generated `database/generated/ROBOTRONIX_FULL_SUITE_FRESH_INSTALL.sql`.
3. Confirm the target is disposable, correctly configured Supabase, with no existing application tables.
4. Execute the installer once, in its generated order, only in that disposable database.
5. Run `database/portal/verify.sql`, `database/tasks/04_verify.sql`, `database/crm/04_verify.sql`, plus `database/audit/verify_release1_contracts_readonly.sql`.
6. Record every failure and fix the canonical source, regenerate, reinstall from a **new clean isolated database** or controlled disposal/rebuild.
7. Run role-negative tests, integration replay tests, full application E2E and data invariant tests.
8. Present actual pass/fail evidence and a tested recovery strategy before requesting DEV installation approval.

Do not run any of these installation commands on existing DEV or production.
