# Trainer payout approval and netbanking — next release candidate

**Current state:** New UI and schema migration are committed on `release/consolidated-stabilization-20261020`. No DEV SQL execution or browser QA has been performed. Do **not** use this unverified code for real salary processing.

## Business rules
- Trainers decide which bank/UPI details to submit. Admin verifies completeness, acknowledges review and decides *when those details may be used* for payroll.
- Reviewer sees **currently approved vs proposed** fields with changed-field emphasis, masked defaults, a controlled reveal and an explicit confirmation step.
- A correction or rejection requires an explanatory note. Review does **not** prove ownership of the account; Admin must perform independent verification if required by policy.
- After approval, trainer sees updated profile details but the new payout instructions have a separate **effective payroll month**. Previously locked monthly payouts do not change.
- Default cutoff: **25th of the month in Asia/Kolkata**, adjustable via `public.system_settings.trainer_payout_change_cutoff_day` (integer 1–28). Approval after cutoff, or after that month's payroll is approved/paid, is effective next month.
- Salary is paid **manually through netbanking**. Portal records status, amount, payment date and UTR/transaction reference; it must not initiate a bank transfer.
- Once a payout is approved, the record's amounts/instructions are locked; when marked paid, it requires date and bank transaction reference, and becomes immutable. Corrections require an explicit audited adjustment process instead of overwriting paid records.

## Data design and migration
- `database/01_install/07_TRAINER_PAYROLL_CUTOFF.sql`: additive migrations, payout-instruction version history, cutoff calculation, approval RPC update and immutable per-month instruction snapshot.
- Fresh database: consolidated `01_CREATE_SCHEMA.sql` includes it.
- Existing DEV: run migration 07 *after* scripts 04–06 where applicable. Confirm baseline and existing table shapes first.
- **Never rerun the full fresh installer on Production.** No DB migration has been run yet.
- Sensitive account values in snapshots and versions are protected by table RLS; test non-Admin access before deployment.
- Admin direct edits to payout fields are also versioned. Corrections to an approved bank account never rewrite a previously approved/paid salary instruction snapshot.

## Required DEV tests
1. **BANK-01** Trainer submits new account: Admin receives notification; current approved version is unchanged.
2. **BANK-02** Admin comparison view: before/after values correct, masked until authorized reveal; cancellation and rejection do not change approved instructions.
3. **BANK-03** Correction request with empty reason is rejected; meaningful note succeeds and trainer sees correction status.
4. **BANK-04** Approval on day 20 before any monthly payout locks: `effective_payroll_month` is same current IST month.
5. **BANK-05** Approval on day 27: effective next month. Simulate dates in isolated DEV with controlled clock injection/test transaction; **never adjust Production server clock**.
6. **BANK-06** Approval after current-month payroll marked approved/paid: effective next month even before calendar cutoff.
7. **BANK-07** Admin direct finance edit also writes effective-dated version.
8. **BANK-08** Payroll status draft→approved captures the correct applicable bank/UPI instruction version for that *specific* month.
9. **BANK-09** Trainer changes account after lock; snapshot on existing approved/paid payout remains identical.
10. **BANK-10** Attempt to edit an approved amount, revert approved to draft, edit a paid payroll, or mark paid without UTR/date: database rejects it.
11. **BANK-11** Admin records synthetic netbanking UTR, date and amount; trainer sees paid status; no external transfer occurs.
12. **BANK-12** Unauthorized Trainer A, Parent or Student cannot query Trainer B's payout history, log messages or bank numbers.
13. **BANK-13** Legacy approved/paid payout backfill and migration behavior checked on isolated *copy* of DEV data before release.
14. **BANK-14** Check last-day month rollover (Jan 31, Feb 28/29, Apr 30) and timezone-specific cutoff.
15. **BANK-15** Race: concurrent Admin approval and payroll finalize do not allow a post-cutoff update to change an already locked payment.
16. **BANK-16** Verify no account, PAN, UPI or UTR leaks to Notification messages, cross-role app responses or server logs.

## Existing limitations to resolve before completion
- Production-grade DEV acceptance requires database migrations 04–07 and full concurrent authenticated browser tests. They have not run.
- The current Admin payroll form may need user-visible display of the snapshotted instruction version applicable to the month being paid.
- Formal bank ownership verification is not built into the portal; distinguish manual review from real bank verification.
- Support for exceptional effective-month overrides must be auditable and not modify finalized salary instructions.
