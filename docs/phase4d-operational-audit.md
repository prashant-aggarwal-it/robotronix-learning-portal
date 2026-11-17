# Phase 4D — Operational integration baseline audit

Baseline: Phase 4C certification commit `58207453f2675474a511628e2a98fde5867bea4b`.
Branch: `feature/education-suite-phase4d`. DEV only.

## Existing implementation observed
- The repository already includes `database/saas/68_phase4d_first_tenant_integration.sql` (first-tenant branding, workspace listing, public Academy branding), as well as later Phase 4E/4F SQL. Treat these as existing code to review, not new Phase 4D deliverables.
- The CRM portal-integration route uses the tenant-scoped `saas_crm_portal_install_v1` RPC and a compatibility fallback to `connect_portal_demo_bridge` only when the SaaS organization-authorization RPC is missing. Its fallback is a backward-compatibility boundary that requires targeted security regression tests.
- Phase 4C DEV certification and authenticated two-tenant tests passed on their scoped baseline; that does not certify the complete Academy → CRM → Tasks operational lifecycle.

## Outstanding Phase 4D gates
1. Verify onboarding, trainer/course/enrollment/scheduling/attendance/finance and role-specific screens with authenticated test identities.
2. Test enquiry → opportunity → demo → admission → Academy onboarding → enrollment, including idempotent retries and audit records.
3. Verify Tasks personal privacy, CRM follow-up task assignment and recurring task semantics.
4. Exercise subscription expiry, module disabling, revocation, direct URL/RPC denial and organization switching.
5. Review compatibility fallback and direct privileged RPC grants; test cross-tenant read/write denials.
6. Run TypeScript, backend and UI contract tests, and fresh authenticated DEV E2E at the new branch HEAD.
7. Check DEV database drift and advisors; commit only reproducible, tested changes.

**Certification: NOT YET PASSED.** Branch creation and initial source inspection are complete; functional implementation and end-to-end validation remain outstanding. No PROD/main/Netlify actions.
