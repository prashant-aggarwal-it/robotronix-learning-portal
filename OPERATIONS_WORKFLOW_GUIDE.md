# Robotronix™ Learning Portal — Operational Workflow Guide

This is the recommended day-to-day sequence so the portal remains the system of record.

## 1. Family and learner onboarding

For a new family, use Family Onboarding. Review guardian, learner, timezone, preferred timings, grade/age and course interest before approval. Reuse an existing parent/family when adding a sibling rather than creating duplicate family records.

For an existing active learner being migrated into the portal, use the active-existing migration flow. Enter the learner's true historical enrollment start date, agreed/planned sessions, opening completed sessions/minutes, portal tracking start date, negotiated fee/package, historical amount already collected and migration note. Do not create fake historical class events.

The enrollment start-date protection intentionally blocks backdating for normal/new enrollments but allows it for `active_existing` migrations.

## 2. Enrollment and finance

Create a new enrollment for each new course/renewal. Preserve the negotiated terms of an old enrollment rather than overwriting them later. For migrated learners, use the opening finance values to carry forward the amount already collected and let the portal calculate the remaining balance. New post-go-live payments should be recorded normally.

Use hold/resume when a learner temporarily pauses rather than deleting operational history.

## 3. Trainer setup and scheduling

Maintain trainer availability and course eligibility. Schedule classes using the learner/trainer timezone-aware schedule. The portal stores operational history; avoid deleting classes that already have attendance, learning or payroll records. Use cancel/reschedule/correction workflows instead.

## 4. Delivering a class

The Trainer opens the assigned class, records attendance and actual duration, adds learning/progress information, projects/skills, what went well and next-class focus, then completes the class. Private Trainer/Admin notes must stay in the internal-note field; parent-visible feedback belongs in the parent-visible progress fields.

No-show/excused/missed statuses should not create false learner progress. Payroll follows the configured class outcome/rules and paid entries are protected from later destructive edits.

## 5. Parent and learner experience

Parents and learners use their portals to view relevant schedule, progress, projects, mentor feedback, messages and notifications. Internal Trainer/Admin notes are protected and must not appear in Parent/Student views.

## 6. Progress, renewal and birthday follow-up

Use effective progress as opening migrated progress plus portal-delivered progress. Review near-completion/renewal warnings before the learner runs out of sessions. Birthday alerts are an Admin follow-up aid; this release does not automatically send WhatsApp birthday messages.

## 7. Communications

Use portal messages/notifications for operational communication where appropriate. Resolve communication threads rather than deleting their history. Parent/Student access remains role-restricted by RLS and portal permissions.

## 8. Finance and trainer payroll

Student finance and trainer payroll are separate ledgers. Complete/approve class data before treating earnings as final. Once an earning is approved/paid, use the protected correction process instead of editing the underlying paid history directly.

## 9. Zoom classroom status in this release

The Zoom feature is a production-deployed proof of concept, isolated under `/admin/zoom-test` and `/zoom-poc/classroom`. It proves OAuth host connection, meeting creation, secure server-generated Meeting SDK session, host ZAK and embedded browser joining. It is not yet wired to the real schedule, automatic host allocation or live attendance monitoring.

## 10. Administration discipline

Use Audit/Alerts/Notifications to investigate changes instead of editing database rows manually. Use manual SQL only for documented installation, verification, QA/sanity setup or an explicitly reviewed repair.
