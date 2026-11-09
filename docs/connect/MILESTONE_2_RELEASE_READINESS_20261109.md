# Milestone 2 — Integration QA and release-readiness evidence

**Audit date:** 2026-11-09  
**Branch:** `feature/robotronix-connect-crm`  
**Decision:** **NO-GO for a production release**, pending authenticated Development journey tests and repository merge-rule verification. This is a QA finding, not a failure of the currently passing local checks.

## Scope and protections

This pass examined Connect CRM and the Learning Portal through the Phase B/C/D contracts and Development-only inspection. It did not merge to `main`, deploy, modify the production database, or commence Phase E. No QA account was provisioned by directly writing to Supabase Auth internal tables.

## Executed evidence

| Gate | Result | Meaning and limits |
| --- | --- | --- |
| `npm run check:release` | **PASS — 20/20** | Typecheck, structural, communications, finance, migration, demo, calendar, security-adjacent and other existing release checks. Many are deterministic source/contract checks, not live workflows. |
| Offline Playwright: `security-static`, `learner-journey-navigation`, `workbook-export` | **PASS — 42/42** | No network or login required; run with `QA_NO_WEBSERVER=1`, desktop Chromium. |
| Offline Playwright: `parent-billing-config`, `scheduling-v2-preview`, `schedule-capacity`, `form-error-validation`, `phase3-validation` | **PASS — 29/29** | Finance, scheduling and form-rule regression coverage; same isolated runner. |
| `npm run check:connect-hardening` | **PASS** | Phase B, C, D and engineering source invariants. |
| Development scheduled jobs | **PASS — observed executions** | `robotronix-connect-inapp-reminders`: 288 succeeded / 0 failed in prior 24h; `robotronix-connect-portal-lifecycle`: 10 succeeded / 0 failed. Both active, each scheduled every five minutes. SQL observation does not prove downstream delivery. |
| Development privileged trigger execution hardening | **PASS — prior DEV migration verified** | 22 trigger-only functions no longer directly executable by API roles; 62 related trigger bindings retained. Legacy function warnings remain separately tracked. |
| Authenticated cross-app Playwright and real Zoom/provider/billing workflows | **BLOCKED — NOT EXECUTED** | Insufficient Development test identities, records, and configured credentials. Do not interpret as passed. |
| Real browser responsiveness, WCAG conformance, load and recovery rehearsal | **NOT CERTIFIED** | Require authenticated preview, representative data, testing infrastructure and isolated recovery target. |

## Development fixture inventory (read-only)

| Entity | Count |
| --- | ---: |
| Supabase Auth users | 10 |
| Connect workspaces / active memberships | 1 / 1 |
| Portal admin profiles | 1 |
| Portal trainer / parent / learner profiles | 0 / 0 / 0 |
| Portal enrolments / scheduled classes | 0 / 0 |
| Confirmed Connect admission handoffs | 0 |

This database is not yet an end-to-end QA fixture. Existing Auth users alone do not establish the trainer, guardian, learner, counsellor and viewer permissions required by the tests.

## Blocking setup: minimum administrator actions

1. **On Development only**, create or reuse dedicated QA accounts through Supabase Auth Admin (not direct `auth.users` SQL). Assign linked Portal roles: admin, trainer, parent and learner; assign Connect counsellor and viewer memberships. Ensure each role signs in successfully. Use synthetic names and emails.
2. In Development, create a representative trainer schedule/availability, parent–learner relationship, course/cohort, enrolment, fee package and at least one class; create one CRM enquiry, linked demo, verified accepted offer and confirmed admission handoff. Include a second Connect workspace to test denial of foreign-tenant access. Avoid real parent or child information.
3. Configure GitHub **environment `qa`**. Variables: `E2E_QA_BASE_URL` (reachable Development preview only), `E2E_SUPABASE_PROJECT_REF=fflejkqcspivnhsmkdtn`. Secrets: `E2E_SUPABASE_URL`, `E2E_SUPABASE_ANON_KEY`, `E2E_SUPABASE_SERVICE_ROLE_KEY`, and `E2E_QA_{ADMIN,TRAINER,PARENT,STUDENT,CONNECT_COUNSELLOR,CONNECT_VIEWER}_{EMAIL,PASSWORD}`. Do not commit or paste secrets into reports. The workflow refuses an unconfigured or non-development target.
4. Run GitHub Actions **Integrated authenticated E2E (isolated QA only)** via `workflow_dispatch` on this feature branch. Review uploaded Playwright failures; then test a real demo booking/reschedule/cancel with Zoom test accounts, role denial, offer redemption, idempotent handoff, attendance, billing summary, renewal and retry/reconciliation. Test write journeys on disposable QA records with teardown.
5. In GitHub Rulesets/branch protection for `main`, require PR review, up-to-date branch and passing `Connect branch validation / validate` plus applicable existing release/security checks. Confirm enforcement with a deliberately failing PR check; merely storing workflow YAML does not enforce a protected branch.

## Security and operational residual risks

- The Development Supabase advisor still reports legacy executable `SECURITY DEFINER` scalar routines, mutable function search paths, an extension in the public schema and RLS-enabled tables with no policies. Not all warnings imply an exposed table: analyze schemas and callers individually before restricting access. The prior trigger-only restriction is verified, but this is **not** a penetration-test certificate.
- Supabase Auth leaked-password protection requires account-level enablement in **Development** settings for verification, followed by separately approved production configuration.
- The scheduled jobs ran successfully in the observed window; external message delivery, retries under failure, idempotency under contention, alert routing and a real database restore were not exercised in this pass.
- Real browser/mobile accessibility, privacy/consent, retention, payment provider sandbox operations, load/latency, Zoom guest controls and cross-tenant authenticated adversarial testing remain release gates.

## Recommendation

Keep the branch unmerged and Phase E paused until the Development fixtures and secret environment are provisioned, integrated E2E evidence is green, remaining security advisories are triaged with authorization tests, an isolated backup/restore rehearsal is recorded, and a repository administrator confirms the mandatory merge rules. The passing local gates support continued engineering work but do **not** justify claiming complete integration QA or production readiness.
