# Robotronix — Consolidated stabilization backlog (2026-10-20)

**Authoritative tracking for the next reconciled release.** This list records requirements and status; it is not a claim that pending features are implemented. Never lose previously working production, SQL, QA or packaging fixes in a future consolidated ZIP/PR.

## Branch and release strategy
- Existing consolidated candidate: `chore/consolidated-fresh-install-20261018`
- P1 event notifications: draft PR #3, `fix/p1-action-notifications-20261020`, untested against DEV/Prod.
- P2/P3 live sync: draft PR #4, `fix/p2-p3-live-sync-reliability-20261020`, stacked on P1, untested against DEV/Prod.
- Keep Production untouched until DEV SQL migration, QA, security review and explicit deploy approval.
- Before final merge, reconcile all approved fixes into **one** tested release with canonical fresh-install SQL plus separate safe incremental migration SQL; include release verification and documentation.

## Outstanding product changes

| ID | Priority | Requirement | Status | Release acceptance |
|---|---|---|---|---|
| FIN-UX-01 | P1 | Admin payout-review screen must compare **currently approved vs new proposed** account-holder name, bank name, bank account (masked default; restricted full review if appropriate), IFSC, UPI, PAN and payout method. Explain changed fields and approval purpose. | Source UI implemented on consolidated branch; QA pending | Admin can meaningfully review without approving on last four digits alone |
| FIN-UX-02 | P1 | Clear Trainer Profile separate **approved** and **pending** payout details; correct missing spacing, statuses; show corrections and review results, avoid implying that 'approved' means bank ownership was independently verified. | Pending | Both roles see unambiguous pending/approved statuses and changes |
| FIN-UX-03 | P1 | On correction request require Admin reason and make resubmission clear; preserve previous approved details until decision; maintain audit history without exposing secrets in notifications. | Pending | Rejection/correction/approval paths and audit tested |
| FIN-PAY-01 | P1 | Manual netbanking only. Admin records salary paid/date/amount/UTR; Trainer sees payroll/payment history; no Razorpay payout automation. | Pending | No simulated automatic bank transfer; paid status Admin-controlled |
| FIN-PAY-02 | P1 | Define configurable monthly **cutoff, payroll lock, effective payout cycle**, and Admin exceptions. Trainer can submit changes any time but cannot unilaterally apply them to the current salary payment. | Pending | Before/after cutoff, approval timing and locked-payroll cases tested |
| NOTIF-01 | P1 | Finance, onboarding, critical schedule, alerts and actionable messages create persistent role-targeted notifications without leaking financial data. | Draft code PR #3, DEV QA pending | Cross-role, dedupe, RLS and offline QA |
| LIVE-01 | P1 | Required cross-role screens refresh on relevant data changes; reconnection/focus/periodic recovery and private subscriptions. | Draft code PR #4, DEV QA pending | Two-session realtime and permission QA |
| AUTH-01 | P1 | Unified Google OAuth + email-OTP passwordless sign-in for Admin-approved trainer access; optional welcome mail, no mandatory invite token for Google flow. Preserve existing links/accounts/roles; extend to Parent/Student as appropriate. | Pending | Existing and new Gmail/non-Google-email accounts work without duplicates |
| LOG-01 | P1 | Structured server-side errors, request IDs, redaction and secure Admin System Logs UI; review Supabase/Netlify/provider observability without logging secrets. | Pending | Restricted error log, filters, correlation and retention tested |
| DOC-01 | P1 | Single documentation hub with verified dashboard settings/navigation/ownership for Supabase Auth/SMTP/Google, Netlify, Zoom, Razorpay; explicit Development vs Production and troubleshooting. No credentials in GitHub. | Pending consolidation | Setup and recovery instructions validated |
| DOC-02 | P1 | End-to-end workflow manual test scripts, expected outcomes, negative tests, test-account setup, DB verification and Playwright references for Admin/Trainer/Parent/Student. | Pending consolidation | Every changed workflow documented and regression-tested |
| ZOOM-01 | P1 | Recording playback from portal fails with stream 401 despite Zoom provider playback; fix signed authorization flow securely. | Pending | Authorized playback works; unauthorized access denied |
| ZOOM-02 | P1 | Recording delete claims success but returns after Zoom sync. Decide remote-delete vs portal-hide semantics; never delete remote recordings without explicit approval. | Pending | State remains correct after sync, audit and provider regression |
| ZOOM-03 | P2 | Group meeting video/audio/timeline recordings under one meeting, expandable actions, responsive MB display. | Pending | One grouped meeting card, correct files/actions |
| ZOOM-04 | P1 | Meeting SDK 'other meetings in progress' conflict handling, Zoom Host 2 external-sharing approval constraints. | Pending / provider dependency | Graceful host conflict; Host 1 undisturbed |
| DEMO-01 | P2 | Schedule/demo pipeline responsive usability, action overflow and clearer Asia/Kolkata time display. | Pending | Desktop/mobile flow tested |
| DEMO-02 | P2 | Improve Parent/Student demo experience, thoughtful visuals and concise guest flows. | Pending | Role-specific UX tests |
| CRM-01 | P2 | Hide unnecessary CRM/admissions/lead-conversion UI (not underlying data) until needed. | Pending | No data loss and valid navigation |
| QA-01 | Release gate | DEV automated checks, auth/role/workflow tests, finance, Zoom, notifications, RLS, mobile, SQL install/migration validation and controlled Production smoke tests. Preserve every previously fixed QA path. | Pending | Results tied to exact commit / environment; no unsupported PASS claims |

## Current QA observation: Trainer payout
- Trainer submits payout changes; database shows pending.
- Admin pending list provides only short masked account summary; not enough for meaningful review.
- Admin approval action reported successful.
- Trainer view remained stale without browser refresh, and no approval notification observed (Production before draft fixes).
- The P1 and P2/P3 draft changes require DEV verification; never mark observed Production failure resolved solely from GitHub commits.

## Non-negotiable release safeguards
1. No Production database reset, QA seeding, silent deployment, destructive Zoom recording action or release branch merge without authorization.
2. Finance changes never silently alter finalized payroll payment instructions.
3. Sensitive payout details restricted at storage, RLS, API, logs and notifications, with masking by default.
4. Each implemented item updates this tracker, relevant integration/workflow document, test case and release notes.
5. Reconcile all earlier fixes including onboarding Admin notification trigger, timing stability, QA scripts, payroll guards, and portal-access changes.

## Consolidated release candidate implementation log

- 2026-10-20: Created `release/consolidated-stabilization-20261020` from P2/P3, retaining P1–P3 changes. Implemented `components/finance/PayoutReview.tsx` and integrated it into Admin Trainer Details as a restricted before/after review, with masked defaults, deliberate confirmation and mandatory correction/rejection reason. **Not tested or deployed.**
- Remaining backlog items are **not completed** merely because the release branch exists. Each requires source implementation, security review and documented tests.

- 2026-10-20: Began LOG-01: Admin-only System Logs page and read API, RLS-enabled server-only `portal_system_logs` database table, safe logging helper, and portal access error-path integration. Canonical fresh-install and existing-install migrations prepared. **Partial implementation only**; coverage across remaining Zoom/Razorpay/scheduling endpoints, retention jobs, DEV QA and security testing remain pending. No live migration has run.
