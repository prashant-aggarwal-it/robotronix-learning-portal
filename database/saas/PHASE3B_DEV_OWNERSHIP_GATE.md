# Phase 3B — DEV ownership and migration gate

Verified on DEV Supabase project `uzzuquxeeqonxeqcuohh` (not PROD).

## Current verified inventory

- `public.courses`: 20 existing RTX course definitions; `saas.academy_courses`: 0 ownership mappings.
- `public.students`, `public.trainers`, `public.enrollments`: 0 rows each, with 0 SaaS mappings.
- `public.cohorts`: 0 rows.
- `public.profiles`: 0 rows.
- `saas.organizations`, `saas.memberships`: 0 rows.

These counts are a point-in-time DEV observation, not a claim about production.

## Migration decision

Do **not** assign the 20 course definitions to arbitrary tenant organizations. Names and `RTX-` codes suggest a Robotronix seed catalog, but do not by themselves establish a formal shared-template policy. Keep these records unchanged until shared-template semantics are explicitly implemented and certified. A new clean test dataset may be generated using the already isolated synthetic DEV test fixtures.

User permission to reset DEV data does not justify deleting potentially reusable reference catalog data when no reset is necessary to implement tenant isolation.

## Required next engineering work

1. Enumerate and classify all direct browser database access, including finance, communications and Zoom.
2. Introduce authorized organization context into the **existing** Admin, Trainer, Parent and Student repositories and pages (not a duplicate Academy).
3. Implement a validated shared-course-template model or verified tenant ownership for catalog data.
4. Expand ownership links and protected APIs to cohorts, classes, attendance, finance, payroll, learning resources, communications and recordings.
5. Certify every sensitive GET/POST/PATCH/DELETE against both synthetic schools, including revoked membership and stale response rejection.
6. Run upgrade migrations and authenticated E2E in DEV, then produce a final migration report. Do not touch PROD.

## Evidence/tools

- `node scripts/audit-academy-data-access.mjs`: read-only static access inventory.
- `database/saas/13_academy_ownership_preflight_readonly.sql`: read-only ownership validation.
- `lib/server/saas/academy-phase3b-contract.test.mjs`: guards stale responses and non-destructive preflight.
- Phase 3A authenticated E2E: https://github.com/prashant-aggarwal-it/robotronix-learning-portal/actions/runs/43577576525

**Phase 3B status: in progress, not certified.**
