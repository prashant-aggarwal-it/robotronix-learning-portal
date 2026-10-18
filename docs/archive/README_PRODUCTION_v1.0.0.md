# Robotronix™ Learning Portal — Production v1.0.0

This folder is the consolidated Production v1.0.0 deployment baseline.

Start with **`START_HERE_FINAL_DEPLOYMENT.md`**. It contains the complete sequence for local verification, GitHub, fresh Supabase Production setup, Netlify, production sanity, Zoom POC and day-to-day operating workflows.

## Core rules

- Do not overlay older Robotronix patch ZIPs.
- Do not replay historical hotfix SQL.
- Never commit `.env.local`, `.env.sanity.local` or any secret.
- Keep the authenticated portal out of search indexing; public SEO belongs on `www.robotronixstemlab.com`.
- Before deploying this exact extracted folder, run `npm ci` and `npm run check:deployment`.

## Fresh Production database

Use only:
1. `database/01_install/01_CREATE_SCHEMA.sql`
2. `database/01_install/02_INSERT_MASTER_REFERENCE_DATA.sql`
3. `database/03_verify/01_VERIFY_RELEASE.sql`
4. reviewed first-Admin bootstrap process

For all details, read `START_HERE_FINAL_DEPLOYMENT.md` and `database/README_DATABASE_v1.0.0.md`.
