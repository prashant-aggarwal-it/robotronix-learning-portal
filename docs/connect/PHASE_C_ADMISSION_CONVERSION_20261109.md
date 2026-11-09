# Phase C — Admissions, verified onboarding and enrolment confirmation

Status: **Implemented in feature branch and Development schema. Live cross-role UAT outstanding.**

## Business behavior

1. CRM admissions pipeline has a new **Admission → Learning Portal** workspace. Sales records a guardian-accepted offer snapshot (fee, currency, sessions, terms and acceptance attestation).
2. Connect creates a 256-bit invitation secret, stores only its SHA-256 hash, and provides a link to the existing parent-owned Portal `/onboarding` flow. Same request ID and payload is idempotent; conflicting request ID/offer or a second active offer is rejected.
3. The guardian signs into Portal and submits the normal consented family/learner onboarding. The submitted onboarding ID is linked using the invitation token and authenticated account ID.
4. A verified parent email matching the CRM guardian contact marks the handoff `onboarding_pending`. An unmatched/missing email becomes `review_required` and requires a dual CRM+Portal administrator to record a verification evidence note.
5. Portal Admin retains responsibility for setting course, trainer, schedule and financial prerequisites and activating the enrolment. CRM does **not** create academic student/enrolment records.
6. After Portal marks onboarding `active` with an **active, matching enrolment and student**, reconciliation marks handoff `enrollment_confirmed` and moves the opportunity to the Won stage exactly once. The database prevents premature Won transitions in connected workspaces.
7. The five-minute Development job also processes published demo/no-show outcomes into deduplicated CRM follow-up tasks. CRM demo cards show sales-safe published feedback only, excluding trainer private notes.

## Authority and privacy

- Connect `portal_admission_handoffs` remains a private-schema table, accessible only via service-role RPC with tenant membership checks.
- Parent token preview returns minimum prefill; token binding requires a valid signed-in account, its own onboarding submission, explicit data consent and the intended learner's name.
- Guardian verification requires confirmed matching account email or admin evidence review. Phone number alone never auto-verifies.
- Sales can record an accepted offer but cannot activate a Portal enrolment. The Won gate is database-enforced.
- No direct cross-product foreign keys, no Portal participant private mentor notes projected into CRM.

## Dev database source and scheduler

- `52_portal_admissions_handoffs.sql`: handoff ledger and Won transition guard.
- `53_portal_admissions_rpc.sql`: tenant-scoped offer, review, revoke, list, reconcile.
- `54_portal_admission_token_rpc.sql`: secure parent prefill and binding.
- `55_portal_demo_followup_sync.sql`: at-most-once outcome tasks.
- `56_schedule_portal_demo_followups_dev.sql`: extend Development CRM reminder schedule.
- `57_auto_reconcile_portal_enrollments_dev.sql`: once-only background confirmation and automated Won.

Development cron `robotronix-connect-inapp-reminders` remains every five minutes. The optional signed HTTP job route also runs both workers. **Do not configure a duplicate Development HTTP schedule.** Production deployment and cron setup were not performed.

## Acceptance/UAT checklist — mandatory before release

1. Sales accepts offer against an open opportunity and linked learner; duplicate request returns same handoff and another active offer is rejected.
2. Guardian invitation works and cannot be guessed, reused to bind another submission, or used after expiry/revocation.
3. Parent signs into Portal, sees the correct prefill, submits consented onboarding, and linkage is created exactly once.
4. Guardian account with a matching verified CRM email is auto-verified; a mismatched email requires dual-admin evidence review.
5. Cross-tenant, CRM viewer, non-owner/manager, and forged onboarding ID attempts fail.
6. Attempt to drag a connected opportunity to Won before Portal activation: rejected with a useful explanation.
7. Activate onboarding through Portal's existing admin workflow, including financial/course/trainer/schedule checks. After worker/reconcile, exactly one CRM Won stage event and one confirmed enrolment link appear.
8. Re-run reconciliation and concurrent workers: no duplicate handoff, CRM stage event, or follow-up task.
9. Publish trainer demo summary or record no-show: CRM sees only approved fields and the follow-up job creates one appropriate task.
10. Regress standard Portal-only onboarding and CRM-only appointments; verify no records were modified in production.

## Release caveats

- Connected Phase B booking itself still awaits live Zoom/role UAT. Phase C is integrated in source and Development DB, **not production proven**.
- This is the shared-app/shared-DEV-DB adapter, not the future independent SaaS HTTP/event gateway. Durable cross-deployment event handling and identity-install lifecycle remain roadmap work.
- The active-offer invitation is displayed once at creation; to replace a lost link, a manager must revoke the pending offer and issue a new invitation.
- The current guard enforces Portal enrolment confirmation for Won on connected admissions pipelines. Independently operated CRM tenants remain unaffected until they enable the integration.
