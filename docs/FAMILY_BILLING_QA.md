# Robotronix Family Billing – Implementation and QA
Status: QA branch implementation, not a production release.

## Scope implemented
- Family Portal navigation: **Fees & Payments** (parent-scoped read-only view).
- Per-enrollment configurable billing: session packages (8 suggested), monthly, per-class, fixed course, open-ended and custom.
- Optional session limit on non-session packages; per-class rates accrue on eligible conducted classes recorded in attendance.
- Parent package overview: agreed fee, verified net collections, outstanding, due and (where applicable) included/used classes. Class delivery and payment status remain separate.
- Parent payment and refund history; international Razorpay issued-invoice links.
- Admin fees: create agreement, edit unbilled agreement, renew by copying terms, cash/UPI/bank/cheque and refunds.
- Offline collection metadata: collector, location, transaction reference and automatic unique receipt number.
- One family receipt with atomic allocations across multiple learners in one currency; one notification per grouped payment.
- Recorded direct payments/refunds notify linked parents once per ledger row; Razorpay callbacks are verified and idempotently post payment entries, including partial payments.
- Parent-scoped RLS for fee packages, transactions, family receipts and non-draft invoices. Paid/invoiced package terms cannot be edited silently.
- Schema and logic are consolidated into canonical module SQL; development Supabase updated.

## Critical interpretation
- `session_package`: price is for the whole agreed package; sessions are an entitlement count, not a proxy for collections.
- `per_class`: `amount` is a rate per eligible delivered class; `installments=[]`; money owed accrues based on actual class/attendance records.
- `monthly`, `fixed_course`, `open_ended`, `custom`: amount is an agreed fee for the specified coverage dates; no arbitrary session cap.
- The configured **charge absences** option counts a conducted session marked absent toward package usage only when agreed with the family.
- Additional classes, manual credits and paid-session booking controls elsewhere in the portal still need cross-module reconciliation before enforcing financial entitlements.
- Fees may use different currencies; balances must never be combined across currencies without an explicit exchange-rate conversion.
- Cash receipts are printed from the verified internal ledger. They are not substitutes for tax-compliant invoices.
- Razorpay provider payment verification remains server-side; the parent app does not mark transactions paid on its own.

## Development-only checks already completed
- Database rollback test: nullable sessions, per-class package and cash receipt number.
- Database rollback test: a combined cash payment creates one receipt and two valid allocations; mismatched totals fail.
- Database rollback test: unbilled terms are editable, terms with payments are immutable.
- Database rollback test: one payment notification for direct entries and one grouped-family notification.
- GitHub Actions: branch typecheck/build, release checks and security audits. See run results for current head before merge.

## Manual QA checklist
1. Log in as Parent A and Parent B. Each should only see their own learner packages, invoices and family receipts; attempt direct REST access to the other's IDs and verify rejection.
2. Test one 8-session package with full, partial, advance and refunded receipts. Compare parent and admin totals.
3. Create monthly and open-ended packages with no session quota; confirm there are no fictitious "0 of 8" warnings.
4. Create per-delivered-class billing with attended, late, absent, cancelled, rescheduled and tentative occurrences; only eligible delivered classes should incur charges, subject to explicit absence policy.
5. Record one cash payment (with collector and location), one UPI payment, one bank transfer and a cheque; verify receipt sequence and parent history.
6. Record one family payment split across two learners in the same currency; parent sees a single family receipt with both allocations and one notification.
7. Reject cross-family package allocation, mixed-currency allocation, duplicate reference and unequal sum.
8. Verify parent cannot insert/update/delete fee data, even using their own browser Supabase client.
9. Renew the same learner with a new price or session entitlement, preserving previous receipt and ledger.
10. Attempt editing an invoiced or paid package via UI and API; confirm DB rejects it.
11. Reconcile Razorpay full and partial payment webhooks (including retries) and verify no duplicate payment records.
12. Compare INR and three-decimal currency transaction precision (BHD, KWD, OMR).
13. Confirm invoice links only for issued/paid invoices, not draft/reviewed invoices.
14. Confirm responsive design and accessible text/controls on laptop, tablet and phone.
15. Check business receipt and tax-invoice wording with a qualified accountant before customer rollout.

## Not yet included / separate release requirements
- New domestic statutory/GST invoice generator and PDF numbering workflows.
- Automated payable reminders and per-class balance alert rules.
- Parent-initiated domestic Razorpay checkout for all billing models (existing international invoice links remain available).
- True multi-package credit transfers, non-cash adjustments and consolidated general ledger.
- Complete authenticated browser E2E against all QA users and payment provider sandbox.

Do not deploy to production or merge into `main` until the full financial QA and accounting review have passed.
