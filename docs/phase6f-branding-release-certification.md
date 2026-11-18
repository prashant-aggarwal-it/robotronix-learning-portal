# Phase 6F — Branding Release Certification

**Decision: NOT YET READY FOR CONTROLLED PRODUCTION RELEASE.**

Scope: commercial branding and white-label portions of Robotronix Education Suite. Baseline `feature/education-suite-phase6d-white-label-certification` commit `95c9c6069a83c8325d75c22e67c34ca23ef47e06`; Phase 6F work isolated to `feature/education-suite-phase6f-branding-release-certification`. DEV project `uzzuquxeeqonxeqcuohh`; PROD project explicitly excluded.

## Verified engineering changes

1. **Public login entitlement leak fixed.** `database/saas/78_phase6f_public_academy_brand_entitlement.sql` is applied to DEV. `saas_public_academy_brand` now returns Robotronix default accent plus no stored logo or tagline for Standard, while Custom/White-label may display their saved identity. Saves and downgrades do not delete the configuration.
2. **Cross-tenant denial clarified.** `app/api/tenant-branding/route.ts` maps a database `42501` tier-read authorization refusal to HTTP 403 instead of 503.
3. **Real HTTP QA implemented.** `scripts/qa-phase6f-live.mjs` creates disposable *real authenticated* DEV owners and an unrelated signed-in user. It starts a local Next.js server in GitHub Actions, calls real APIs and confirms Owner default tier, Standard logo/theme, anonymous read refusal, foreign read refusal, forbidden branding save, forbidden upload, forbidden tier escalation, invalid org input, and invalid bearer rejection. These assertions **passed for two separately provisioned Owners** in Actions run [44242202115](https://github.com/prashant-aggarwal-it/robotronix-learning-portal/actions/runs/44242202115).
4. A second real HTTP suite additionally exercised *actual invitation-based organization Admin and Trainer logins*, confirming own-organization entitlement and branding reads, denial of foreign organization reads, and refusal of non-Owner branding writes. Its assertions passed in [44243739308](https://github.com/prashant-aggarwal-it/robotronix-learning-portal/actions/runs/44243739308). Both live HTTP runs were **overall failed at their cleanup steps**, because removing disposable members while the organizations were active hit the last-owner DB guard. The two disposable orgs were then explicitly deleted from DEV under exact IDs and slugs within a single transaction; the guard trigger was temporarily disabled only within this lock-scoped transaction and re-enabled before commit. Exact-scope auth cleanup subsequently **passed** in Actions [44242898519](https://github.com/prashant-aggarwal-it/robotronix-learning-portal/actions/runs/44242898519) and [44244053356](https://github.com/prashant-aggarwal-it/robotronix-learning-portal/actions/runs/44244053356). Follow-up SQL verification confirmed zero disposable test users and orgs from both runs, and the last-owner safeguard enabled. Do **not** misstate the failed workflow as an all-green end-to-end job.
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
| Super Admin changes tier via real HTTP | `/api/platform/branding-entitlements` | Disposable authenticated DEV Super Admin successfully set Custom, White-label and Standard via HTTP in run 44245200191 | PASS |
| Entitled Owner saves real logo and colors after Admin upgrade | Phase 6B Studio HTTP APIs + DEV Storage | Real Owner uploaded a PNG, saved palette+tagline, read effective Custom/White-label, downgraded, preserved saved values and restored on re-upgrade in run 44245200191 | PASS |
| Real Academy-family Parent and Student branding API sessions | `saas_invite_academy_family`, `saas_accept_academy_family_invite`, `/api/tenant-branding` | Real separate authenticated Parent/Student accounts accepted invitations and passed own-org read, foreign-org and editor-write denial in run 44246190834 | PASS (API) |
| Live visual Academy Admin/Trainer/Parent/Student dashboards | Shared `AppShell`, provider | Mocked browser coverage; real rendered per-role dashboard QA not executed | BLOCKED (visual) |
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

1. **Remaining live role UI:** Real authenticated Super Admin, Owners, Admin, Trainer, Parent and Student branding API checks passed. The remaining gate is visual interaction with each role's actual Academy dashboard using a running DEV application and seeded representative role data. The current Playwright visual suite relies on mocked branding APIs.
2. **Full live cross-module UI:** verify distinct customer themes and vendor attribution on linked CRM/Tasks and all supported Academy roles, including logout/login and tenant switching, on a running DEV build with genuine sessions.
3. **Legacy white-label surface review:** ensure no inappropriate vendor branding remains in client-facing legacy surfaces, notifications or documents, without hiding legal or operational disclosures.
4. **Production-level security review:** existing Supabase advisor warnings require triage. At Phase 6F verification: 155 `rls_enabled_no_policy` INFO, 16 `anon_security_definer_function_executable` WARN, 50 `authenticated_security_definer_function_executable` WARN, one `auth_leaked_password_protection` WARN. These are project-level findings and not newly introduced Phase 6F failures, but require appropriate platform release review.
5. Confirm production data migration/rehearsal and release rollback plan separately, **before** making any PROD change.

## Explicit next action

Keep the branch in DEV. Arrange a controlled DEV deployment or a local application QA environment with representative role data, and execute live visual Academy/CRM/Tasks and session-switch checks. No further missing branding-tier API behavior was identified. Only after the blocked items are resolved and retested should a production release be approved. Phase 6E custom domains/email branding is optional and **not** a prerequisite for the initial SaaS branding tier release.

## Safe release and rollback guidance

- Treat migration 78 as a privacy/commercial-entitlement correctness fix. Reverting to the pre-6F public RPC would re-expose saved Standard-tier branding. Any rollback must preserve the tier-gating rule or disable public custom branding until a corrected function is available.
- Leave PROD unchanged until the blocked real-session authorization/visual acceptance items are closed and existing Supabase security warnings are assessed.
- DEV cleanup in these QA runs required an exact-organization, lock-scoped transaction that briefly disabled the last-owner trigger only while deleting disposable Owner memberships, then re-enabled it before committing. Do not generalize that pattern to user-managed customer organizations.

## Additional Phase 6F certification evidence (final acceptance expansion)

- **Actual authenticated Platform Super Admin and entitled Owner:** [Actions 44245200191](https://github.com/prashant-aggarwal-it/robotronix-learning-portal/actions/runs/44245200191) completed successfully. A disposable QA platform administrator was granted in DEV only after verifying the exact synthetic Auth identity. Its actual Bearer session changed tiers via Next.js, while a separate Owner Bearer session uploaded to real DEV Storage, saved real branding, experienced White-label and Standard transitions, and restored saved branding upon re-upgrade. Foreign-tenant reads and unauthorized tier updates were denied.
- **Platform Admin cleanup:** [Actions 44245639066](https://github.com/prashant-aggarwal-it/robotronix-learning-portal/actions/runs/44245639066) completed successfully. Direct follow-up SQL verified zero disposable orgs/users/privileges and the last-Owner guard enabled. The immutable QA logo object was removed from DEV Storage.
- **Actual authenticated Parent/Student:** [Actions 44246190834](https://github.com/prashant-aggarwal-it/robotronix-learning-portal/actions/runs/44246190834) completed successfully. A real owner created a synthetic Academy learner, invited separate real Parent and Student accounts through the normal family invitation RPCs, and each authenticated account passed its own-branding and membership checks plus cross-tenant/editor denials.
- **Family cleanup:** Exact synthetic DEV family-access rows, invitations, Academy student, organizations, subscriptions and memberships were deleted in a single guarded transaction. [Actions 44246554987](https://github.com/prashant-aggarwal-it/robotronix-learning-portal/actions/runs/44246554987) removed the exact synthetic Auth accounts. Independent SQL verification found zero remaining family orgs, users or synthetic students, with the last-Owner guard enabled.
- These API assertions are not substitutes for **live browser rendering** of every module/role. CRM and Tasks linked-workspace visuals, legacy branded notices, and cross-account visual transitions remain pending. Project-wide advisor findings also require platform release triage. Because PROD changes and Netlify deployment were explicitly prohibited, **the release decision remains NOT YET READY**, despite the completed branding API acceptance.
