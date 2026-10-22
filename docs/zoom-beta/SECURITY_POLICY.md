# Robotronix Classroom — Information Security Policy

**Approved and adopted.** Version 1.0, effective 2026-10-22. Applies to Robotronix staff, development, support and contractors with access to the Learning Portal and Zoom Classroom. **Owner:** Prashant Aggarwal, Founder / accountable security lead until delegation. **Review:** Annually and after major incidents or changes. This policy describes required controls, not a certification.

## Security objectives
Protect the confidentiality, integrity and availability of learners' and families' information, Zoom OAuth credentials and Zoom user/meeting data. Grant only role-appropriate access.

## Identity and access
Staff use individually assigned accounts. Admin access is restricted and must be reviewed periodically. Disable departing staff promptly. Enforce role checks at server/API and database layers; never rely solely on navigation controls. Record exceptional privileged access.

### Role boundaries and access reviews

Robotronix uses four primary portal roles: Admin (operations), Trainer (assigned teaching and permitted learners), Parent (linked family members), and Student (their own learning experience). Permissions must be enforced server-side and in Supabase RLS. A login does not automatically grant access to another family's information. Service accounts and background jobs may receive narrowly defined machine permissions but cannot be reused as browser credentials.

Administrators should review high-privilege identities and production dashboards at least quarterly once this policy is adopted, and immediately after staff departure or suspected compromise. An access record should identify account, purpose, approver, date and removal decision. Do not share an Admin identity between employees; require individual access when available. MFA should be enabled for GitHub, Supabase, Netlify and Zoom administrative access wherever supported, with any exception documented.

## Data protection
Collect the minimum Zoom and learner information necessary to deliver classes. Use TLS 1.2+ for transmission and platform-supported encryption at rest, including stored Zoom OAuth tokens. Store secrets in managed environment settings; never commit them or include them in diagnostic screenshots. Restrict backup access. Establish and communicate retention and deletion periods; follow privacy notices and applicable agreements.

### Information categories and handling

| Category | Examples | Required treatment |
| --- | --- | --- |
| Learner/family personal data | Names, contact, student links, attendance, progress | Restrict by role/relationship; minimize exports and logs |
| Financial and trainer payout data | Fees, invoices, earnings, bank instructions | Admin-only or specifically authorized access; audit changes; mask where possible |
| Zoom integration data | OAuth credentials, host IDs, meeting IDs, recording metadata | Encrypt credentials, limit scopes, deny unnecessary public APIs |
| Operational and security data | Logs, access evidence, scan reports | Restrict access and redact credentials/personal data before sharing |

Personal and financial data must not be copied into public issue trackers or scanner evidence. Use synthetic accounts for QA. Limit database exports, screenshots and backups to a genuine operational need. Record who is authorized to receive them and how they will be disposed of.

### Retention, recordings and deletion

The selected default for newly processed Zoom cloud recordings is 60 days, **subject to production verification**, permitted host/recording overrides and protections. The current cleanup requests Zoom `action=trash`; this is not immediate permanent erasure, and Zoom's own retention may continue. Publish an accurate privacy explanation before claiming this behavior to users or Zoom reviewers. Delete or anonymize information when no longer justified, subject to educational, safeguarding, contractual, accounting and applicable legal obligations; maintain an accountable deletion process rather than promising universal automatic erasure.

## Application and integrations
Maintain signed/verifiable webhook handling, OAuth state and redirect validation, input validation, request-size limits, dependency scanning and regression testing. Review Zoom scopes for minimum required privileges. Rotate exposed or compromised tokens and credentials.

### Production and external services

Review the permission boundaries among Netlify, Supabase, GitHub and Zoom. The server-side Supabase service role must not reach public client bundles. Public SQL/RPC `EXECUTE` permissions are reviewed independently from table RLS. Any `SECURITY DEFINER` function should have a fixed `search_path`, a necessary purpose and tightly scoped execution grants. OAuth secrets, webhook secrets, internal cron secrets and encryption keys belong in managed environment configuration, with access limited to staff who need them.

Changes to Zoom scopes, callback URLs, webhook endpoints or recording processing require a technical and privacy review. New integrations must describe what information they exchange, who operates them and how access is revoked.

## Devices and operational controls
Require device access controls and secure updates for staff endpoints. Audit sensitive admin/finance changes, minimize personal data in logs, and restrict access to production and third-party dashboards.

Staff with production access should use screen locks, supported security updates, anti-malware protections appropriate to the device, password-manager-stored unique credentials and secure networks. Report lost devices or suspicious login prompts promptly. Avoid downloading raw production records to unmanaged personal devices.

Maintain operational visibility for failed integrations, database permission errors, webhook failures, unusual administrative changes and scheduled-task errors. Logs should carry event time and useful request identifiers while avoiding Zoom access tokens, secrets, bank account values and unnecessary children's information. Test restoration and recovery procedures before describing them as proven.

## Third parties and incidents
Review service-provider access, contractual/privacy obligations, and shared data. Report suspected security incidents immediately under the Incident Response Policy. Owners retain evidence, investigate, notify affected parties/regulators as legally required and verify remediation.

### Supplier and privacy review

Before onboarding a service that processes learner or Zoom data, identify its purpose, permissions, data location where relevant, support contacts, security documentation and exit/revocation mechanism. Reassess important services after significant incidents or contract changes. Parent/guardian communication and recording consent must reflect the real learning workflow and applicable requirements.

## Monitoring and review
Review this policy and access rights at least annually and after material changes or incidents. Exceptions require a documented reason, responsible owner and expiry.

## Minimum records and exceptions

Keep access reviews, release approvals, security scans, high-risk exceptions, relevant audit logs and incident reports in access-controlled storage. An exception must state the specific control, reason, impact, temporary safeguard, approval owner and expiry date. The founder or delegated security lead reviews open exceptions on a defined schedule; expired exceptions must be closed or re-approved.

## Policy approval

| Field | Record |
| --- | --- |
| Approving owner (name, role) | **Prashant Aggarwal, Founder, Robotronix™ Tech Lab** |
| Effective date | **22 October 2026** |
| Accountable security lead until delegation | **Prashant Aggarwal, Founder** |
| Next scheduled review | **22 October 2027**, or sooner if needed |
| Record of approval | **Owner's explicit approval statement in project conversation, 22 October 2026** |

**Scope of approval:** This policy is effective going forward. It does not certify that all controls have already been independently validated or that every historical process complied with it.
