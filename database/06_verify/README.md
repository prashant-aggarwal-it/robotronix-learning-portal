# 06 — Verification

After installation, run these read-only checks individually:

1. `../portal/verify.sql`
2. `../tasks/04_verify.sql`
3. `../crm/04_verify.sql`
4. `../../qa/sql/milestone-c-phase12-readiness.sql`

Then run DEV tenant-isolation rollback tests. **Not a replacement for certifying an empty-project installation.**
