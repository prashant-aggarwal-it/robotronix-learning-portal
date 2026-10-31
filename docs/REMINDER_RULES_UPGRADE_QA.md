# Reminder Rules Upgrade — DEV verification (PR #37)

## Implementation
- Rules remain in-app only. Admin can edit five policy timings, toggle policies, refresh saved values and reset the distinct default timings.
- Policy list errors are visible rather than silently returning empty; saves enforce whole-minute ranges and verify an actual persisted row.
- Reminders health uses recorded `process-reminders` executions and counts known reminder notification types for the last day.
- Admin-only self-test adds one in-app notification for the currently authenticated Admin; it does not notify any trainer, parent or learner and is not counted as a real class reminder.
- Configuring a rule is separate from generating an in-app notification, and neither proves delivery to a person.

## DEV checklist
1. Confirm five existing rules appear (Parent 30, Student 15, Trainer 30, Trainer 10, Trainer update 30), and verify learner/trainers' reminder settings are unaffected by initial load.
2. Enter a noninteger, zero, negative or out-of-range value; confirm inline error and no database update.
3. Save each valid timing and toggle; refresh and verify persisted values.
4. Trigger a failed DEV policy update; confirm error is displayed and the green Saved message does not appear.
5. Reset to defaults and check both trainer reminder timings remain 30 and 10 minutes.
6. Verify an Admin can create an isolated self-test notification and see it in their own Notifications view; a second self-test creates another distinct record.
7. Compare health data against `portal_job_runs`; test recent success, failed and missing/overdue heartbeat.
8. Verify computed count uses only known in-app reminder notification types, not all `class_scheduled` events.
9. Confirm Admin-only GET/POST; unauthenticated 401 and other roles 403. Check no service-role key exposed to browser.
10. Test reminder generation against a disposable scheduled DEV class, including timezones/DST and an already-completed class whose attendance outcome is no longer pending. Confirm no duplicate reminders.

## Deployment
No schema migration is required specifically for this reminder UI upgrade. `portal_job_runs` and `portal_notifications` must already exist and the scheduler must write actual job records. Do not merge or deploy PR #37 before its existing Zoom and operational-alert migrations have been tested.
