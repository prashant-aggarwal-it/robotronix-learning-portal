# Progress Overview — DEV acceptance (PR #37)

The admin report uses the existing learner progress engine and class schedule records. It does **not** modify attendance, lesson hours, existing progress calculations or stored records.

## Visible improvements
- Learning status distinguishes: Completed, On hold, Needs attention, Awaiting class update, Not started/unrecorded, Near completion, In progress and On track.
- Reasons reflect existing attendance and progress alerts, trainer signals, submitted project reviews and inactivity. Past scheduled classes lacking an outcome are explicitly flagged.
- Each enrollment shows its next scheduled class and last attended date, with a direct link to the enrollment-specific progress workspace.
- Admin can filter by learning status; filtered Excel export includes reasons and data completeness.
- Loading, refresh and failed-load states are displayed. The screen does not silently represent missing attendance as 0%.

## DEV verification matrix
1. QA learner with created Zoom meeting but no delivered class: Not started/unrecorded, 0 delivered hours and no recorded attendance.
2. Past scheduled class without class outcome: Awaiting class update, with link to detailed progress.
3. Delivered class and attendance: In progress with recorded delivery hours.
4. Low attendance after at least three recorded attendance outcomes: Needs attention with explanation.
5. Trainer feedback indicating follow-up or reinforcement: Needs attention.
6. Submitted project awaiting review: Needs attention.
7. Active enrollment with >=21 days since last attended date: Needs attention.
8. Active hold and completed enrollment: On hold and Completed respectively.
9. Near-completion learner with valid planned hours: Near completion. Do not treat zero planned hours as near completion.
10. Future class: next class date/time displays; validate filtering and matching for 1-to-1 and cohort lessons.
11. Multi-enrollment learner: separate progress rows with correct enrollment-specific links and filtering.
12. Failing data fetch: alert shown; no misleading claim of complete data. Verify class/outcome freshness.
13. Export filtered report and confirm rows, percentage values, reasons and spreadsheet text safety.
14. Verify non-Admin access remains blocked by RoleGuard and existing database permissions.

## Known limitations
- The next-class indicator uses the existing schedule dataset and chooses the next scheduled day/time; it does not guarantee future class provisioning or Zoom connectivity.
- Class outcomes and attendance are recorded independently. Missing outcomes are flagged, but this screen does not change them.
- Alerts derive from existing progress data. No new database migration is required for the Progress screen.
