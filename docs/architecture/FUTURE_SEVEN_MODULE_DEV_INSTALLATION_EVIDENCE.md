# Seven future schemas — DEV installation evidence

**Date:** 2026-11-14
**Repository:** `prashant-aggarwal-it/robotronix-learning-portal`
**Feature branch:** `feature/education-suite-release1`
**Starting HEAD:** `8fa9a66b9d3787a1cb2a81d2c890010f99cad330`
**DEV project:** `uzzuquxeeqonxeqcuohh`
**PROD, main, deployment:** unchanged.

## Applied DEV migrations (each returned success)
- `education_suite_future_lms_dormant_v1`: 6 tables
- `education_suite_future_assessment_dormant_v1`: 7 tables
- `education_suite_future_gamification_dormant_v1`: 5 tables
- `education_suite_future_certificates_dormant_v1`: 3 tables
- `education_suite_future_analytics_dormant_v1`: 3 tables
- `education_suite_future_operations_dormant_v1`: 5 tables
- `education_suite_future_ai_dormant_v1`: 6 tables

All seven SQL packages passed actual PostgreSQL execution inside separate `BEGIN … ROLLBACK` transactions before permanent installation; assertions checked table count, RLS and absence of direct `anon` and `authenticated` table privileges.

## Verified live catalog
- Existing `public`: 80
- Existing `connect`: 66
- Existing `tasks`: 21
- Existing `saas`: 13
- `lms`: 6; `assessment`: 7; `gamification`: 5; `certificates`: 3; `analytics`: 3; `operations`: 5; `ai`: 6
- **Total: 215 tables.** Future-module RLS: 35/35 enabled. Future-module direct anon/authenticated privileges: zero.
- Proposed `platform` schema intentionally not installed; `saas.organizations` remains canonical.

## Certification scope and gaps

**Passed:** SQL executes, migrations applied, new tables exist, RLS enabled, no direct client table grants, old schema table counts unchanged.

**Not tested / not certified:** Tenant-specific positive-access RLS policies; service-role user authorization across new tables; synthetic two-user ownership workflows; app-specific APIs; authenticated browser workflows; finance, payroll, Zoom, CRM, Tasks and Academy end-to-end regression; integration bridges, provider/job interactions. Source-level CI checks are not proof of these runtime behaviors.

**Design debt:** The 35 tables are starter models; some feature requirements (learning pathways, evaluation rubrics, richer analytics, AI agent approvals, operational scheduling) require additional design and tested SQL. New schemas are deliberately dormant; no client-facing CRUD was granted and no background jobs were activated. Never expose new tables to user-facing roles before tenant-aware service/API authorization tests are complete.

**Next release gate:** implement signed-in scoped access policies and server-side module contracts, perform real two-tenant positive/negative test suites, run Academy/CRM/Tasks/Finance regression, and produce separate production migrations. DEV installation is **not** SaaS production readiness.
