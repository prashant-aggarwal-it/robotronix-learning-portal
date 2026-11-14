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
