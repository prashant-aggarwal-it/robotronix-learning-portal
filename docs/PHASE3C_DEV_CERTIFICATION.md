# Phase 3C — DEV progress and certification gate

Date: 2026-11-14

## Decision
**PARTIAL — NOT DEV CERTIFIED.** Do not begin Phase 3D on the assumption that Phase 3C is complete.

## Baseline
- Repository: prashant-aggarwal-it/robotronix-learning-portal
- Branch: feature/education-suite-release1
- Phase 3B certified HEAD on entry: 85f9c6ebae696a73d2477315f030f1d2add0221d
- Target DEV: uzzuquxeeqonxeqcuohh
- Production was not targeted; no Netlify operations were requested.

## Verified by connected services
- DEV contains saas.organizations, saas.memberships, saas.module_entitlements, saas.audit_events and Phase 3B Academy resources.
- The underlying saas membership role check constrains role_key to owner, admin, staff, trainer, member.
- Organization/membership authorization and Academy RLS code from Phase 3B already exist and must be preserved.
- 11 public tables have RLS disabled: academic_levels, cities, city_aliases, countries, course_academic_levels, currencies, invoice_sequences, reference_data_sources, states, system_settings, timezones.
- A focused privilege check shows neither anon nor authenticated has UPDATE on those 11 tables and anon has no SELECT. Do not treat disabled RLS alone as proof of publicly accessible data. Decide table-specific RLS after reviewing all callers and access grants.

## Code changes
- Added lib/server/saas/role-capabilities.mjs containing a conservative, deny-by-default organization-capability baseline.
- Added lib/server/saas/role-capabilities.test.mjs to cover unknown roles, sensitive capability denial, and immutable matrix.
- These are preliminary code artifacts and **are not wired into application authorization**; no runtime enforcement or test success is claimed.
- CRM and Tasks retain their own authorization models pending boundary audit.
- No database mutations were performed.

## Unfinished Phase 3C acceptance criteria
- Complete role/capability inventory and resource-specific policy mapping.
- Integrate capabilities into all eligible server routes and operations without weakening existing resource checks.
- Review and harden role changes, revocations, last-owner protection and audit.
- Complete independent CRM and Tasks authorization regression.
- Verify SECURITY DEFINER, RPC and service-role boundary behavior.
- Prepare canonical DB changes if needed, apply to DEV with review and execute authenticated cross-tenant negative tests.
- Run typecheck, capability tests, existing 121-assertion Phase 3B regression and browser security journeys.
- Confirm UI, navigation, role switch behavior; record actual CI evidence.

## Certification
Status: **PARTIAL**. The capability matrix alone is insufficient to certify authorization. No new PASS claim for Phase 3C or its regression suite is made.

## Pass 1 subsequent implementation (2026-11-14)
- Commit 304d99fbb684afcf2aeef60de5bb71610fb24990: connected capability check to tenant-authenticated Academy service and legacy Academy Admin guard; role/capability denial is evaluated after existing membership/entitlement verification. Existing saas_academy_v1 still enforces record-level scope.
- Commit 6cd9bc383779aded25e390af7c119b246e037275: added database/saas/37_phase3c_last_active_owner_guard.sql, a membership UPDATE/DELETE guard preventing removal/demotion/suspension of the last active owner. Applied via DEV-only Supabase migration phase3c_last_active_owner_guard (success).
- Read-only DEV verification returned zero active organizations with memberships but no active owner. This is not a substitute for an authenticated negative-operation test.
- Scope remains incomplete: CRM and Tasks permission integration, broad Academy legacy route inventory, RLS exhaustive review, role-management UI and complete automated regressions.
- No completed typecheck, browser E2E, Phase 3B regression run or CI evidence from these commits is claimed.
- Overall Phase 3C status remains PARTIAL / NOT CERTIFIED.

## Continued Pass 1 — membership operations
- Added database/saas/38_phase3c_membership_management.sql and an authenticated server PATCH endpoint at app/api/platform/organizations/[organizationId]/members/[membershipId]/route.ts in commit 2fe46a0fff969d1626354a90edfa2794516e2aa6.
- Applied DEV migration phase3c_membership_management successfully.
- RPC checks current active SaaS owner/admin membership, row belongs to same organization, denies admin privilege escalation, prevents self-revocation, and emits audit events for changes. Existing last-active-owner trigger remains active.
- Verified RPC is SECURITY DEFINER, callable by service_role, and not callable by anon/authenticated directly.
- This covers updates to existing membership rows only. Invitation/member creation, SaaS management UI, exhaustive API authorization, CRM/Tasks permission audits, full application typecheck and regression testing remain outstanding.
- **Pass 1 is NOT fully certified and Phase 3C remains PARTIAL** until remaining coverage and regression evidence are available.

## Additional Pass 1 continuation — 2026-11-14
- Commit 9643d453c6813aa5b60a33d63f708a9a76ed7c7d: reject null role/status in RPC; added organization-scoped membership GET endpoint. DEV migration phase3c_membership_null_hardening applied.
- Commit 8184f13685710af24d6e7f46a9313dbdd16cd037: added minimal /saas/members role/status management UI for owners.
- DEV currently has zero persistent SaaS membership rows. Authenticated owner-management journeys and last-owner rejection have not been verified with representative real accounts.
- CRM/Tasks still use their independently maintained auth mechanisms, subject to Phase 3C exhaustive audits.
- No successful typecheck, CI or Playwright regression has been observed for the new commits.
- Status: PARTIAL, not Phase 3C certified.
