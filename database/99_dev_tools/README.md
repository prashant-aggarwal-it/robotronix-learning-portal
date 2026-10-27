# DEV tools — DESTRUCTIVE, optional

`00_DEV_ONLY_RESET_PUBLIC_SCHEMA.sql` drops `public` with `CASCADE` and recreates it. It removes **all public tables, policies, functions and data**, including QA profiles and business records. It **does not remove Supabase `auth.users`**.

Only run when explicitly rebuilding an isolated DEV project:
1. Back up any needed DEV data.
2. Verify the exact Supabase **DEV project reference/URL**. This script itself does not enforce a project-ID allowlist.
3. Execute the reset in DEV SQL Editor.
4. Rebuild using `npm run db:build-fresh-install`, run the generated SQL, and verify the schema.
5. Reuse existing Auth users or create them, then execute `database/02_qa/01_PREPARE_DEV_QA_PROFILES.sql`, `02_RUN_DEV_QA_DATA.sql`, `03_VERIFY_DEV_QA.sql`.

**Never run in Production, shared environments, or as routine QA maintenance.** If DEV is already working, don't reset.
