# Robotronix Production Readiness — 37-Point Coverage Matrix

This matrix maps every item from the final sanity workflow to either **Automated**, **Manual**, or **Both**. A release is not PROD READY merely because Playwright passes; the manual visual/UX gates must also be signed off.

| # | Sanity area | Coverage | Automated evidence / command | Manual sign-off still required |
|---:|---|---|---|---|
| 1 | Clean test setup / typecheck / Dev Supabase | Both | `npm run typecheck`, `npm run qa:auth-check` | Confirm `.env.local` points to Development, not Production |
| 2 | Public homepage and universal login | Both | `production-readiness.spec.ts` public/auth tests | Visual balance + browser-extension-free check |
| 3 | New Parent onboarding end-to-end | Both | automated parent submission in `production-readiness.spec.ts` | Google OAuth first-time consent/branding |
| 4 | Verify onboarding data in Supabase | Automated | DB assertions after automated onboarding submission | — |
| 5 | Admin onboarding notification | Automated | SQL 24 + notification DB assertion | Check bell/list wording visually |
| 6 | Admin onboarding review | Both | Admin screen sweep + schedule-matching UI assertions | Review readability and workflow clarity |
| 7 | Trainer creation/configuration | Both | existing Admin/workflow suite + structure checks | Create one SANITY trainer manually before go-live |
| 8 | Trainer login / portal routes | Automated | `qa:auth-check`, `qa:roles`, `qa:production-readiness` | — |
| 9 | Trainer payout / finance visibility | Both | trainer/admin route sweep + DB/RLS verification | Masking and approval UX review |
| 10 | Trainer rate card visibility | Both | trainer profile/earnings route sweep, Admin trainer page | Verify exact displayed rates against Admin rate card |
| 11 | Assign course + trainer to onboarding | Both | existing workflow/DB coverage | One full SANITY assignment workflow |
| 12 | Final Class Plan | Both | onboarding Admin schedule validation checks | Confirm chosen local/IST times visually |
| 13 | Activate learner | Both | existing activation/workflow QA; DB linkage checks | One full SANITY activation after latest fixes |
| 14 | DB verification after activation | Automated | linkage assertions in `production-readiness.spec.ts` | — |
| 15 | Parent Portal after activation | Automated | parent learner route assertion | Visual correctness |
| 16 | Trainer sees learner assignment | Automated | trainer Learner Progress assertion | — |
| 17 | Schedule visibility across roles | Both | role route/workflow checks | Compare one real SANITY class across Admin/Trainer/Parent |
| 18 | Schedule conflicts / overrides | Automated + Manual | availability/schedule validation code tests + workflow suite | Try one deliberate conflict in UI |
| 19 | Actual class lifecycle | Automated | `qa/workflows.spec.ts` completes class and checks DB | — |
| 20 | Absence/cancellation/payroll rules | Both | payroll DB/logic checks, SQL 21 | Manually verify one student no-show + one cancellation + trainer no-show |
| 21 | Delivered hours / course progress | Automated | workflow DB + parent/student downstream checks | — |
| 22 | Enrollment detail display | Automated | title-case Program Model / Status test + schedule-line test | Visual table width/readability |
| 23 | Project/progress workflow | Both | role route sweep / existing progress QA | One trainer feedback → parent view manual check |
| 24 | Messages | Automated + Manual | communication security checks + route sweep | Send/reply one SANITY thread |
| 25 | Notifications | Both | SQL 24 onboarding notification + notification routes | Verify unread badge/read state |
| 26 | Billing / fee package | Automated + Manual | authenticated billing-panel test | Create one SANITY fee package and verify values |
| 27 | International Razorpay | Both | `qa/razorpay.spec.ts`; optional Test Mode write integration | Final CA-confirmed tax/LUT/FX review and Test Mode invoice inspection |
| 28 | Admin destructive actions | Manual | cleanup SQL and route checks | Confirm archive/delete dialogs with SANITY data |
| 29 | Permissions / RLS | Automated | `qa:permissions`, `qa:security`, role sweeps | — |
| 30 | Session / sign-out / role switching | Automated + Manual | auth setup + route protection | Browser account chooser / Google session behavior |
| 31 | Refresh / browser resilience | Automated | refresh tests on critical Admin pages | Spot-check Trainer/Parent refresh |
| 32 | Responsive layouts | Both | mobile Playwright smoke command | Human visual review on phone width |
| 33 | Final technical checks | Automated | `npm run qa:production-readiness` + `npm run check:release` | Review failures/traces |
| 34 | Classify issues P0/P1/P2 | Manual | test report supplies failures | Owner assigns severity and disposition |
| 35 | GO / NO-GO gate | Both | `npm run qa:prod-gate` | Owner signs all manual gates and zero unresolved P0/P1 |
| 36 | Production preparation | Both | `check:production-env`, production smoke command | Confirm Netlify/Supabase/Google/SMTP/Razorpay settings |
| 37 | Production cleanup | Both | QA cleanup SQL/scripts | Confirm only SANITY data removed and master data preserved |

## Razorpay-specific automated coverage

The Razorpay suite checks unauthenticated API rejection, Admin-authenticated ledger and enrollment panel access, configuration mode, schema/tax snapshot fields, invalid webhook signature rejection, and optional signed webhook/Test Mode write integration. Actual Razorpay Test Mode creation/cancellation is deliberately opt-in with `QA_RAZORPAY_WRITE=1` so normal QA runs cannot create provider invoices accidentally.

## Release interpretation

- **Automated PASS** means the deterministic application/DB checks passed.
- **Manual PASS** means a human verified the visual or external-service behavior that automation cannot safely prove.
- **PROD READY** requires all P0/P1 automated failures resolved and all required Manual/Both rows signed off.
