# Manual QA Phase 1 — shared prelaunch backend / Netlify branch preview
Date: 2026-10-24
Branch: `fix/manual-qa-20261023`
Production release branch: `main`
Status: **Preflight / not yet certified**.

## Current branch checklist
- [x] Consolidated onboarding two-card styling into manual QA branch.
- [x] Finance compliance notification and trainer Overview CTA point to editable Admin & Finance tab (#18).
- [x] Awaiting first trainer login no longer incorrectly counts as Admin attention (#20).
- [x] Trainer Week class block opens detail dialog and classroom link; Day/Week views still need uniform behavior (#22).
- [x] GitHub Actions release-candidate workflow configured to run on manual QA branch, with typecheck + structural checks + build.
- [ ] Confirm GitHub Actions latest run **passes**. Configured is not equivalent to passed.
- [ ] Browser test all previously committed fixes with real synthetic records and Admin/Trainer/Parent logins.
- [ ] Enable Netlify branch deploy in Netlify UI and confirm successful deployment. Not provisioned by this Git commit.
- [ ] Verify preview environment variables and auth redirect settings before use.
- [ ] Close or update issues #18/#20 only after acceptance. Keep #22 open for later flow work.

## Netlify branch deploy setup (one-site solution)
1. Open Netlify project for `portal.robotronixstemlab.com`.
2. Navigate **Project configuration → Developer settings → Continuous deployment → Branches and deploy contexts → Configure**.
3. Select individual branch deployments and enter `fix/manual-qa-20261023`; Save.
4. Open **Deploys** to check branch build and retrieve the **actual** branch-deploy URL. Do not infer or assume a URL.
5. Branch deploy and production can point to the **same prelaunch Supabase database** if explicitly intended. This is NOT data-isolated. Use synthetic test accounts, record IDs and coordinated cleanup.
6. Review Netlify Environment variables' scope. Values inherited by branch deploys can differ from Production. Check Supabase URL/anon and service-role env variables and OAuth behavior without copying secrets into Git.
7. Keep `main` designated as production deployment branch.
8. Do not change Zoom Marketplace production redirect URLs solely for preview. OAuth provider callback must use an explicitly allowed URL and tested state/redirect design. Use the production host for OAuth/Zoom integration validation while under review unless a separate preview callback is safely configured.
9. Do not run reset/seed scripts against the shared database until a backup/export is captured and operational fixtures are identified, even though the site is prelaunch.
10. Verify the preview does not expose sensitive QA accounts/data and avoid search engine indexing where possible. Restrict access if the preview includes private data.

## QA acceptance matrix
| Issue | Manual checks | Status |
| --- | --- | --- |
| #18 finance | Admin notification opens exact trainer Finance edit view; status verified/needs update saved; attention cleared only on persist | Pending |
| #20 trainer access | not_linked -> actionable; awaiting_first_login -> informational; disabled and portal_ready meaningful; disable confirmation | Pending |
| Onboarding layout | 2-card desktop balanced; mobile stacks; family edit remains functional | Pending |
| Trainer Week block | Click/tap and keyboard; correct trainer/course/learner/IST; real classroom state and permissions | Pending |
| Cross-view class | Day/Week/Trainer views eventually use same details view | Open #22 |

## Release discipline
- Do not merge manual QA into main based on code presence alone.
- All browser test results should record page, test identity, date, success/failure and reproduction details.
- Run `npm ci`, `npm run typecheck`, `npm run check:release`, `npm run build` and safely configured Playwright suites before merge.
- GitHub Actions build/typecheck checks do not prove live Supabase or Zoom end-to-end flows.
