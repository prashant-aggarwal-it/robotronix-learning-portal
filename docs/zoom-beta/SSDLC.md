# Robotronix™ Tech Lab — Secure Software Development Lifecycle (SSDLC)

**System:** Robotronix Learning Portal / Robotronix Classroom Zoom integration

**Version:** 1.0 · **Effective:** 22 October 2026

**Policy owner:** Founder / designated Technical & Operations Lead

**Status:** **Approved and adopted by the founder on 22 October 2026**
**Review cycle:** Annually and after a major security or architecture change

## 1. Purpose and scope

This policy explains how Robotronix plans, builds, tests, deploys and maintains software while protecting learners, parents, trainers, employees and connected Zoom accounts. It applies to the Learning Portal, its Zoom Classroom integration, APIs, Supabase database and identity service, Netlify hosting, scheduled functions and security-related configurations. Anyone changing production systems must follow it once adopted.

The current technology includes Next.js/TypeScript, Git/GitHub, Supabase (PostgreSQL/Auth/RLS), Netlify and Zoom OAuth/Meetings/Webhooks/SDK. This is an **operating standard going forward**; it does not claim every historic release followed every step, or that automated tests are an independent penetration test.

## 2. Roles and decision-making

| Responsibility | Accountable party | Minimum action |
| --- | --- | --- |
| Business and release risk | Founder / application owner | Approve release and documented exceptions |
| Design, coding, tests and fixes | Assigned developer / technical lead | Record security implications and evidence |
| Security-sensitive review | Independent reviewer where practicable; otherwise documented owner review | Check permissions, secrets, inputs, dependencies and tests |
| Production access and operations | Authorized administrator | Protect credentials, monitor failures and report incidents |
| Privacy and user communication | Founder / designated privacy contact | Review disclosure, consent and retention statements |

In a small organization, one person may cover multiple responsibilities. When independent review is impractical, record that limitation and the compensating review or testing. Do not mark a review as completed if it was not performed.

## 3. Planning and threat modelling

For significant features, record a brief design note or ticket covering the intended actors (Admin, Trainer, Parent, Student, Zoom service or scheduled job), permissions, collected data, Zoom OAuth scopes, trust boundaries, retention, logging and failure cases. Consider access to another learner's records, privilege escalation, injection, XSS, CSRF, OAuth state/redirect misuse, webhook spoofing/replay, token disclosure, broken recording permissions, financial tampering and vulnerable dependencies.

Data paths should be explicit: browser → application server → Supabase or Zoom; Zoom → authenticated webhook; scheduled function → protected API. Apply least privilege at each boundary. Justify new external services and any use of sensitive child or financial data.

## 4. Secure implementation rules

1. **Authentication and access:** Verify roles and record-level relationships server-side. UI navigation is not an authorization mechanism. Supabase RLS must independently restrict user-accessible data. Never expose the service-role key to the browser.
2. **Database functions:** For each PostgreSQL `SECURITY DEFINER` function, review its fixed `search_path`, caller/ownership guard and `EXECUTE` grants. Trigger-only/service-only maintenance functions must not be generally callable.
3. **Inputs and responses:** Validate IDs, request bodies, roles, dates, time zones and file paths. Use parameterized database operations and appropriate output encoding. Avoid leaking internal errors and sensitive data.
4. **Zoom:** Protect OAuth state and callback handling; encrypt stored OAuth tokens; request minimum scopes; validate webhook authenticity; handle duplicate notifications; restrict meeting, host and recording APIs to authorized users.
5. **Secrets and transport:** Store credentials in managed environment settings, not Git or reports. Do not log access/refresh tokens. Use HTTPS/TLS 1.2+ for external traffic.
6. **Privacy:** Minimize collection and logs. Review parent/guardian consent, recording visibility and actual retention/deletion actions; Zoom Trash is not immediate permanent erasure.
7. **Dependencies:** Keep the lockfile in source control. Review package changes and security advisories, and avoid unnecessary third-party SDKs.

## 5. Source control and change review

Develop on a named feature or stabilization branch. Each proposed change should document its purpose, altered files, affected users/roles, security implications and tests. Review the diff for hard-coded secrets, relaxed RLS, broad database grants, insecure redirects and insufficient negative tests. Use pull requests and branch protections where configured; verify protections in GitHub rather than assuming they exist.

Maintain a **single canonical fresh database installer** and a verification script. Existing production deployments may need narrowly scoped, reviewed upgrade SQL. Never reset production or rerun a fresh installer against a populated project. Separate unrelated features from urgent fixes and protect user changes.

## 6. Security and functional verification

Record the actual command or scanner run, target environment, timestamp, commit SHA, output and exceptions:

| Check | Required evidence |
| --- | --- |
| TypeScript/build/functional checks | CI or command result, failures and fix/retest |
| Dependencies and secrets | `npm audit` or equivalent plus secret review |
| SAST | Original Semgrep JSON, version, rules, findings and parse warnings |
| DAST | Original ZAP report, target URL, scan mode, warnings and limits |
| Roles and relationships | Admin, Trainer, Parent, Student and cross-family denial tests |
| Database | Fresh-install verification, RLS checks and privileged RPC grants |
| Zoom integration | OAuth state/callback, meetings, webhooks, recording access and retention |
| Operations and privacy | Relevant logs/alerts, public notice, access and session controls |

Use disposable test users and isolated DEV data for state-changing tests. Production testing is ordinarily read-only or expressly limited to synthetic, recoverable fixtures. A passive ZAP scan, source checker or SQL role simulation is **not** a comprehensive penetration test. Record skipped and inconclusive checks honestly.

## 7. Release approval and deployment

Before deployment, the application owner reviews the exact SHA, test results, critical security risks, open scanner findings, database changes, required secrets, Zoom scopes, privacy impact and rollback approach. Significant unresolved risks need explicit disposition and documented compensating controls. An exception includes a named owner, reason and expiry.

Deploy the approved SHA through the normal Netlify workflow, after confirming the correct Supabase and Zoom environments. Smoke-test representative roles, invoice generation, attendance/progress and Zoom class functions. Monitor application/provider errors after deployment. Code rollbacks should be recoverable; database rollback requires a separately reviewed plan to avoid data loss.

An emergency fix may be expedited to contain active harm, but its owner must record testing limitations and complete a follow-up review.

## 8. Monitoring, evidence and continuous improvement

Security findings follow the Vulnerability Management Procedure. Suspected compromise follows the Incident Response Policy. Review staff access when roles change or access ends. Store original scanner artifacts, release approvals and incident evidence in restricted storage under an agreed retention schedule. Do not publish learner data, secrets or sensitive scan details.

**Evidence locations:** `.github/workflows/release-candidate.yml`, `.github/workflows/security-audit.yml`, `.github/workflows/zoom-beta-sast.yml`, `.github/workflows/zoom-beta-dast.yml`, `qa/security-dev-authorization.spec.ts`, `qa/security-dev-http.spec.ts`, `docs/SECURITY_HARDENING_AND_ACCEPTANCE.md`, `docs/zoom-beta/EVIDENCE_CHECKLIST_AND_REVIEWER_RESPONSE.md`.

## 9. Exceptions and document review

Log exceptions with affected systems, impact, rationale, mitigation, owner, expiry and decision. Review this policy annually, and after significant Zoom scope, infrastructure or processing changes. Update training and practical checklists when the policy changes.

## Owner approval record

| Field | Record |
| --- | --- |
| Approved by (name and role) | **Prashant Aggarwal, Founder, Robotronix™ Tech Lab** |
| Effective date | **22 October 2026** |
| Accountable technical lead until formally delegated | **Prashant Aggarwal, Founder** |
| Next scheduled review | **22 October 2027**, or sooner after a major change |
| Approval evidence | **Owner's explicit approval statement in project conversation, 22 October 2026** |

**Scope of approval:** The owner adopts these procedures prospectively. Adoption is not a claim that historical security reviews, scans or penetration tests were performed, nor that currently open findings are resolved.
