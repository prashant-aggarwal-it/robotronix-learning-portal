# Milestone 2 — Engineering hardening and release controls

## Scope and boundaries

Development and test infrastructure only. The Learning Portal and Connect CRM retain their existing domain ownership. No production schema changes, production data writes, `main` merge or deployment are part of this change.

## Implemented quality controls

1. `npm run check:connect-hardening` runs all Phase B/C/D source contracts plus fail-fast engineering checks for workflow wiring, authenticated RPC usage, tenant isolation, finance-field minimization, scheduler authorization and event idempotency markers. `npm run test:connect-business` executes real enquiry classification and Portal scheduling rules in Node.
2. `qa/connect-api-boundaries.spec.ts` exercises real HTTP API authentication and no-store response semantics. It runs on Connect branch pushes and PRs without requiring privileged credentials or contacting production.
3. `qa/connect-dev-integration.spec.ts` executes authenticated, read-only CRM → Portal API checks with an actual Development workspace. It rejects a wrong environment, requires a linked QA admin, verifies foreign-tenant denial and checks for sensitive fields in lifecycle responses. Missing fixtures are failures, not silent skips.
4. `qa/connect-responsive-a11y.spec.ts` checks visible Connect entry, labelled controls and document overflow at desktop and mobile widths. This is a smoke check, **not** a full WCAG audit.
5. The Connect branch workflow now requires a build, typecheck, structural/security checks, Phase B/C/D checks, production-dependency audit and HTTP boundary smoke. Authenticated/browser integration remains an isolated manual workflow requiring Development credentials.
6. The Connect reminder job now returns an opaque run ID and writes a minimal structured error code + stage to server logs. Tokens, request headers, contact data and database error messages are deliberately excluded.

## Evidence and known limits

- DEV `pg_cron` jobs `robotronix-connect-inapp-reminders` and `robotronix-connect-portal-lifecycle` were active at audit; recent executions were successful. Keep checking failures and last-run timestamps regularly.
- DEV RPC `connect_portal_demo_bridge`, `connect_portal_admissions`, `connect_portal_lifecycle` and `connect_sync_portal_lifecycle` were not executable by `anon` or `authenticated`, and were executable by `service_role`.
- Following migration `20261109_restrict_privileged_trigger_function_execute.sql` in **DEV only**, 22 trigger-only privileged functions have no direct execute permission for API roles. The advisor warning counts decreased from 37 to 15 (anon) and 57 to 35 (authenticated). All 62 existing relevant trigger bindings remain enabled. The remaining privileged scalar functions require role-by-role compatibility review before changing permissions.
- The Development database still has wider legacy Supabase security advisor warnings (including exposed `SECURITY DEFINER` functions and mutable search paths). Triage function-by-function; do **not** bulk revoke legacy permissions without consumer impact tests.
- Full live Zoom provider booking, acceptance tokens, a real guardian onboarding, trainer availability conflicts, payments, enrolled learner progress and renewals **cannot be certified** until representative QA fixtures and role credentials exist.
- Security source-contract tests are not penetration tests. A future release requires threat-model review, privacy and data-retention validation, backup/restore rehearsal, and an authenticated security assessment.
- Build/typecheck passing does not establish mobile UX quality, accessibility conformance or runtime performance under load.

## Merge protection — repository administrator action required

Workflow YAML cannot make itself mandatory. In GitHub repository Settings → Rules → Rulesets (or branch protection), configure `main` to require:

- Pull request reviews and no direct pushes.
- Up-to-date branch before merging.
- Successful `Connect branch validation / validate` and existing release/security checks, once their names appear in GitHub checks.
- No bypass by normal collaborators; prohibit force pushes.

The repo must run the PR workflows once before the status checks can be selected. The engineer must verify the ruleset is active; this document does not claim it has been remotely configured.

## Isolated Development E2E setup

Configure GitHub environment `qa` with `E2E_QA_BASE_URL`, `E2E_SUPABASE_PROJECT_REF`, Supabase URL/anon/service-role secrets, four Portal test-role logins, and `E2E_QA_CONNECT_COUNSELLOR_EMAIL/PASSWORD` plus `E2E_QA_CONNECT_VIEWER_EMAIL/PASSWORD`. Seed one Connect workspace owned by the QA admin, assigned to the counsellor and accessible as a viewer, plus a **verified** CRM → Portal admission/enrolment with a fee package and classroom. Set `QA_TARGET=dev` and run `Integrated authenticated E2E` manually. Do not point these tests at production.

Suggested QA journeys (writable tests must use disposable records and cleanup):

1. Counsellor books/reschedules/cancels a demo; Portal trainer conflict guard and Zoom guest restrictions remain enforced.
2. Guardian accepts an offer, verifies identity, activates onboarding; CRM moves to Won exactly once.
3. Session attendance/progress and invoices update Portal; CRM shows only approved read-only indicators.
4. Package renewal is signalled once per cycle and marking Contacted does not mutate Portal billing.
5. Unassigned counsellor/viewer and foreign tenant cannot read or change another learner.

## Operations and recovery

- Monitor scheduled jobs for **failed** outcomes, missing heartbeat (more than 15 minutes for a five-minute schedule), and unusually high processing latency. Escalate with job name and safe run ID, never full payloads.
- Keep reconciliation operations idempotent. Test retries, duplicate webhook events, concurrent stage updates, disabled integrations and expired tokens in Development.
- Before production migrations, export schema and test a point-in-time restore on a separate Development instance. Exercise roll-forward and rollback of the application code. Do not rely on a theoretical backup.
- Keep payment ledger and learner data inside the Portal, and avoid leaking personal data through dashboard logs, test artifacts and CI traces.

## Performance, accessibility and release budgets

- Measure user-critical journeys under normal and degraded network conditions. Proposed initial targets: 95th percentile CRM board load < 3 seconds, authenticated internal API responses < 800 ms excluding external provider calls, and no repeated full-page reload on stage drag/drop. These are **targets, not measured outcomes**.
- Run Lighthouse or equivalent in a production-like preview; review CPU-heavy tables, query plans and pagination once realistic record volumes exist.
- Verify keyboard-only navigation, visible focus, accessible names, contrast, browser zoom to 200%, mobile 360 px layouts, screen-reader descriptions and error announcements. The new smoke test covers only a small subset.
- Release evidence must include CI links, failing-test count, credential-required tests, DEV Supabase advisor review, data reconciliation outcome and an explicit go/no-go owner decision.
