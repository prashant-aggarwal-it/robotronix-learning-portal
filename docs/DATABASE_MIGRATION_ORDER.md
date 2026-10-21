# Database installation — consolidated fresh project

**Fresh Production uses only two mandatory SQL files and one conditional Admin bootstrap.**

1. Run `database/01_install/01_CREATE_SCHEMA.sql` **once** in a brand-new, empty Supabase project.
2. Run `database/01_install/02_INSERT_MASTER_REFERENCE_DATA.sql` **once**, after schema succeeds.
3. **Only if needed**, provision the real Admin Auth user, edit `database/01_install/03_BOOTSTRAP_FIRST_ADMIN_EXAMPLE.sql` with the correct Admin email, review it, then execute it.
4. Run **read-only** `database/03_verify/01_VERIFY_RELEASE.sql`; inspect all results, then validate in DEV with application/build tests.

Legacy patch scripts `04`–`09` have been **fully consolidated into 01_CREATE_SCHEMA.sql and removed from this release branch**. Never try to run them separately for this fresh installation. Their history remains available in Git.

**Production warning:** A new Supabase project does **not** contain your existing users, role-linked profiles, learners, classes, attendance, payroll, Zoom OAuth connections, payments, invoices, or historical data. If those records must be preserved, an approved data and identity migration is required before cutover. Do not discard the existing project or repoint the Production site until this is reconciled, backed up, and verified. A fresh production database is not automatically a safe replacement for a live one.

DEV must be tested first with the same fresh installer, RLS roles, identity providers, Zoom and Razorpay provider settings. Keep QA fixtures only in `database/02_qa`; never run DEV reset/seed scripts in Production.

See [Database authoritative README](../database/README_DATABASE_v1.0.0.md), [Release QA and handover](CONSOLIDATED_RELEASE_QA_HANDOVER.md), and [Fresh install and QA](FRESH_INSTALL_AND_QA.md).
