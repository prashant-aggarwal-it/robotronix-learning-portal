# Robotronix™ Learning Portal — FINAL FROZEN RELEASE MANIFEST

Release: Production v1.0.0
Date: 2026-10-16
Status: consolidated deployment baseline

## Included
- Full Next.js portal source for Admin, Trainer, Parent and Student roles.
- Supabase consolidated fresh-install schema and reference/master data.
- DEV QA seed/cleanup and DEV-only reset tool.
- Production sanity seed/cleanup.
- Release verification SQL.
- Active-existing learner migration model and negotiated opening finance/progress support.
- Parent-visible feedback plus protected internal Trainer/Admin notes.
- Scheduling, attendance, finance, payroll, communications, notifications and audit protections.
- Razorpay integration/tests/documentation included in the source baseline.
- Zoom Classroom POC: OAuth connection, encrypted tokens, meeting create/cancel, host ZAK, server SDK signature and embedded classroom.
- Final hardened `qa/workflows.spec.ts`, including bounded Student Course visibility retry.
- Mobile/responsive CSS and Playwright responsive QA.
- Portal metadata keywords plus deliberate privacy-safe noindex/nofollow behavior.
- Final deployment and operations instructions in `START_HERE_FINAL_DEPLOYMENT.md`.

## Database installation rule
For a fresh Production database use only:
1. `database/01_install/01_CREATE_SCHEMA.sql`
2. `database/01_install/02_INSERT_MASTER_REFERENCE_DATA.sql`
3. `database/03_verify/01_VERIFY_RELEASE.sql`
4. reviewed real-Admin bootstrap process

Do not replay old hotfix SQL or patch bundles.

## Deliberately excluded from the ZIP
- `node_modules/`
- `.next/`
- Playwright reports/test-results
- `.qa-auth/`
- TypeScript incremental build cache (`*.tsbuildinfo`)
- local `.env*` secrets
- historical patch ZIPs/hotfix bundles
- stale reconciliation/rebuild notes that are superseded by this manifest and the final deployment guide

## Known scope boundary
The Zoom implementation remains a POC. Real schedule-driven host allocation, collision blocking, webhook/presence tracking and live operational dashboard are future work and are not represented as complete.
