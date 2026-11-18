# Phase 6F — Branding Release Certification

**Decision: NOT YET READY FOR CONTROLLED PRODUCTION RELEASE.**

Scope: commercial branding and white-label portions of Robotronix Education Suite. Baseline `feature/education-suite-phase6d-white-label-certification` commit `95c9c6069a83c8325d75c22e67c34ca23ef47e06`; Phase 6F work isolated to `feature/education-suite-phase6f-branding-release-certification`. DEV project `uzzuquxeeqonxeqcuohh`; PROD project explicitly excluded.

## Verified engineering changes

1. **Public login entitlement leak fixed.** `database/saas/78_phase6f_public_academy_brand_entitlement.sql` is applied to DEV. `saas_public_academy_brand` now returns Robotronix default accent plus no stored logo or tagline for Standard, while Custom/White-label may display their saved identity. Saves and downgrades do not delete the configuration.
2. **Cross-tenant denial clarified.** `app/api/tenant-branding/route.ts` maps a database `42501` tier-read authorization refusal to HTTP 403 instead of 503.
3. **Real HTTP QA implemented.** `scripts/qa-phase6f-live.mjs` creates disposable *real authenticated* DEV owners and an unrelated signed-in user. It starts a local Next.js server in GitHub Actions, calls real APIs and confirms Owner default tier, Standard logo/theme, anonymous read refusal, foreign read refusal, forbidden branding save, forbidden upload, forbidden tier escalation, invalid org input, and invalid bearer rejection. These assertions **passed for two separately provisioned Owners** in Actions run [44242202115](https://github.com/prashant-aggarwal-it/robotronix-learning-portal/actions/runs/44242202115).
4. The real HTTP Actions job was **overall failed**, because removing the disposable Owners initially hit the last-owner DB guard. The two disposable orgs were then explicitly deleted from DEV under exact IDs and slugs within a single transaction; the guard trigger was temporarily disabled only within this lock-scoped transaction and re-enabled before commit. Exact-scope auth cleanup subsequently **passed** in Actions [44242898519](https://github.com/prashant-aggarwal-it/robotronix-learning-portal/actions/runs/44242898519). A later SQL verification confirmed zero disposable test users, zero disposable test orgs and the guard trigger enabled. Do **not** misstate the failed workflow as an all-green end-to-end job.
5. `database/saas/PHASE6F_PUBLIC_LOGIN_DEV_ROLLBACK_VERIFY.sql` ran successfully in DEV. Its transaction temporarily extended an expired synthetic QA subscription and applied saved branding across Standard, Custom, White-label and downgrade; it verified Standard public disclosure is suppressed while saved values remain. All changes were rolled back.
6. No Phase 6F modifications were made to PROD, main, or Netlify. No new branding table or color extraction logic was introduced.

## Traceable certification matrix

| Requirement | Implementation / evidence | Actual result | Classification |
|---|---|---|---|
| Default Standard tier and Robotronix theme | Phase 6A read RPC, Phase 6C resolver; real Phase 6F Owner HTTP | Real DEV owner checks passed for two organizations | PASS |
| Public Academy login does not expose saved Standard custom branding | Migration 78; Phase 6F rollback SQL | Real DEV SQL tier transitions passed | PASS |
| Custom and White-label public login identity | Migration 78; Phase 6F rollback SQL | Direct DEV database behavior passed, public HTTP from an anonymous browser not separately exercised | PASS (DB), BLOCKED (HTTP) |
| Real Owner entitlement read | `/api/platform/branding-entitlements` | Real authenticated DEV HTTP passed | PASS |
| Real Standard Owner branding write + logo upload refusal | `/api/branding-studio`, `/upload` | Real authenticated DEV HTTP passed | PASS |
| Real Owner self-escalation refusal | Phase 6A authorization API | Real authenticated DEV HTTP passed | PASS |
| Real unrelated tenant / anonymous access refusal | `/api/tenant-branding`, Phase 6F HTTP | Real authenticated DEV HTTP passed | PASS |
| Super Admin changes tier via real HTTP | `/api/platform/branding-entitlements` | No authorized real Super Admin QA session available for live execution | BLOCKED |
| Entitled Owner saves real logo and colors after Admin upgrade | Phase 6B Branding Studio APIs and Phase 6A control | Existing DEV RPC rollback tests and mocked UI only, not full real HTTP acceptance on an entitled tenant | BLOCKED |
| Live Academy Admin/Trainer/Parent/Student sessions | Shared `AppShell`, provider | Code and mocked browser checks pass; live role-specific QA not completed | BLOCKED |
| Suite Home organization switching | Suite switcher and provider | Desktop/mobile mocked browser verification passes | PASS (mock); BLOCKED (live two-org session) |
| CRM linked/unlinked tenant identity | Organization-link RPC and provider | Existing mocked browser regressions pass; live CRM identity acceptance not performed | PASS (mock); BLOCKED (live) |
| Linked Tasks and personal Tasks isolation | Provider + Tasks workspace mapping | Existing mocked browser regressions pass; live role/workspace acceptance not performed | PASS (mock); BLOCKED (live) |
| White-label vendor-attribution policy | Phase 6D central policy, shared shell, Suite, CRM and linked Tasks | Desktop/mobile mocked browser regressions pass | PASS (mock), BLOCKED (comprehensive live UI) |
| Cross-session identity isolation | Phase 6D provider state invalidation | Source-contract and mocked browser checks, not independent real two-account visual QA | BLOCKED |
| TypeScript and Next.js production build | Phase 6F branding validation CI | [44242898515](https://github.com/prashant-aggarwal-it/robotronix-learning-portal/actions/runs/44242898515) passed | PASS |
| Phase 5/6 branding regression suites | Same CI run | Passed | PASS |
| Mobile/desktop browser regression | Same CI run | Passed with mocked API fixtures | PASS (mock) |
| DEV function privileges | Direct DEV SQL: anon/authenticated cannot invoke privileged tier setter, service_role can | Passed | PASS |
| Disposal of Phase 6F synthetic fixtures | Cleanup CI + direct DEV SQL verification | Zero test orgs/users; last-owner guard enabled | PASS |
| Full customer-facing legacy vendor reference audit | Phase 6D scoped components | Major shells covered; every legacy route/notification/report not audited live | BLOCKED |
| PROD migration / deployment | Explicitly prohibited in this phase | Not attempted | NOT APPLICABLE |

## Outstanding release blockers

1. **Full real DEV identity matrix:** authenticated Platform Super Admin, entitled Owners, Academy Admin, Trainer, Parent and Student must be exercised with their real role tokens and permitted module data.
2. **Full live cross-module UI:** verify distinct customer themes and vendor attribution on linked CRM/Tasks and all supported Academy roles, including logout/login and tenant switching, on a running DEV build with genuine sessions.
3. **Legacy white-label surface review:** ensure no inappropriate vendor branding remains in client-facing legacy surfaces, notifications or documents, without hiding legal or operational disclosures.
4. **Production-level security review:** existing Supabase advisor warnings require triage. At Phase 6F verification: 155 `rls_enabled_no_policy` INFO, 16 `anon_security_definer_function_executable` WARN, 50 `authenticated_security_definer_function_executable` WARN, one `auth_leaked_password_protection` WARN. These are project-level findings and not newly introduced Phase 6F failures, but require appropriate platform release review.
5. Confirm production data migration/rehearsal and release rollback plan separately, **before** making any PROD change.

## Explicit next action

Keep the branch in DEV. Arrange dedicated real DEV QA sessions for a platform Super Admin and Academy role-specific test accounts, then execute the remaining matrix. Only after the blocked items are resolved and retested should a production release be approved. Phase 6E custom domains/email branding is optional and **not** a prerequisite for the initial SaaS branding tier release.
