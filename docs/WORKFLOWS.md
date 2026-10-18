# End-to-end operating workflows

Use this guide for **how to use the system**. For technical configuration, see [Environments](ENVIRONMENTS.md).

## 1. New family → active learner

1. Parent opens `/onboarding` and provides guardian(s), learner details, course interests, location/time zone, and preferred timings; siblings can share the family identity.
2. Admin opens `/admin/onboarding`, reviews the submission and completes missing details.
3. Admin creates/links the Student record, selects a Course, and makes an Enrollment (one-to-one or group/cohort).
4. Assign an eligible Trainer and confirm scheduling with the relevant time zone and availability.
5. Activate appropriate Parent access; optional Student access is a separate linking decision.
6. Verify Parent dashboard shows the learner and next steps.

**Checkpoint:** learner identity, parent link, enrollment, course and trainer must agree. Intake alone does not mean an active enrollment.

## 2. Existing learner migration

1. Choose the `active_existing` enrollment/migration flow.
2. Record original course start, purchased/planned sessions, opening completed sessions/minutes and portal tracking start.
3. Carry forward historical amount agreed/collected using migration finance fields.
4. Start recording *new* lessons and receipts from the portal go-live point onward.
5. Reconcile remaining lessons and balances. Never invent earlier classes or duplicate earlier collections.

## 3. Scheduling → delivery → progress

1. Admin configures an enrollment schedule or cohort; check Trainer availability and local/IST representation.
2. Verify the class event is visible in `/admin/schedule` and `/trainer/classes`.
3. For Zoom-enabled online classes, follow [Zoom guide](integrations/ZOOM.md) before starting a provider meeting.
4. Trainer conducts the session and records attendance and actual delivered duration.
5. Trainer records progress, observations, skills/projects and appropriate parent-facing notes.
6. Verify the Parent/Student view reflects permitted progress and that Trainer earnings follow recorded delivered time, not merely the schedule.
7. If class cannot happen, use cancel, hold, reschedule or makeup flows. Do not delete historical delivered classes.

**Checkpoint:** a completed lesson should have the correct status, attendance and progress; finance/payroll records should not be duplicated.

## 4. Demos → onboarding

1. Admin uses `/admin/demos` to organize a one-to-one/group discovery session and assign a Trainer.
2. Guest receives a restricted `/demo/[token]` link, not an Admin URL.
3. Trainer delivers the demo; mark attendance/outcome and publish allowed feedback.
4. Parent may submit help/reschedule requests through the guest experience.
5. Admin resolves requests and marks the lead appropriately; convert to onboarding using available prefill.
6. Check that Trainer/public guest APIs do not expose parent contact information unnecessarily.

## 5. Billing → reconciliation

1. Confirm the learner's enrollment and agreed package/fee terms.
2. Create/prepare invoice from the enrollment billing panel as applicable.
3. Admin reviews `/admin/invoices`, confirms correct amount, currency, payer, due date and Razorpay mode.
4. Issue/send only in intended provider mode; reconcile provider events and outstanding balance.
5. Review `/admin/finance`; monitor Trainer payroll separately in `/admin/trainer-finance`.
6. For discrepancies investigate invoice ID, provider sync state, payments and attendance before manually adjusting any ledger.

See [Razorpay](integrations/RAZORPAY.md).

## 6. Family support & renewal

1. Use `/admin/messages`, notifications and alerts for follow-ups and record continuity.
2. Parent tracks learner and schedules from `/parent`; Student login remains optional.
3. Check near-completion status/remaining sessions and offer a new renewal package or enrollment.
4. Do not overwrite historical course/fee agreements when renewing.

## 7. Routine operator checklist

- **Daily:** new onboarding/demos, today's classes, absent/missed sessions, help requests, messages and payment exceptions.
- **Weekly:** unresolved alerts, upcoming scheduling conflicts, learner progress, near-renewal students, Trainer payout exceptions.
- **At release:** follow [Testing](TESTING.md) and [Operations](OPERATIONS.md).
