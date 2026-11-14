# Phase 3F — Staging and Modular Certification

Working branch: `feature/education-suite-phase3f`. Baseline: certified Phase 3E SHA `715678dbb792e2acc3284f53f66667877d421931`.

## Baseline evidence
Phase 3E source certification [43616182248](https://github.com/prashant-aggarwal-it/robotronix-learning-portal/actions/runs/43616182248) PASS. Authenticated three-customer DEV E2E [43616182287](https://github.com/prashant-aggarwal-it/robotronix-learning-portal/actions/runs/43616182287) PASS: 175 Academy/CRM/Tasks/Phase3E assertions plus 17 Phase3C regression assertions.

The certified three-customer tests cover independent integrations, onboarding admission handoffs, C enrollment, cross-tenant record and trainer denial, CRM Won reconciliation, CRM/Academy linked Tasks and module entitlements. They **do not** certify live external provider behaviors.

## Phase 3F current testing
- Source certification on Phase 3F branch: [run 43620897305](https://github.com/prashant-aggarwal-it/robotronix-learning-portal/actions/runs/43620897305); result pending at creation of this report.
- Authenticated DEV E2E: [run 43620897318](https://github.com/prashant-aggarwal-it/robotronix-learning-portal/actions/runs/43620897318); result pending at creation of this report.
- Scheduler ownership contract added to source suite.
- No separate production-like staging clone was authorized or created.

## Deployment profile verification matrix

| Configuration | Current verification |
| --- | --- |
| Academy only | Source/module contracts; live staging deployment not verified |
| CRM only | Source/module contracts; live staging deployment not verified |
| Tasks only | Source/module contracts; live staging deployment not verified |
| Academy + CRM | DEV integration contracts and Phase 3E authenticated E2E; live provider operation not verified |
| CRM + Tasks | DEV integration contracts and Phase 3E authenticated E2E |
| Academy + Tasks | DEV integration contracts and Phase 3E authenticated E2E |
| Full Suite | DEV authenticated E2E verified in Phase 3E |
| Three-customer Full Suite | DEV authenticated E2E verified in Phase 3E; independent live staging deployments not performed |

**Certification: PARTIAL.** Production-like staging and external provider tests are not complete. Never infer live release safety from module contracts alone.

## Updated executed CI evidence
- Source run [43620897305](https://github.com/prashant-aggarwal-it/robotronix-learning-portal/actions/runs/43620897305): PASS.
- Authenticated DEV run [43620897318](https://github.com/prashant-aggarwal-it/robotronix-learning-portal/actions/runs/43620897318): PASS.
- Latest additional scheduler hardening revalidation runs [43625449088](https://github.com/prashant-aggarwal-it/robotronix-learning-portal/actions/runs/43625449088) / [43625449064](https://github.com/prashant-aggarwal-it/robotronix-learning-portal/actions/runs/43625449064): pending at writing. Source and DEV evidence is not a full staging clone or external provider certification.

## Additional Phase 3F verification, 14 November 2026
- Scheduled background functions now enforce exclusive Netlify ownership for Portal reminders, Zoom reconcile/retention, system-log retention and CRM history drain. Existing CRM/Tasks worker ownership checks remain unchanged.
- Read-only database preflight `database/saas/PHASE3F_READ_ONLY_PREFLIGHT.sql`: **11 of 11 PASS on DEV**, including tenant-scoped installation/access, protected triggers, corrected index and deny grants for public RPC callers.
- [Source certification 43625449088](https://github.com/prashant-aggarwal-it/robotronix-learning-portal/actions/runs/43625449088): PASS for latest scheduler behavior; [source certification 43625614582](https://github.com/prashant-aggarwal-it/robotronix-learning-portal/actions/runs/43625614582): PASS with read-only preflight file.
- [Authenticated DEV regression 43625449064](https://github.com/prashant-aggarwal-it/robotronix-learning-portal/actions/runs/43625449064): running at report update, so no unobserved PASS claim.
- **Staging certification remains PARTIAL.** No separate staging environment or production backup rehearsal is authorized, and no live Zoom/WhatsApp/Razorpay sandbox evidence exists in this assignment.
