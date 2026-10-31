# Operational Alerts upgrade — rollout and QA

The action queue combines client-authorized business rules with an Admin-only API for recent Zoom/System failures and background job heartbeats.

## Monitoring coverage
- Classes: past scheduled class lacking a recorded outcome
- Enrollments: active hold
- Trainers: active trainer without portal login
- Zoom/Finance/System: sanitized operational error groups from the last 24 hours (up to 2,000 records)
- System: expected scheduled job heartbeats and failed recent job results

The page explicitly displays partial-data warnings, loading state and the last successful system check. Zero alerts does **not** mean all integrations have been checked. Missing heartbeat does not itself prove a job failed.

## Administrative actions
Open an affected record via Investigate; manage the follow-up with open, acknowledged or resolved, an active administrator assignee, optional safe internal note and snooze for 1, 4 or 24 hours.
The underlying alert is regenerated from live data. High-priority problems remain on the active queue while the condition is present, even if marked resolved or snoozed. Follow-up state never edits a business record or deletes logs.

## Additive database installation
Before DEV deployment, back up the database and apply only `database/01_install/modules/schema/10_operational_alert_states.sql` (and the preceding `09_system_log_issues.sql` if not installed).
For existing PROD, migrate only after DEV verification and approval; never execute a fresh-database installer against a populated database.

## DEV acceptance checklist
1. Admin sees active enrollment hold, late class and missing trainer access with correct links and priority.
2. Controlled synthetic Zoom error appears as a single grouped issue rather than one row per retry, with a System Logs link. Do not use real recordings to generate test failures.
3. Simulate a missing scheduled heartbeat: status is actionable and shows expected frequency.
4. Disable either business-fetch or system-fetch in DEV: screen warns of partial monitoring rather than claiming zero health issues.
5. Acknowledge, assign and snooze a medium-priority issue. Reload; persisted state remains. Check reappearance after snooze.
6. Mark a high-priority unresolved source issue resolved; it must remain in the queue while source conditions persist.
7. Confirm unauthenticated GET/PATCH receives 401, Trainer/Parent/Student receives 403, and non-Admin cannot query or mutate the state table.
8. Verify page pagination, category, priority, status filters, empty state and mobile layout.
9. Confirm API responses, browser and logs contain no sensitive Zoom tokens, raw provider bodies, student details in technical diagnostics or service-role key.
10. Run TypeScript, structural checks, security audit, build and DEV role-based QA on exact release commit before merge.

## Important limitations
The alert grouping is a bounded 24-hour view, not an exhaustive long-term aggregation. Finance coverage includes currently logged technical failures; complete payment approval and payout exception rules require independently verified business data sources and are not implied by this release. Acknowledgement isn't automatic incident remediation.
