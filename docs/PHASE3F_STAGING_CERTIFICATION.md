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
