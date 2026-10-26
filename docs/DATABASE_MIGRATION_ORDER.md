# Canonical Robotronix database installation

## Fresh database only

One generated install file, made from ordered functional SQL modules:

`database/01_install/modules/schema/`
- `01_core_schema.sql` — core entities and relationships
- `02_scheduling_operations.sql` — scheduling and operational rules
- `03_academic_delivery_finance.sql` — attendance, progress and finance controls
- `04_billing_razorpay.sql` — billing/invoices and Razorpay
- `05_roles_notifications_payroll.sql` — access, onboarding, notifications and pay
- `06_zoom_calendar_demo.sql` — Zoom, calendar subscriptions and demos
- `07_notifications_security_and_lifecycle.sql` — lifecycle, security and subsequent consolidated changes
- `08_operational_logging.sql` — operational job monitoring, RLS and retention
- `09_operational_audit_coverage.sql` — P0/P1 operational audit triggers

`database/01_install/modules/reference/`
- `01_geo_time_currency.sql` — geography, timezones and currencies
- `02_app_settings_and_locations.sql` — configuration and location import
- `03_academic_reference.sql` — academic levels and mappings
- `04_course_catalogue.sql` — production courses and validation

The modules are **sequential execution slices** preserving the former monolithic source byte-for-byte in each group (except the separately added logging module). This guarantees ordering continuity; titles describe primary scope but do not imply every statement in a slice is strictly limited to one subject. Do not reorder or execute slices independently.

Run `npm run db:build-fresh-install`; then run the generated `database/generated/ROBOTRONIX_FRESH_INSTALL.sql` **once in a new empty database**. Bootstrap first Admin only if needed with `database/01_install/03_BOOTSTRAP_FIRST_ADMIN_EXAMPLE.sql`, and run read-only `database/03_verify/01_VERIFY_RELEASE.sql`.

## Existing databases / production

Do **not** run the fresh installer, schema slices, or development reset scripts on an existing Supabase project. Existing-database upgrades require a reviewed backup and additive migration plan; archived migrations under `database/archive/legacy/` are historical only, not part of fresh install. This reorganization does not migrate or alter DEV or production data.

The QA seed/cleanup SQL remains isolated in `database/02_qa`; verification SQL remains in `database/03_verify`; development-only reset remains in `database/99_dev_tools`. Do not run QA seed or reset in production. No historical SQL patch is needed after a new fresh install.

See `docs/SYSTEM_LOGS.md` for operational logging verification and retention.
