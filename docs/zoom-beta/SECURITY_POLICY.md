# Robotronix Classroom — Information Security Policy

**Draft for owner approval.** Version 0.1, 2026-10-22. Applies to Robotronix staff, development, support and contractors with access to the Learning Portal and Zoom Classroom.

## Security objectives
Protect the confidentiality, integrity and availability of learners' and families' information, Zoom OAuth credentials and Zoom user/meeting data. Grant only role-appropriate access.

## Identity and access
Staff use individually assigned accounts. Admin access is restricted and must be reviewed periodically. Disable departing staff promptly. Enforce role checks at server/API and database layers; never rely solely on navigation controls. Record exceptional privileged access.

## Data protection
Collect the minimum Zoom and learner information necessary to deliver classes. Use TLS 1.2+ for transmission and platform-supported encryption at rest, including stored Zoom OAuth tokens. Store secrets in managed environment settings; never commit them or include them in diagnostic screenshots. Restrict backup access. Establish and communicate retention and deletion periods; follow privacy notices and applicable agreements.

## Application and integrations
Maintain signed/verifiable webhook handling, OAuth state and redirect validation, input validation, request-size limits, dependency scanning and regression testing. Review Zoom scopes for minimum required privileges. Rotate exposed or compromised tokens and credentials.

## Devices and operational controls
Require device access controls and secure updates for staff endpoints. Audit sensitive admin/finance changes, minimize personal data in logs, and restrict access to production and third-party dashboards.

## Third parties and incidents
Review service-provider access, contractual/privacy obligations, and shared data. Report suspected security incidents immediately under the Incident Response Policy. Owners retain evidence, investigate, notify affected parties/regulators as legally required and verify remediation.

## Monitoring and review
Review this policy and access rights at least annually and after material changes or incidents. Exceptions require a documented reason, responsible owner and expiry.

**Approval:** Pending responsible owner review and adoption. This is a proposed policy, not a certification or proof of historical controls.
