# Robotronix Learning Portal — Release reconciliation and verification gate
Date: 2026-10-23
Baseline: `main` at `cd9ab5bb35348abc7622bf6d220cfa67b5453801`
Status: **Audit in progress; no production-readiness certification.**
Purpose: prevent approved fixes from being omitted while preserving the Zoom Marketplace review build.

## Branch reconciliation (GitHub compare, 2026-10-23)
The following historical application branches are **ancestors of main**, not outstanding application merges:
- `release/consolidated-stabilization-20261020` (main 6 commits ahead)
- `feature/production-hardening-v1`
- `feature/zoom-classroom-v1`
- `fix/p1-action-notifications-20261020`
- `fix/p2-p3-live-sync-reliability-20261020`
- `chore/consolidated-fresh-install-20261018`
- `release/final-2026-10-16`

**Exception:** `security/prod-qa-fixtures-20261022` diverged (6 commits unique to branch, 3 commits unique to main), PR #16. Changes are isolated production QA provisioning/seed/cleanup files, not runtime application fixes. Do not merge or run against production until verified against actual schema and authorized identities. Nine Dependabot branches diverged by one commit each; these are dependency/CI upgrades, not missing business-feature fixes. Rebase and test each upgrade separately if needed.

Open historical PRs #3, #4 and #5 have draft descriptions written before their branches were consolidated. Their OPEN state is not proof that changes are absent; compare history and validate their acceptance criteria before closing as superseded. PR #16 remains a separate candidate.

## Source-of-truth rule
`main` is the intended release code baseline, **conditional on** deployment SHA verification, passing release gates, and manual acceptance. Do not merge security QA fixtures or Dependabot branches merely to make main 'ahead of everything'. Do not reset/force-push main. Netlify production deployment must point to a known main commit. Database is separately deployed and must be checked against canonical SQL.

## Requirements verification matrix
Statuses below distinguish **historically implemented / present in merged branches** from **independently tested on current main**. No fresh Playwright, build, Supabase, Zoom or Netlify run was executed during this audit.

| Area | Required acceptance check | Current verification |
| --- | --- | --- |
| Admin onboarding | New parent, trainer, student onboarding; admin notification `onboarding_submitted` persists via AFTER INSERT trigger; roles correct | Needs fresh DB/runtime verification |
| Trainer availability | Multiple slots, date overrides, overlap prevention, copy-to-day updates existing values and admin receives appropriate notification | Needs manual regression |
| Enrollments/cohorts | Full-course scheduling, 30-minute increments, timezone conversions including cross-midnight, safe cancellation/hold | Needs manual + automated regression |
| Class lifecycle | Schedule/start/join/end/attendance/progress; no deleting class with payroll/attendance/learning records | Needs live test |
| Zoom | Existing host retained; host ownership/concurrency; recording sync/playback/delete/expiry/access, token and webhook handling | Needs live test; do not disrupt Marketplace review |
| Payroll/finance | Delivered-hour calculations, no-show/cancellation policies, locked payout restrictions and finance review | Needs finance-specific QA |
| Notifications/realtime | Cross-role action-required notifications, missed-event recovery, RLS-safe live updates | Needs cross-role two-browser test |
| Parent/student | Google onboarding, student optional login, parent access controls, timezone, progress and recordings | Needs real-role test |
| Security | RLS and role isolation, no cross-family data, token encryption, TLS, webhook verification | Needs environment-specific verification |
| Public pages | Privacy, Terms, Support, Zoom Guide accessible and factually accurate | Pages in main; verify deployed pages |
| UI/UX | Premium theme selection, uncluttered actions, trainer/parent clarity and mobile layout | Needs manual visual acceptance |
| Demo | Approved demo flows; distinguish requested CRM removal from implemented features | Needs owner-approved scope and QA |
| Data installation | Canonical fresh schema and reference data; production migration state matches expected SQL | Needs controlled DB comparison |

## Execution gate (run on clean checkout of main; keep secrets out of logs)
1. Record `git rev-parse HEAD`, `git status --short`, and production Netlify deploy SHA; ensure desired equivalence.
2. Use the project's approved Node version and install dependencies from lockfile: `npm ci`.
3. Run `npm run check:release`, `npm run typecheck`, `npm run build`; save exact output and timestamps.
4. In isolated QA environment with dedicated identities, run `npm run qa:prod-gate` and `npm run qa:security-dev-all` where configured; document skipped/blocked tests. Do not point destructive fixtures at live user data.
5. Verify fresh-install SQL and the onboarding notification trigger/function explicitly; review migration status without resetting production.
6. Perform two-browser Admin/Trainer/Parent/Student manual end-to-end testing with synthetic data. Capture defects, owner, priority, reproduction and retest proof.
7. Confirm Zoom review environment remains stable; test meeting/recording workflow using an existing authorized host and dedicated test users, without disconnecting hosts or changing OAuth app credentials.
8. Reconcile security evidence: Semgrep retest zero reported findings **with 25 partial-parsing warnings**, ZAP baseline findings requiring triage; unauthenticated passive DAST is not a comprehensive penetration test.
9. Update the Zoom evidence checklist to reflect **production Marketplace app submitted 2026-10-23**, while keeping prior **Beta review** status distinct. Submission is not approval.
10. Only after all blocking gates pass, mark release accepted and merge this audit document (and any separately reviewed fixes) into main.

## Outstanding decisions
- PR #16: decide whether production QA fixtures are needed; independently review provisioning and cleanup safeguards.
- Dependabot: separately test action/dependency upgrades, especially major version changes.
- Open historical draft PRs #3/#4/#5: reconcile against merged main and close as superseded **only after** confirming no unique requested acceptance criteria remain.
- No claim of 'all requirements fixed' until the matrix has evidence.
