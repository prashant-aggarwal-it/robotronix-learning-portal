# Robotronix — Security Hardening and Acceptance (Phases 1–3)

**Status: source controls implemented; security acceptance NOT complete.**
**Scope:** stabilization branch only. No production, main branch, Netlify or live database mutations.

## Phase 1 — Automated security assurance
- `.github/workflows/security-audit.yml` performs `npm ci`, source/credential-pattern audit, offline security regression tests, and a **fail-closed** `npm audit --omit=dev --audit-level=high`.
- `.github/dependabot.yml` tracks npm and GitHub Actions updates against the stabilization branch.
- `npm run check:security` validates selected role checks, privileged scheduling RPC revocations, sensitive table RLS markers, response headers and high-confidence committed secret patterns.
- Source checks are *not* full secret history scans, SAST coverage, OWASP DAST, or a penetration test. Do not describe them as such.

### Dependency vulnerability findings
Security audit revealed **three high-severity advisories** in the currently locked production tree:
1. `sharp@0.35.4` — upstream patched version >=0.35.5 (CVE-2026-96889).
2. `source-map-js@1.2.1` — upstream patch >=1.2.2 (GHSA-68fv-2mgg-jv7q).
3. `xlsx@0.18.5` — known prototype pollution and regex denial of service advisories with **no npm audit remediation available** (GHSA-4r6h-8v6p-xvw6 and GHSA-5pgg-2g8v-p4x9).

**Release blocker:** do not suppress the production dependency audit. Patch the first two through a reviewed dependency lock refresh, and replace the vulnerable Excel export dependency with an audited maintained alternative while preserving multi-sheet Excel behavior and spreadsheet formula-injection protection. Retest exports and update the lockfile consistently. Current static checks/build passing does not clear these findings.

## Phase 2 — Supabase isolation and database security
- Canonical installer remains `database/01_install/01_CREATE_SCHEMA.sql`. No additional migrations or post-install patches.
- `database/03_verify/01_VERIFY_RELEASE.sql` contains read-only security gates for RLS on sensitive tables and anonymous EXECUTE restrictions on Scheduling V2 functions.
- `qa/security-dev-authorization.spec.ts` runs authenticated, non-destructive, negative authorization probes for Trainer/Parent/Student against privileged scheduling RPCs, payroll, fee-payment access, and randomized Zoom meeting IDs.
- This suite needs a **separate DEV Supabase** with QA identities. It refuses to run without explicit `SECURITY_QA_DEV_ACK=I_UNDERSTAND_DEV_ONLY`, `SECURITY_QA_PROJECT_REF` matching the target host and `QA_TARGET` not production.
- For full signoff, verify cross-parent row isolation using two distinct linked QA families, trainer assignment changes, active/disabled accounts, expired tokens, and row visibility after pausing/rescheduling.

## Phase 3 — Application & API protections
- `lib/server/read-limited-body.ts` caps signed webhook payloads even when the client omits Content-Length. Razorpay request processing rejects oversized bodies *before* signature verification and parsing.
- Admin Zoom scheduling endpoint now validates UUID/action and returns sanitized errors rather than provider internals.
- `qa/security-static.spec.ts` checks server admin authentication, response headers, signed-webhook order, scheduling RPC privilege markers, and bounded-body edge cases.
- `qa/security-dev-http.spec.ts` checks unauthorized Admin/Zoom API access, response headers, and oversized webhook rejection against a verified DEV application origin. It needs `SECURITY_QA_DEV_APP_ORIGIN` to match `QA_BASE_URL` and the DEV acknowledgment.
- Existing protections retained: role guarded routes, active Admin profile verification, signature-verified Razorpay webhook, response security headers, audit histories, and RLS.
- **CSP qualification:** Zoom SDK currently requires `unsafe-inline`/`unsafe-eval` in `next.config.ts`. This is a hardening weakness requiring compatibility testing for nonce or route-specific CSP; do not remove unsafely without validating live Zoom SDK behavior.

## Security release gates
- [ ] All GitHub release checks pass on the candidate commit.
- [ ] Dedicated security audit passes (including production dependency vulnerability gate).
- [ ] Canonical SQL installs and verification SQL passes on **DEV**.
- [ ] DEV authenticated security RPC/RLS suite passes with isolated QA identities.
- [ ] Full Admin/Trainer/Parent/Student E2E acceptance passes with DEV OAuth/webhooks.
- [ ] `npm run qa:security-dev-all` passes against the isolated DEV Supabase and preview application.
- [ ] Zoom OAuth/reusable links, sensitive class data, and Razorpay test-mode signatures/replay verified.
- [ ] Penetration testing against explicitly authorized DEV/staging environment and retest of findings.
- [ ] Operations owner signs off remaining exceptions, restores backups, and checks monitoring.

**No pen test or authenticated DEV security acceptance has been executed merely by adding these files.** Production remains unchanged.
