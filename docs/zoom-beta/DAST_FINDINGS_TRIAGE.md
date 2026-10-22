# Zoom Beta — ZAP findings triage register

**As of:** 2026-10-22. **Branch:** `release/consolidated-stabilization-20261020`.
**Original evidence:** GitHub Actions run [39710579155](https://github.com/prashant-aggarwal-it/robotronix-learning-portal/actions/runs/39710579155), artifact `zoom-beta-dast-39710579155`. Scanner reported 0 FAIL categories, 9 WARN categories, 58 PASS rules.

This file is a **triage plan**, not a declaration that findings have been resolved or accepted. The baseline targeted the live deployed production origin, whose SHA may differ from the stabilization branch. Preserve the original ZAP JSON/HTML and reviewer decisions.

| Finding from original summary | Initial disposition | Action / acceptance criterion | Status |
| --- | --- | --- | --- |
| CSP wildcard directive | Needs investigation | Identify affected directive/response from original JSON; restrict only after actual Zoom SDK/OAuth/network origins are tested | Open |
| CSP `script-src unsafe-eval` | Compatibility-sensitive | Determine whether Next/Zoom SDK needs it; test Meeting SDK host/join and recordings under report-only proposed policy | Open |
| CSP `script-src unsafe-inline` | Compatibility-sensitive | Determine script nonce/hash feasibility; verify Next and Zoom embeds before enforcing | Open |
| CSP `style-src unsafe-inline` | Compatibility-sensitive | Determine stylesheet injection requirements and feasibility of nonce/hash without breaking class UI | Open |
| Cross-Origin-Embedder-Policy absent | Needs investigation | Confirm whether setting COEP would block Zoom remote scripts/media; avoid enabling without functional test | Open |
| Cross-Origin-Resource-Policy absent | Needs investigation | Test loaded same-origin and Zoom cross-origin resources; set policy only if safe | Open |
| Permissions-Policy warning | Recheck after deployment | Portal config explicitly sets camera, microphone, display capture to self; find precise URL(s) lacking/flagging header | Open |
| X-Powered-By disclosure | Remediation committed | `next.config.ts` sets `poweredByHeader: false` in commit `ccfaef1d`. Deploy approved SHA and prove response header absent in follow-up ZAP | Fixed in branch; live retest pending |
| X-Content-Type-Options missing on some URLs | Route-specific investigation | Next config sets nosniff on app routes; enumerate affected URLs/assets/API responses from original report; set headers at correct serving layer | Open |

## Required security sign-off

For each row, record the original ZAP plugin/rule ID, severity, alert URL, evidence, owner, issue link, code/deployment SHA, retest run, and resolution or written risk acceptance. A warning cannot be marked fixed merely because a related header exists on `/`.

## Scope limits

Unauthenticated ZAP baseline does not exercise parent/trainer/Admin isolation, Zoom OAuth callbacks, protected recordings, or service-side authorization. Security tests for those flows must use a controlled test environment and dedicated synthetic users. No active attacks or authenticated production crawling have been authorized.

## Suggested sequence

1. Download the source artifact before its 30-day expiry; extract individual alert URL/parameter details.
2. Resolve route-specific headers and low-risk disclosure fixes on the stabilization branch.
3. Test Zoom class start/join/recording behavior against any proposed CSP/COEP change in a safe staging deployment.
4. Once release checks and database acceptance pass, deploy the approved SHA by normal release process; rerun DAST against matching SHA.
5. Record decisions and keep unresolved alerts visible in the Zoom evidence packet.
