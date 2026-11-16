# 06 — Verify the installed DEV database

These are **executable read-only SQL files**, kept in the order in which an operator should use them:

1. `01_academy.sql` — Academy schema and application checks.
2. `02_tasks.sql` — My Tasks schema, policies and privilege checks.
3. `03_crm.sql` — Connect CRM schema, policies and privilege checks.
4. `04_saas_membership.sql` — SaaS membership-management guard and owner consistency.

Run individually in the **DEV** Supabase SQL Editor. The first three have already passed for the current DEV installation. The fourth is a read-only SaaS-specific inspection: examine the returned function privileges and active-owner count; it is not a tenant-isolation simulation.

These files are synchronized **copies** of canonical sources `portal/verify.sql`, `tasks/04_verify.sql`, `crm/04_verify.sql`, and `saas/39_phase3c_readiness_readonly.sql`. Run `node scripts/check-db-operator-layout.mjs` to verify copies remain byte-identical after any change.

Tenant-isolation testing must be done separately using safe fixtures and role-specific sessions. The legacy `saas/03_tenant_isolation_rollback.sql` requires a DEV Auth user and is not a generic clean-install check.

**Never execute the fresh installer again on an already installed database.**
