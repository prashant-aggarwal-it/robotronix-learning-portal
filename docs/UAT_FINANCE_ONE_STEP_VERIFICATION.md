# UAT-FIN-01 — One-step payout approval and Admin verification

**Branch:** `fix/finance-one-step-admin-verification-20261104`
**Status:** Committed on a separate branch. **Not merged, not deployed, and no database changed.**

## Decision model

- **Approve & verify payout details:** Admin reviews proposed payout details and approves them once. The existing atomic `review_trainer_finance_request` RPC creates the versioned payout instruction, applies the approved details to `trainer_finance`, sets `compliance_status = 'verified'`, and marks the request `approved` in one transaction. `verified` explicitly means **Admin verified**, not verified independently by a bank or other external provider.
- **Request correction:** Trainer receives a correction request. Existing approved payout details, verification status and historic payroll instructions remain unchanged.
- **Reject change:** Request is rejected. Existing approved payout details, verification status and historic payroll instructions remain unchanged.
- **Exception:** An Admin can still edit the finance profile and manually override verification to Pending or Needs correction. This is not part of the ordinary review flow.
- **Payment cutoff:** Existing payroll-month cutoffs, payout instruction versions and approved/paid payroll locks remain unchanged.

## User experience

- Admin compares highlighted field changes.
- Selects one decision.
- Presses the single decision-specific button: **Approve & verify payout details**, **Request correction**, or **Reject change**.
- Approval immediately updates the displayed payout-verification summary to **Admin verified**. No separate compliance dropdown save is necessary.
- Invalid bank/UPI details are rejected by the database before any approval is committed.
- Bank/PAN/UPI values remain masked by default on the comparison screen.

## Database migration

### Fresh installs
The updated `database/01_install/modules/schema/07_notifications_security_and_lifecycle.sql` contains the new RPC. Install the fresh database only through the canonical fresh-install workflow.

### Existing installs
The separate upgrade `database/04_existing_db_migrations/20261104_finance_one_step_admin_verification.sql` only replaces the existing RPC. **Do not run it on Production until reviewed, backed up, and tested on DEV.**

No previous request is reapproved or silently backfilled. **A trainer with historical approved payout changes but a currently Pending verification state remains Pending until the Admin explicitly verifies them**; no retrospective automatic verification.

## Regression checks

1. Admin approves a new, valid bank detail change → request is Approved, finance is Admin verified, values match, payout version created once, correct effective payroll month recorded.
2. Bank details missing name/account or with invalid IFSC → approval fails atomically, finance/request statuses unchanged, no payout instruction version created.
3. Invalid UPI → fails atomically with no status/version changes.
4. Request correction with reason → status correction_requested, current finance data and verification unchanged; trainer can submit updated details.
5. Reject with reason → status rejected, current finance data and verification unchanged.
6. Concurrent/repeated approval → only one approval/version; second request rejected because it is no longer pending.
7. Non-Admin calls to approval RPC → denied by `public.is_admin()`.
8. Existing Approved/Paid payroll instructions and amounts remain locked; cutoff policy is unchanged.
9. Change from Verified to Needs correction via exceptional Admin override remains possible.
10. No raw account, PAN, UPI values appear in toast/error messages or logs.

## Automated/source verification

`npx playwright test qa/finance-one-step-verification.spec.ts --project=desktop-chromium`

Source-level contract tests are not a substitute for running DEV database integration/UAT above. Before eventual merge, also run `npm run typecheck`, workflow tests, and the relevant payroll/finance suites. Do not enable Netlify deploys for this branch without authorization.
