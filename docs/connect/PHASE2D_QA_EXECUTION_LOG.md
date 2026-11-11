# Connect Phase 2D — QA execution log

Date: 2026-11-05
Scope: Connect branch only; no main merge, no Production database change, no Netlify deploy.

## Inspection completed
- Read Connect UI, typed client, CRM HTTP route and existing Portal auth implementation.
- Checked existing GitHub Actions QA branch workflow. It targets a historical fix branch on push; there is no automatic Connect-branch validation configured.
- Checked local build runtime: no checked-out repository; outbound GitHub DNS/clone unavailable. TypeScript and Next.js build **not executed**.

## Issue fixed in this pass
**Cross-institute stale HTTP response could overwrite current workspace display**
- When switching institute workspaces or refreshing rapidly, older `Promise.all` CRM results could land later and replace current data, despite safe backend tenant permissions.
- Commit `e1323276451df7696c02dc42cf0101224cd943c2` introduces request-generation checks, clears stale CRM records/timeline on workspace changes and sign-out, ignores old responses and constrains timeline updates to the most recent request.
- Corrected write-button permission to default to disabled when the selected tenant is not resolved.
- This is a source-level fix. **Browser verification still pending.**

## Must-pass Phase 2D release gates (not yet completed)
- [ ] `npm ci`, `npm run typecheck` and `NEXT_PUBLIC_APP_ENV=demo npm run build` on feature branch.
- [ ] Open `/connect` and verify sign-in, sign-out, workspace creation, selection and staff role restrictions with Development user accounts.
- [ ] Switch quickly between institutes A and B during slow responses. Verify no A data renders while B selected; test refresh/sign-out during requests.
- [ ] Create a contact; create enquiry with and without an opportunity; reuse existing contact; duplicate candidate detection; verify no false enquiries.
- [ ] Bootstrap pipeline, move lead across stages, verify version conflicts, win/loss, stage history and display refresh.
- [ ] Create/complete/reassign follow-up; create and reschedule appointment; verify permissions and accurate local times.
- [ ] Load 100+ leads and validate pagination/search behavior; current implementation only initially loads up to 100 per list.
- [ ] Keyboard accessibility/focus trapping/escape behavior for modal and drawer; reader labels; mobile navigation.
- [ ] Run Portal admin/parent/student/trainer workflows, billing, demos, Zoom, scheduling and security regression.
- [ ] Verify one-service-role security policy, tenant constraints and runtime API 401/403/409 behavior under live HTTP.
- [ ] Verify empty and slow-network states; inspect browser console/network issues and server logs.
- [ ] Review typography and color against Portal AI Flow and Meritto-informed admissions flows; avoid copying proprietary screens.

## Status
Phase 2D **started**, one security-relevant UI data race fixed in the dedicated branch, but **not complete**. Do not deploy or merge until the build, real-browser tests and Portal regressions pass.
