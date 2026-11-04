# Robotronix Connect — Phase 1 execution report

Date: 2026-11-05
Branch: `feature/robotronix-connect-crm`
Environment: Supabase DEVELOPMENT only (`fflejkqcspivnhsmkdtn`)
Production: **untouched**
Merge to main: **none**

## Executed
- Baseline inspection found 80 existing public tables. Core `profiles`, `parents`, `students`, `demo_leads`, `demo_session_participants`, `onboarding_submissions`, and `enrollments` contained zero rows.
- Applied named Supabase migration `connect_crm_phase1_foundation_20261105`, version `20261104214649`.
- 28 `public.crm_*` relational tables created: canonical people/contact methods, families/learners, guardians, institutions, configurable pipelines and stages, opportunities, enquiries, stage history, activities, tasks, demos/enrollment bridge links, channel accounts, conversations/messages, webhook receipts/outbox, consent, campaigns, attribution.
- Existing 80 public tables preserved. No existing tables dropped or altered by this migration.
- Added matching canonical fresh-install source: `database/01_install/modules/schema/12_connect_crm.sql` (automatically picked up by ordered installer generator).
- Added read-only verification script: `database/connect/verification/01_phase1_integrity.sql`.

## Successful database tests
1. Live migration succeeded.
2. Found exactly 28 new CRM tables and all 28 with RLS enabled.
3. Checked table PK and FK metadata; relationships were created.
4. Completed a transaction inserting a test adult, learner, family, guardian relationship, opportunity, course-linked learner, task, channel account, conversation, message, and consent. Transaction was rolled back, leaving zero test CRM people, opportunities, or messages.
5. Negative tests confirmed duplicate contact method, wrong-pipeline stage and duplicate provider webhook ID are rejected by DB constraints; tests rolled back.
6. All 28 CRM tables have no direct SELECT permission for `anon` or `authenticated`; service role can access canonical person table. Existing 80 public tables remain.
7. Migration recorded in Supabase migration history.

## Deliberate compatibility approach
- Portal remains operationally bound to legacy demo/onboarding/parent/student tables for now. This avoids breaking existing workflows while CRM services are not yet written.
- Canonical identity and CRM data will become authoritative when application routes are migrated in later integration work.
- Do **not** delete `demo_leads`, `student_guardians`, `parents`, `onboarding_submissions` or `family_introductions` until every dependent route and trigger has been migrated and tested.
- Supabase's security advisor lists existing informational RLS-without-policy notices, including 28 new server-only CRM tables, plus unrelated pre-existing security warnings. No blanket read policies added.
- The database has already been changed in Development. A Git branch does not isolate database changes.

## Remaining acceptance gates (NOT yet verified)
- Full local TypeScript, build, Playwright role/finance/demo/onboarding/Zoom regression suite against Development.
- Fresh database installation generated from the amended canonical modules and fully executed on a separate disposable test database.
- Authenticated server authorization tests for future Connect API endpoints (not yet built).
- Reconcile canonical identity and replace remaining duplicate source-of-truth fields when CRM-to-portal application integration is implemented.
- Benchmark real CRM workloads after services and indexes are exercised with representative test data.
- Review remaining source schema compatibility and admin/staff permission model in Phase 2.

## Current phase status
**Database foundation implemented and database-side tests passed; Phase 1 release gate remains OPEN.**
Do not claim 'no existing behavior breaks' until end-to-end portal regression and fresh-install tests pass.
