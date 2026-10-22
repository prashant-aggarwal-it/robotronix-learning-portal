# Robotronix Classroom — Security Incident Management & Response Policy

**Approved and adopted.** Version 1.0, effective 2026-10-22. **Accountable owner:** Prashant Aggarwal, Founder, until a separate incident coordinator is formally assigned. Covers the portal, Zoom Classroom, Supabase, Netlify, GitHub, staff accounts and connected vendors. Review annually, after a significant incident and after each tabletop exercise.

## Purpose and contact responsibilities

This policy sets out how to report, contain, investigate, recover from and learn from suspected security incidents. Its goal is to protect learners and families, reduce harm and preserve trustworthy evidence. Anyone who notices a suspected incident must report it through the designated internal operations/security contact; that channel and a backup decision maker **must be appointed before adoption**.

| Role | Responsibility |
| --- | --- |
| Incident coordinator | Open the incident record, classify severity, coordinate response and maintain timeline |
| Technical responder | Safely investigate logs and code, contain access, implement fixes and verify recovery |
| Founder / decision owner | Authorize high-impact shutdowns, user/vendor communications, legal consultation and closure |
| Privacy/contact representative | Assess affected people and notification obligations, draft factual messages |
| Service-provider contacts | Help with Zoom, Supabase, Netlify, GitHub or hosting incidents where relevant |

One person may cover multiple roles for a small team; record who performed each decision. External assistance should be obtained for complex forensic, legal or data-breach questions rather than improvising a conclusion.

## Reporting and classification
Report suspected token compromise, unauthorized learner data access, suspicious Zoom authorization, malicious webhook activity, payment-data concerns, or service outages to the coordinator as soon as discovered. Triage as Critical (confirmed sensitive data exposure/active compromise), High (credible exploitation), Medium or Low.

### Suggested severity guide

| Severity | Illustrative situation | Immediate expectation |
| --- | --- | --- |
| Critical | Active compromise, confirmed widespread learner/Zoom data exposure, malicious production changes | Urgent owner escalation and containment; consider isolating affected capability |
| High | Credible unauthorized access, leaked active OAuth/production secret, exploitable cross-family access | Same-day owner assessment and prioritized containment |
| Medium | Limited weakness with no confirmed exploitation, repeated suspicious traffic | Record, investigate and plan controlled mitigation |
| Low | Low-impact misconfiguration or unproven report | Assess and monitor through vulnerability process |

Severity can change as facts emerge. Do not wait for certainty before reporting a credible incident. Preserve the distinction between **suspected**, **confirmed** and **ruled out** findings.

## Immediate response
1. Record time, reporter, affected systems, symptoms and evidence location in a restricted incident log.
2. Contain the incident with the least destructive action: revoke sessions/tokens, rotate compromised secrets, disable affected integrations/accounts, or restrict impacted features.
3. Preserve logs, relevant request IDs and Git/deployment metadata without redistributing passwords or learner data.
4. Determine scope, root cause, data subjects affected, and whether Zoom or other vendors are implicated.
5. Resolve underlying vulnerabilities, restore from verified backups when necessary, test fixes and monitor recurrence.

### Practical response sequence

**First assessment:** Log the date/time in IST and UTC where available, reporting channel, initial symptoms, affected systems/accounts, first responder and a case identifier. Establish whether classes are continuing, whether learner information could be exposed and whether the issue is still active.

**Containment:** Choose the least disruptive effective control. Examples include disabling one compromised profile, revoking a Zoom OAuth grant, rotating a leaked service secret, restricting a vulnerable API or temporarily suspending a scheduled function. High-impact actions such as taking the whole portal offline require the incident owner's decision when practicable. Protect financial and learning records from unnecessary deletion.

**Evidence:** Preserve original timestamps, relevant sanitized logs, deployment SHA, security alerts, webhook request identifiers and copies of affected configuration. Limit evidence access. Do not export passwords, OAuth tokens or children's data into open chat, email or public repositories. Record a chain of handling for sensitive evidence (who accessed/captured it and when).

**Analysis:** Identify initial access, attack path, which identities and data were affected, timeframe, whether credentials were used elsewhere, and what evidence supports conclusions. Review Zoom permissions and third-party logs where relevant. Document uncertainties instead of guessing.

**Remediation and recovery:** Apply a narrowly scoped fix, validate it in a safe environment, deploy through approved change control and rotate affected credentials. Confirm users can log in appropriately, cross-family data remains restricted, Zoom meetings/recordings work as authorized, and scheduled jobs behave as expected. Monitor for recurrence.

## Communications and notification
Notify internal decision makers promptly. Determine contractual and legal notification duties for affected individuals, Zoom, providers and regulators; do not promise a universal notification deadline where one has not been established. Restrict public statements to verified facts; maintain a dated decision record.

### Communications checklist

- Identify who needs to know: the founder, technical lead, affected parents/trainers, service providers, Zoom and any competent authority, subject to the incident facts and applicable law or contract.
- Seek qualified legal/privacy advice when personal information, especially children's information, is involved. Determine notification deadlines from applicable obligations; do not invent a single universal deadline.
- Use an approved, accurate statement explaining what happened, what is known and unknown, what action was taken, whether recipients should do anything, and where to ask questions.
- Keep a record of communication approvals, recipients, channel, date and follow-up. Do not disclose unrelated victims or confidential investigative details.

Any request from Zoom's security team should be recorded and answered factually with only the necessary evidence through an appropriate private channel.

## Closure and improvement
Record timeline, impact, corrective actions, owner, retest evidence and lessons learned. Review root causes and update controls and policies. Test the response process with periodic tabletop exercises once adopted.

### Closure conditions

Before closure, the coordinator should record: incident ID, detection and resolution times, final severity, affected systems/data, confirmed root cause or reason it remains unknown, containment actions, fix/deployment reference, retest result, affected-party notification decision, residual risks and post-incident action owners. Track unfinished actions in the vulnerability backlog with target review dates.

At least once a year after adoption, practice a tabletop scenario such as a stolen Zoom refresh token or unauthorized student-record access. Record participants, gaps and improvement actions. This proposal does **not** claim a tabletop exercise has already occurred.

## Incident register template

| Field | Example format (do not enter secrets) |
| --- | --- |
| Case ID / reported time | INC-YYYY-NNN / timestamp |
| Reporter / coordinator | Role and secure contact |
| Status and severity | Suspected / confirmed / resolved; Low–Critical |
| Systems/data involved | Zoom OAuth, learners, Supabase, Netlify, etc. |
| Containment decision | Action, owner and timestamp |
| Evidence references | Restricted log/report locations and deployment SHA |
| Root cause / corrective action | Verified explanation and change reference |
| Notification decision | Who was consulted/notified, legal basis and time |
| Closure / follow-up | Retest evidence, owner and next review |

## Adoption and approval

| Field | Record |
| --- | --- |
| Approving founder/owner | **Prashant Aggarwal, Founder, Robotronix™ Tech Lab** |
| Effective date | **22 October 2026** |
| Accountable incident coordinator until delegation | **Prashant Aggarwal, Founder** |
| Backup escalation contact/channel | **To be designated operationally** |
| First tabletop review date | **To be scheduled; no prior exercise claimed** |
| Approval evidence | **Owner's explicit approval statement in project conversation, 22 October 2026** |

Do not claim past exercises, formal incident-response certification or operational adoption without evidence.
