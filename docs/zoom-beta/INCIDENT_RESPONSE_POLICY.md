# Robotronix Classroom — Security Incident Management & Response Policy

**Draft pending adoption.** Version 0.1, 2026-10-22. Owner: designated Robotronix incident coordinator.

## Reporting and classification
Report suspected token compromise, unauthorized learner data access, suspicious Zoom authorization, malicious webhook activity, payment-data concerns, or service outages to the coordinator as soon as discovered. Triage as Critical (confirmed sensitive data exposure/active compromise), High (credible exploitation), Medium or Low.

## Immediate response
1. Record time, reporter, affected systems, symptoms and evidence location in a restricted incident log.
2. Contain the incident with the least destructive action: revoke sessions/tokens, rotate compromised secrets, disable affected integrations/accounts, or restrict impacted features.
3. Preserve logs, relevant request IDs and Git/deployment metadata without redistributing passwords or learner data.
4. Determine scope, root cause, data subjects affected, and whether Zoom or other vendors are implicated.
5. Resolve underlying vulnerabilities, restore from verified backups when necessary, test fixes and monitor recurrence.

## Communications and notification
Notify internal decision makers promptly. Determine contractual and legal notification duties for affected individuals, Zoom, providers and regulators; do not promise a universal notification deadline where one has not been established. Restrict public statements to verified facts; maintain a dated decision record.

## Closure and improvement
Record timeline, impact, corrective actions, owner, retest evidence and lessons learned. Review root causes and update controls and policies. Test the response process with periodic tabletop exercises once adopted.

**Approval:** Pending operational owner assignment, contact channel and tabletop validation. Do not claim past exercises or incident response certifications without evidence.
