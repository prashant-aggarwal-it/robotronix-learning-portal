# Robotronix — release reconciliation ledger (24 October 2026)

## Safety / release contract

This branch is a **work-in-progress reconciliation branch**, not a production-ready release. Do not deploy it or run database changes against production until checks below pass and the owner explicitly approves merge to main. This branch started from `fix/zoom-operations-navigation-ux-20261024`, a straight descendant of main (14 commits ahead at branch creation).

## Branch inventory (relative to main at audit time)

- `fix/zoom-operations-navigation-ux-20261024`: 14 ahead / 0 behind. Baseline already included.
- `feature/seamless-learner-journey-20261024`: 86 ahead / 45 behind. Includes overlapping UI/repository files, schema edits and `database/04_migrations/2026_10_24_PHASES_2_3_4_ADDITIVE.sql`; **NOT merged**, draft conflict-review PR #32.
- `fix/manual-qa-20261023`: 10 ahead / 46 behind; requires careful cherry-pick.
- `qa/production-readonly-smoke-20261024`: 7 ahead / 44 behind; review test additions.
- `security/prod-qa-fixtures-20261022`: 6 ahead / 49 behind; review database QA fixtures and cleanup before use.
- `fix/default-ai-flow-20261024`: 3 ahead / 43 behind; pending.
- `fix/finance-review-ux-20261024`: 3 ahead / 42 behind; pending.
- `fix/finance-notification-deeplink-20261023`: 2 ahead / 46 behind; pending.
- Dependabot proposals should be reviewed independently, not merged en masse.

## Source of truth policy

1. `main` is the current deployed-code baseline **until** a validated reconciliation PR is approved and merged.
2. This reconciliation branch is a **candidate**, not the source of truth until release verification is complete.
3. `database/01_install/01_CREATE_SCHEMA.sql` includes later `ALTER TABLE` statements. Do not infer the final schema from initial `CREATE TABLE` statements alone.
4. `public.courses.public_name` and `public.courses.internal_name` become NOT NULL in later schema statements; QA fixtures must supply both.
5. Treat production database contents and migration history as independent facts. Perform a **read-only** live schema audit before approving SQL changes. Never reinstall the consolidated fresh-install SQL into an existing production database merely to repair a QA fixture.
6. Preserve the onboarding admin notification trigger `onboarding_submission_admin_notification_trg` and function `notify_admin_on_onboarding_submission()` in the final release.
7. Preserve all passing QA/build guardrails, payroll locks, recorded class protections, Zoom workflow/recording permissions, and release checks.
8. Do not merge to `main`, deploy or trigger an explicit production build without owner approval.

## Release gates — all pending

- [ ] Reconcile overlapping files and confirm intended final UX across Admin / Trainer / Parent / Student.
- [ ] Incorporate applicable unique changes from diverged branches without regressing newer main changes.
- [ ] Finalize fresh-install consolidated schema, additive migrations, master reference data and read-only production parity checks.
- [ ] Repair production QA fixture SQL and safe cleanup scripts against the **effective** schema.
- [ ] Run type checking, production build, all release guard scripts and Playwright QA suites on an isolated test database.
- [ ] Validate migrations from a fresh database **and** an existing snapshot.
- [ ] Review Zoom / finance / communications security boundaries and notification triggers.
- [ ] Final PR review and approval before any merge or production SQL.

## Outstanding production QA fixture defects

The previously shared SQL packs were not validated on production, and failed first with malformed Auth subqueries, then with missing mandatory course columns. They must **not** be considered approved release assets.
