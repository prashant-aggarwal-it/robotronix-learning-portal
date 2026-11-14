# SaaS Phase 2 — first additive Academy integration (2026-11-14)

**Baseline commit:** `47d1460ae84cd4a2c1c27337f23227c15d0ecb80`.
**DEV database:** `uzzuquxeeqonxeqcuohh`.
**Applied migration:** `saas_academy_ownership_bridge_additive`.

Implemented 4 additional `saas` ownership tables with foreign keys into the existing Academy masters (`public.students`, `public.courses`, `public.trainers`, `public.enrollments`), and a server-only enrollment-relationship guard.

Database catalog verified: original `public` 80, `connect` 66, `tasks` 21; SaaS grew from 9 to 13 tables, all 13 with RLS enabled. No existing Academy/CRM/Tasks policies were changed. Link functions are not executable as `anon` or `authenticated`.

**Current safety posture:** The enrollment guard is available to authorized server paths but **has not yet been integrated into all Academy enrollment APIs**. It does not globally enforce a constraint on existing enrollments. New ownership bridges have no client grants and no automatic assignment of legacy rows. Full tenant isolation is therefore **not certified**. This isolation gap must block onboarding any external academy until server APIs, DB write paths, RLS and storage paths are jointly verified.

**Pre-existing DEV test data:** zero CRM tenants/memberships, zero Academy students, zero Tasks workspaces; one Auth user. No existing real Academy student/finance records were backfilled. No authorization, provider or finance records were modified.

**Next implementation gates:**
1. Reproduce Academy/CRM/Tasks actual API baseline and negative role tests.
2. Wire tenant validation into server side Academy create/list/update flows behind compatibility feature flags.
3. Extend ownership to finance and derived records and enforce cross-tenant transactions through database constraints or verified write procedures.
4. Use two separately authenticated synthetic users and two organizations to test positive/negative writes, joins, RPCs and storage.
5. Implement tenant context, member provisioning and CRM/Tasks identity link mapping; run full CI and UI regression.

No changes to PROD, `main`, Netlify or external provider activity.
