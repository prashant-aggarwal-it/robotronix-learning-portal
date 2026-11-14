# SaaS foundation — DEV implementation evidence

Applied to DEV `uzzuquxeeqonxeqcuohh` on 2026-11-14 using the migration `saas_foundation_release1_additive`.

## Installed

New private `saas` schema with 9 tables:
- organizations
- memberships
- legacy_tenant_links (FK to `connect.tenants`)
- workspace_links (FK to `tasks.workspaces`)
- module_entitlements
- organization_settings
- platform_subscriptions (separate from Academy invoice/payment records)
- audit_events
- feature_flags

New `saas.is_active_member(uuid)` scoped RLS predicate and `saas.require_organization(uuid)` authorization function. The former checks the active caller's auth user against active organization and membership. Read-only RLS on organizations, memberships, entitlements and flags. Writes remain server-only. No changes to existing Academy, CRM or Tasks access policies, and no new third-party calls.

## Real verification

- Installation succeeds on DEV.
- 80 public, 66 connect, 21 tasks legacy tables retained.
- 9 saas tables / 9 RLS enabled.
- Synthetic Academy A/B SQL transaction test: member A sees A, not B; all test data rolled back.
- An outsider (unmapped JWT subject) cannot view organization or memberships using `authenticated` role (see repeatable integration test).
- Read-only catalog/grants verifier committed alongside migration.

## Limits: NOT SaaS certification

- Existing Academy lacks explicit tenant ownership: no Academy student/finance authorization change yet.
- Existing CRM tenant count, CRM memberships, Academy students, Tasks workspaces were all zero at baseline, so migration/backfill of real records was not exercised.
- No application tenant switcher, tenant-aware API handlers, storage policies, background-job isolation or end-to-end user-role suites have been implemented or tested.
- These foundation tables do not provide self-service organization creation; provisioning requires an authorized backend administration path.
- No PROD or deployment changes, no live provider activity.
- RLS predicates rely on session identity; service-role handlers must independently verify the requesting actor and tenancy before operating.
