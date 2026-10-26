# Robotronix database — authoritative SQL layout (QA branch)

**Updated 26 October 2026.** The old 300 KB `01_CREATE_SCHEMA.sql` and 60 KB `02_INSERT_MASTER_REFERENCE_DATA.sql` monoliths have been retired. **Do not follow older instructions that reference those files.**

## One canonical fresh-install source, arranged by functionality

All active installation SQL resides under `database/01_install/modules/`, with sequential numbered modules:

| SQL folder | Purpose |
| --- | --- |
| `schema/01_core_schema.sql` | Base schema, foundational relationships and initial RLS |
| `schema/02_scheduling_operations.sql` | Scheduling and operational extensions |
| `schema/03_academic_delivery_finance.sql` | Learning/delivery, progress and financial rules |
| `schema/04_billing_razorpay.sql` | Invoices, billing, payment integrations |
| `schema/05_roles_notifications_payroll.sql` | Users, onboarding, messages and trainer pay |
| `schema/06_zoom_calendar_demo.sql` | Zoom, demo and calendar capabilities |
| `schema/07_notifications_security_and_lifecycle.sql` | Additional lifecycle and security consolidation |
| `schema/08_operational_logging.sql` | Job history, RLS and retention for operational logging |
| `schema/09_operational_audit_coverage.sql` | Final P0/P1 operational audit triggers |
| `schema/10_zoom_jit_provisioning.sql` | Atomic Zoom class provisioning locks |
| `schema/11_zoom_host_capacity.sql` | Reservation ledger, overlapping-host guard and booking trigger |
| `reference/01_geo_time_currency.sql` | Countries, currencies, timezone reference |
| `reference/02_app_settings_and_locations.sql` | Behaviour settings and location dataset |
| `reference/03_academic_reference.sql` | Academic levels and course mappings |
| `reference/04_course_catalogue.sql` | Production course reference/catalogue |

All feature modules are **ordered**, not individually runnable independent migrations. The historical SQL was split losslessly at major section boundaries to preserve transaction and dependency ordering. Some modules therefore contain related historical cross-feature statements; safely relocating every statement by object ownership requires a separate dependency-graph migration review.

## Fresh-install procedure (EMPTY Supabase project only)

1. Run `npm ci`.
2. Run `npm run db:build-fresh-install`. This checks modules and generates one `database/generated/ROBOTRONIX_FRESH_INSTALL.sql`.
3. Execute the complete generated SQL **once** in a new empty Supabase project.
4. Bootstrap the first Admin identity only if required with `database/01_install/03_BOOTSTRAP_FIRST_ADMIN_EXAMPLE.sql`, after reviewing the file.
5. Run the read-only `database/03_verify/01_VERIFY_RELEASE.sql`; then application build and DEV role/workflow QA.

**Never run the fresh installer in an existing or production Supabase project.** It is not a data-preserving migration.

## Other SQL, grouped by purpose

- `database/02_qa/`: QA seed/cleanup and production-security test fixture scripts. Never use these on real production data without an explicitly approved test plan.
- `database/03_verify/01_VERIFY_RELEASE.sql`: single read-only release verification script.
- `database/99_dev_tools/`: development-only reset. Never run in production.
- `database/archive/legacy/`: historical SQL, retained for traceability only. No active installation dependency.
- There are **no active 04_migrations or hotfix SQL patch files** in the QA release tree.

For upgrading a populated existing database, first take a backup and prepare a separately approved, **data-preserving** change plan. Archived SQL describes earlier prelaunch upgrades, but is **not** a generic safe migration instruction for every production schema state.

## Release rules

1. DEV: run the generated installer on disposable empty DEV and confirm database triggers, RLS, parent/trainer access, notification behaviour, payroll, Zoom, payment operations, and logs.
2. Review the exact Git commit and GitHub Actions results.
3. Do not merge, deploy or modify production until separate approval.
4. Keep secrets out of repository SQL and logs.

See `docs/DATABASE_MIGRATION_ORDER.md`, `docs/SYSTEM_LOGS.md`, and `docs/CONSOLIDATED_RELEASE_QA_HANDOVER.md`.
