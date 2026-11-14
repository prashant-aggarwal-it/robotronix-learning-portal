# Robotronix Education Suite — Phase 3E DEV Certification

**Date:** 2026-11-14
**Starting baseline:** Phase 3D commit `dc8f07a46a74953c2643cd58e7b395b6e19dec0b`
**Working branch:** `feature/education-suite-phase3e`
**DEV Supabase:** `uzzuquxeeqonxeqcuohh`
**PROD:** `njyktzenybimykpqaegn` — not modified

## Phase 3E objective

Enable multiple independent SaaS CRM↔Academy integrations concurrently while keeping Academy, CRM and Tasks modular and preventing cross-tenant access, tenant switching leaks, privilege escalation and stale-authority abuse.

## Implementation

- **Phase 3E-A, concurrent activation:** `database/saas/48_phase3e_multi_active_crm_portal.sql` creates actor-scoped `saas_crm_portal_install_v1` and replaces the globally unique active-status index with tenant-specific active indexing, after database guard installation. Mapped SaaS tenants require simultaneous active CRM and Academy admin rights. Legacy non-mapped CRM+Portal still permits only one legacy active installation and rejects SaaS actors attempting to use unmapped legacy tenants.
- **Phase 3E-B, per-request scope:** `database/saas/49_phase3e_crm_portal_access_scope.sql` revalidates active CRM membership, SaaS membership, Academy module entitlement and active installation administrator. `lib/server/connect-portal-access.ts` calls this on every CRM→Portal bridge request. Standalone fallback is permitted **only** when both new scope RPC and SaaS authorization RPC are absent. SaaS with missing scope RPC fails closed.
- **Phase 3E-C, direct legacy protection:** `database/saas/50_phase3e_guard_legacy_portal_installs.sql` adds a trigger enforcing mapped-tenant authority even for direct writes and older bridge RPC paths. The global unique index is dropped **after** the trigger is installed. The database guard rejects attempted cross-tenant installer impersonation.
- **Phase 3E-G, 3-customer E2E:** `database/saas/dev_only/09_phase3e_three_customers.sql` provides guarded synthetic third organization, CRM tenant, Tasks workspace, memberships and cleanup RPCs. The existing authenticated DEV runner now exercises three simultaneously active CRM↔Academy installations, isolated disable/re-enable, foreign-admin denial, context selection, and previous Phase 3A–3D workflows. DEV-only fixture excluded from release SQL.
- **DB packaging:** `scripts/build-phase3e-upgrade.mjs` emits ordered additive upgrade from canonical sources 48, 49, 50 without connecting to any database.
- **Modularity:** CRM, Tasks and Academy remain independent; no mandatory new cross-module foreign key, scheduler or UI coupling introduced.

## DEV migrations applied

- `phase3e_multi_active_crm_portal`
- `phase3e_crm_portal_access_scope`
- `phase3e_guard_legacy_portal_installs`
- `phase3e_dev_three_customers` (**DEV-only**)

## DB safety evidence

Rollback-contained DEV tests **PASSED**:
1. Three independent mapped organizations and CRM tenants active simultaneously.
2. Unauthorized customer A administrator cannot disable B.
3. Disabling B leaves A and C active.
4. Direct installer impersonation via a privileged database UPDATE is denied.
5. CRM→Portal foreign actor is denied.
6. Test fixture transaction rolled back, no persistent synthetic organization/customer rows.

## CI certification evidence

Existing Phase 3D baseline:
- Source: [43609349664](https://github.com/prashant-aggarwal-it/robotronix-learning-portal/actions/runs/43609349664) — PASS
- Authenticated DEV: [43609306438](https://github.com/prashant-aggarwal-it/robotronix-learning-portal/actions/runs/43609306438) — PASS (156+17 assertions)

Phase 3E code state (test jobs initiated):
- Source [43615228791](https://github.com/prashant-aggarwal-it/robotronix-learning-portal/actions/runs/43615228791): **pending result**
- Authenticated three-customer E2E [43615228732](https://github.com/prashant-aggarwal-it/robotronix-learning-portal/actions/runs/43615228732): **pending result**
- Earlier E2E [43615178653](https://github.com/prashant-aggarwal-it/robotronix-learning-portal/actions/runs/43615178653): in progress at last inspection

**Decision until final current-HEAD CI is observed: PARTIAL, NOT CERTIFIED.** Update this section only after examining the actual GitHub outcomes and correcting failures.

## Known limitations

- This DEV work proves parallel CRM↔Academy *integration activation*. It does not yet certify a complete three-customer live Zoom demo → parent onboarding → Academy enrollment → CRM Won workflow per customer. Existing Phase 3D E2E certified this lifecycle for one customer and module isolation across two.
- External Zoom, messaging/WhatsApp/email, Razorpay, Netlify scheduled jobs and retry recovery depend on live provider credentials and an approved deployment environment.
- DEV lacks pg_cron. Netlify currently defines zoom retention, zoom auto-reconcile, system-log retention, and CRM history drain schedules. Scheduler ownership gates are implemented via `schedulerCapabilityEnabled` and `netlifyJobOwned`.
- Browser UX across all standalone deployment profiles is covered by source/contracts and selected browser tests, not a complete live deployment matrix.
- No production, main or Netlify deployment authorized.

## Additional Phase 3E hardening and source verification

- Canonical `database/saas/51_phase3e_dual_module_entitlements.sql` applied to DEV. CRM→Academy integration installation, use and direct database-write guards now require both **CRM and Academy** module entitlements. Verified disabling CRM entitlement immediately denies access/activation.
- DEV-only Phase 3D CRM fixture canonical source corrected from duplicated malformed definitions, regenerated from actual valid installed functions; Phase 3E B/C admission fixture now supported and no DEV-only source is included in customer upgrade.
- Authenticated regression extended beyond three active connections to customer C Academy student/course/trainer/enrollment, and independent B/C CRM admission handoffs with tenant isolation.
- SQL rollback test passed after dual entitlement migration: three active integrations, denied CRM entitlement, rejected forged installer, B deactivation left A/C active; all rows rolled back.
- Source and strict TypeScript certification [43615868850](https://github.com/prashant-aggarwal-it/robotronix-learning-portal/actions/runs/43615868850): **SUCCESS** on `584271f7`.
- Latest three-customer authenticated run [43615868864](https://github.com/prashant-aggarwal-it/robotronix-learning-portal/actions/runs/43615868864) was pending at last inspection. This remains an explicit certification gate.
- Supabase DEV advisors still report 15 anonymously executable legacy SECURITY DEFINER helpers, 35 authenticated ones, and disabled leaked-password protection. They require release security review. Phase 3E functions themselves are service-role-only.
