# Robotronix Classroom — Secure Software Development Life Cycle (SSDLC)

**Draft for owner adoption and evidence collection.** Owner: Robotronix technical/operations lead. Applies to the Robotronix Learning Portal and Zoom Classroom integration. Version: 0.1, 2026-10-22.

## 1. Scope and responsibility
The application uses Next.js/TypeScript, Supabase for identity/data, Netlify hosting, and Zoom OAuth, meetings, webhooks and SDK functionality. Changes are developed on a protected release branch and promoted only after documented acceptance. The owner appoints reviewers and approves exceptions before use. This describes the **required release process**, not proof that every historic change followed it.

## 2. Requirements and threat modelling
For each significant feature, record: actor and intended permissions; Zoom scopes and Zoom data accessed/stored; personal/learner data; external API/webhook trust boundary; expected failure modes; deletion/retention; logs and monitoring. Assess role bypass, IDOR, injection, token disclosure, insecure redirects, replay, CSRF and dependency vulnerabilities. Record any accepted risk with reason and deadline.

## 3. Design and implementation
Use least privilege (Supabase RLS, authenticated RPCs and server-side authorization); validate untrusted inputs; do not expose OAuth client secrets or service-role keys to browsers; validate Zoom webhook signatures/tokens; do not store credentials in Git; use HTTPS/TLS 1.2+ and platform encryption for Zoom data at rest; minimize sensitive logs. Require explicit justification and review for privileged database functions.

## 4. Automated verification
Run GitHub release CI on the exact commit. Run dependency analysis (`npm audit`), source invariants and role negative tests, scanner-generated Semgrep SAST, and authorized OWASP ZAP baseline DAST. Collect original reports and CI run links. Scanner findings are tracked with severity, owner, fix commit and verified retest. A passive DAST report does not replace authenticated testing or independent penetration testing.

## 5. Database and integration acceptance
On a disposable testing database, execute the canonical installer, reference data and read-only verification SQL. Test distinct Admin/Trainer/Parent/Student accounts, disabled identities, parent-to-parent isolation, Zoom OAuth callback/state, token encryption, webhook authentication, invitation/access management, payment reconciliation, and scheduling/payroll authorization. Never run destructive tests against live users or data.

## 6. Change control and release
Log each change in Git history, attach passed CI evidence, record QA exceptions, and secure approval from the owner before merging. Back up valuable data, validate the target Supabase project and secrets, deploy the approved SHA, perform smoke tests and monitor provider/log errors. Emergency fixes require a follow-up review.

## 7. Evidence mapping
- Release CI: `.github/workflows/release-candidate.yml`
- Security/dependency CI: `.github/workflows/security-audit.yml`
- Genuine Semgrep report: `.github/workflows/zoom-beta-sast.yml` artifact after run
- Genuine ZAP report: `.github/workflows/zoom-beta-dast.yml` artifact after authorized run
- DEV role QA: `qa/security-dev-authorization.spec.ts` and `qa/security-dev-http.spec.ts`
- Release documentation: `docs/SECURITY_HARDENING_AND_ACCEPTANCE.md`

## Owner acceptance
Adopt this procedure only after verifying it reflects actual practice and assigning a responsible owner. Store dated evidence of adoption privately. Do not submit this draft as evidence of a completed penetration test.
