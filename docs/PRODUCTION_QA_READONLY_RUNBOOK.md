# Production QA execution

The database and user-facing deployment can be tested on production **without enabling the destructive development QA suite**.

## Runner

Workflow: **Production read-only QA (manual)**, `.github/workflows/production-readonly-qa.yml`.

The workflow is manually dispatched and has two stages:
1. Default: anonymous homepage/login/privacy smoke and anonymous Zoom authorization checks. Needs no user credentials.
2. Optional `authenticated=true`: login as dedicated SANITY Admin, Trainer, Parent and Student users, navigate read-only dashboards and check unauthorized Admin access. Needs configured secrets.

All checks run against exactly `https://portal.robotronixstemlab.com`, and the local and CI entrypoints enforce `QA_TARGET=production` plus `PRODUCTION_READONLY_QA_ACK=READ_ONLY_ONLY`. They refuse injected Supabase service-role secrets.

**GitHub environment:** Create `production-qa`. Recommended: require approval before dispatch. When ready for authenticated smoke, configure the environment secrets `PROD_SANITY_SUPABASE_URL`, `PROD_SANITY_SUPABASE_ANON_KEY`, and `PROD_SANITY_{ADMIN,TRAINER,PARENT,STUDENT}_{EMAIL,PASSWORD}`. All four users must actually have active profiles in the live database. Verify the project ref is the same as the Netlify site's production Supabase setting before enabling the role tests.

## Non-goals and next gates

Do **not** run `qa:prod-gate`, `qa:prod-sanity`, `qa:integrated-e2e` or `qa:release` directly on production. Those suites may mutate or clean records, and `qa:integrated-e2e` correctly refuses production.

The read-only suite checks availability, authentication, role navigation and selected API permission boundaries. It does **not** fully execute onboarding creation, scheduling edits, payment recording, Zoom hosting, attendance, payroll or recording deletion. Those write-path E2E cases need separately scoped, seeded QA-only users/records and guarded per-test cleanup that never touches other production records.

Use one workflow dispatch per release after confirming Netlify deployed the expected `main` commit. Download `production-readonly-qa-results` from the Actions run to review traces and screenshots. A successful static GitHub release build is **not** evidence that live production E2E passed.
