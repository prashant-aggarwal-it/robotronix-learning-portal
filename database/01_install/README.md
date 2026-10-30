# Install — production-equivalent database structure and reference data

**These are the current canonical sources, not old migrations.**

- `modules/schema/` — 11 ordered SQL modules for real tables, RLS, triggers, functions, scheduling, finance, Zoom and logging.
- `modules/reference/` — 4 ordered SQL modules for currencies, locations, settings, academic reference and course catalogue.
- `03_BOOTSTRAP_FIRST_ADMIN_EXAMPLE.sql` — **optional** separate first Admin bootstrap after creating an Auth account; **not needed** for the eight-account DEV QA flow.

## Fresh install (empty DEV project only)

From repository root:

```powershell
npm ci
npm run db:build-fresh-install
```

This generates `database/generated/ROBOTRONIX_FRESH_INSTALL.sql`. Execute that **single generated file once** in Supabase DEV SQL Editor. **Do not run individual modules**, and do not run the installer over an existing database. Next execute `database/03_verify/01_VERIFY_RELEASE.sql`.

For test users and data, follow `database/02_qa/README.md`.

If deliberately resetting an existing DEV project, see `database/99_dev_tools/README.md` first. Do not use any reset in PROD.
