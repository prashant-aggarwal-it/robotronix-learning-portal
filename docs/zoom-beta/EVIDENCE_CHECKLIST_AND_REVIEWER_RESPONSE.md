# Zoom Marketplace Beta — Security evidence register

**App:** Robotronix Classroom. **Status:** evidence collection in progress; not ready to submit. **Reviewer finding:** "App Beta – Insufficient Evidence" (Zoom Marketplace note dated 2026-10-20). **Source of requirements:** the actual reviewer message supplied by the application owner, not an inferred approval.

## Reviewer minimum requirements and artifacts

| Requirement | Planned original evidence | Current status |
| --- | --- | --- |
| SSDLC | `docs/zoom-beta/SSDLC.md` and GitHub release/security run URLs, owner adoption evidence | Document drafted; owner adoption pending |
| SAST | GitHub workflow `zoom-beta-sast.yml`: **download scanner-generated `semgrep.json`**, scanner version and run metadata | Original run #39709798949: one finding. After fix b94b070, retest #39710292096: zero findings among 89 rules across 253 files, with 25 partial parsing warnings. Requires review of scan coverage before declaring full SAST acceptance. |
| DAST | GitHub workflow `zoom-beta-dast.yml`: **download scanner-generated `zap-baseline.html` + `zap-baseline.json`** | First authorized scan completed: run #39710579155, 9 warning categories, 0 FAIL. Reports downloaded; triage pending |
| Privacy Policy | Live public privacy policy URL covering Zoom access, OAuth tokens, meetings/recordings, retention, sharing, deletion and contact | Verify URL, factual accuracy and availability |
| Security policy | `docs/zoom-beta/SECURITY_POLICY.md` | Draft; owner approval pending |
| Incident management and response policy | `docs/zoom-beta/INCIDENT_RESPONSE_POLICY.md` | Draft; owner approval pending |
| Vulnerability management procedure | `docs/zoom-beta/VULNERABILITY_MANAGEMENT_POLICY.md` | Draft; owner approval pending |
| TLS 1.2+ | Scanner or TLS configuration screenshot/probe for actual app endpoint | Evidence pending |

The last three policies satisfy the reviewer's **choose any three** supporting-policy requirement after truthful operational adoption. A penetration-test executive summary, third-party audit or certification is **not** claimed. Zoom may request further evidence.

## Exact next workflow

### 1 — Generate SAST evidence

On the stabilization branch, open **Actions → Zoom Beta SAST evidence → Run workflow** if the workflow has not already run successfully. After completion, download artifact `zoom-beta-sast-<sha>` with the *original* Semgrep JSON output and scanner version. Read the actual findings, fix issues, rerun and retain both original/final reports. A scan can return successfully and still report findings; review the JSON results.

### 2 — Generate DAST evidence

Once the URL is externally reachable and matches the deployed build being evaluated, open **Actions → Zoom Beta DAST passive evidence → Run workflow** on `release/consolidated-stabilization-20261020`. Set target to `https://portal.robotronixstemlab.com`, enter `AUTHORIZE_PASSIVE_SCAN`, and run. Download `zoom-beta-dast-<run_id>`. This is a short, unauthenticated **passive ZAP baseline**, not an active penetration test. It must not be described as evidence of protected OAuth flow testing. If DNS/hosting prevents access from the runner, record it as **scan not completed** and fix access first.

**Do not run** ZAP full/active scanning, brute-force tests, flooding, credential attacks, state-changing crawls, or authenticated fuzzing against production by default. Restrict further security testing to an explicitly arranged controlled window and isolated test data.

### 3 — Inspect and resolve findings

For every scanner alert, record: title, scanner-generated severity and rule ID, real impact, affected component/URL, issue/ticket, remediation commit, retest result, reviewer/owner and date. Never delete alerts or claim a clean scan unless the original latest report supports it.

### 4 — Complete the evidence upload

Attach the actual scanner reports (or clear screenshots of scanner output and metadata), SSDLC document, approved three policies, and link to the public Privacy Policy in Zoom Marketplace Technical Design/Beta review response. Verify TLS 1.2+ at the live origin. Redact all secrets, tokens, learner data, internal database addresses and personal information from uploaded files.

### 5 — Submit update

Only after all evidence is factual and complete, submit the updated Beta application in Zoom Marketplace. An **Acknowledged** review note is not the same as final approval. Reviewer examines the response after resubmission.

## Proposed reply to the Zoom reviewer (complete only after evidence is ready)

> Thank you for the detailed security and privacy review. We have attached our Secure SDLC document, original Semgrep SAST scan results, original OWASP ZAP DAST baseline scan results, our publicly accessible Privacy Policy, and our approved Information Security, Incident Response, and Vulnerability Management policies. We have documented the tool versions, scan dates, scope, findings and remediation status, and confirmed the application's TLS configuration. Please let us know if further evidence or testing is required.

Do not send this template before the report and policy items are actually complete.

## Evidence hygiene

Use GitHub Actions **run URLs, exact commit SHA, scan timestamp and artifact filenames** for traceability. Artifacts may expire (configured retention 30 days); preserve a restricted copy before expiry. Do not publish internal incident policies, credentials or sensitive scan findings to public pages. Review scanner reports before sharing with the Zoom reviewer.

## Initial SAST finding and remediation trail
- Original scanner run: https://github.com/prashant-aggarwal-it/robotronix-learning-portal/actions/runs/39709798949 (Semgrep 1.168.0; 253 files considered; one finding).
- Rule: `javascript.node-crypto.security.gcm-no-tag-length.gcm-no-tag-length` at `lib/server/zoom.ts` line 49 (missing expected authentication-tag length).
- Fix: commit `b94b070` explicitly sets AES-256-GCM `authTagLength:16` and validates 12-byte nonce/16-byte tag at decryption; regression assertion in `qa/security-static.spec.ts`.
- Retest: https://github.com/prashant-aggarwal-it/robotronix-learning-portal/actions/runs/39710292096 — **0 reported findings**, original JSON artifact saved. **Caveat: 25 Semgrep partial parsing warnings** on TSX files mean scan coverage is not complete; triage and address the warnings or document a compensating source scan before submission. Do not assert fully clean SAST coverage.

## DAST scope limitation
The Zoom review may ask for application-authenticated API/Zoom OAuth testing beyond the public ZAP baseline. We should not label passive, unauthenticated crawling as comprehensive DAST or third-party penetration testing. Document the scanner scope honestly and respond to any follow-up requests.

## First real DAST baseline — 2026-10-22
- Run: https://github.com/prashant-aggarwal-it/robotronix-learning-portal/actions/runs/39710579155
- Scanner: OWASP ZAP baseline, short unauthenticated passive crawl, target `https://portal.robotronixstemlab.com`.
- Original artifacts: `zoom-beta-dast-39710579155`, containing `zap-baseline.html`, `zap-baseline.json`, run metadata.
- Results as reported by ZAP: **0 FAIL**, **9 WARN** categories (some with Medium risk ratings), **58 PASS** rules; informational categories also appear in JSON.
- Warnings: CSP wildcard directive; CSP `script-src unsafe-eval`; CSP `script-src unsafe-inline`; CSP `style-src unsafe-inline`; Cross-Origin-Embedder-Policy; Cross-Origin-Resource-Policy; Permissions-Policy; `X-Powered-By` disclosure; `X-Content-Type-Options` missing on some URLs.
- These findings describe the **currently deployed production URL** (which can be on an older code commit), **not proof of the latest stabilization branch's deployed behavior**. Compare the deployed SHA and retest after rollout.
- Do not suppress CSP warnings unilaterally: Zoom Meeting SDK compatibility and required origins must be verified before tightening.
- Each warning must be reviewed, assigned a disposition, fixed or formally accepted with mitigation and rerun before describing the DAST security position as accepted.

## SAST scope caveat
The Semgrep retest found zero rule matches, **but the JSON contains 25 partial-parse warnings**. These may reduce coverage on TSX modules. Record them for scanner triage, consider a second independent source scanner, and do not describe the analysis as complete coverage.

## Independent readiness verification — 2026-10-22

- Confirmed stabilization branch HEAD at initial inspection: `e0fef0a`. Existing SSDLC and three supporting policies are **drafts pending owner adoption**. Do not assert operational adoption merely because the documents exist.
- Verified live `https://portal.robotronixstemlab.com` HEAD response: HTTP/2 200, HSTS `max-age=31536000`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, and a CSP are present on the root HTML response. This does not prove all routes/assets carry these headers. `X-Powered-By: Next.js` remains visible. Broad CSP sources / unsafe inline and eval remain untriaged for Zoom SDK compatibility.
- A TLS 1.2 handshake was attempted in the inspection environment but did not produce conclusive negotiated-protocol evidence. Obtain an explicit successful protocol/certificate result before checking off the TLS 1.2+ evidence requirement.
- Zoom's current official Technical Design guidance lists **SSDLC documentation, SAST/DAST reports and a penetration-test report** for Beta/publishable authorization. The private/Beta sharing guide says supporting evidence is reviewed case-by-case and prefers a third-party penetration test. An unauthenticated ZAP baseline is **not** a penetration test; do not imply otherwise. Determine whether Zoom will accept documented scope/exception for this Beta request, or commission an authorized independent test. References: https://developers.zoom.us/docs/build-flow/technical-design/ and https://developers.zoom.us/docs/distribute/sharing-private-and-beta-apps/.
- Submission status remains **blocked** pending scanner coverage review, ZAP warning dispositions and post-deployment retest, privacy notice verification, owner policy adoption, confirmed TLS evidence, and the penetration-test requirement/Zoom written exception.
- No release merge or Netlify deploy is authorized by this evidence update.
