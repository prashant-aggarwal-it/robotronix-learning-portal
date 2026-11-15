# 01 — Reset DEV

The DEV application reset has already been executed for this project. Do not repeat it unnecessarily.

Guarded reset source: [`../shared/DEV_RESET_EDUCATION_SUITE_REVIEW_FIRST.sql`](../shared/DEV_RESET_EDUCATION_SUITE_REVIEW_FIRST.sql).

Auth user deletion uses the Supabase Admin API, never direct SQL: `node scripts/reset-dev-auth-users.mjs` (dry run by default).

Never reset PROD.
