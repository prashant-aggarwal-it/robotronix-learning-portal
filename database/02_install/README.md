# 02 — Install the complete Education Suite

**Your current DEV project is already installed. Do not rerun any installer on it.**

For a new and deliberately empty DEV Supabase database, generate the ordered SQL Editor files from the repository root:

```powershell
npm run db:build-editor
```

The generated SQL files appear under `database/02_install/sql_editor/`. Open `sql_editor/ORDER.md` for the **exact sequence**; the generator currently produces six files, each below 185 KB. Use Supabase SQL Editor to execute each file individually and in order. Stop at the first error.

**Important:** These are a *new alternative* to the original combined file. The SQL parser checks statement boundaries and CI confirms generation, but changing transaction boundaries still requires **live clean-install certification**. Do not use in production or on a populated database. A partial installation must not be resumed blindly.

For direct `psql` installation, the original monolithic `../generated/ROBOTRONIX_EDUCATION_SUITE_FRESH_INSTALL_UNCERTIFIED.sql` remains available.

Reference data is included in the Academy installer. Auth users are created separately through the Supabase Admin API. After installation, follow `../06_verify/README.md`.

Internal canonical SQL sources remain under `../portal/`, `../tasks/`, `../crm/`, `../saas/`, `../shared/`; do not run these individually in addition to the generated installer.
