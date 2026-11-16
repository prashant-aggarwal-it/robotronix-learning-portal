# 02 — Install the complete Education Suite

**Your DEV project has already been installed. Do not rerun the installer.**

For a **new, disposable Supabase project**, generate the canonical fresh installer from the repository root:

```powershell
node scripts/build-education-suite-installer.mjs
```

Output: `../generated/ROBOTRONIX_EDUCATION_SUITE_FRESH_INSTALL_UNCERTIFIED.sql`.

To execute this oversized installer, use PostgreSQL `psql` with `-v ON_ERROR_STOP=1` rather than the Supabase browser SQL Editor.

The generated bundle is an integration snapshot, **not a production migration**. Although it executed on the current DEV project, full multi-tenant role and isolation certification is still outstanding. Never run it on PROD or a populated environment. Internal schema sources stay under `../portal`, `../crm`, `../tasks`, `../saas` and `../shared` until their generator and application dependencies can safely be relocated.

After installation, proceed to `../06_verify/README.md`.
