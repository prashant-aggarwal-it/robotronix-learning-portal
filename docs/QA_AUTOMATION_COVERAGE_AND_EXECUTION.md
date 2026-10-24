# Robotronix QA automation — coverage and execution

## Two different gates (do not confuse them)

- **Every PR:** `Release candidate checks` performs typecheck, consolidated source/SQL rules, preview/source regression tests and Next.js build. `Security audit` performs static security tests, source checks and dependency audit. These do **not** demonstrate authenticated E2E.
- **Manually dispatched isolated QA workflow:** `.github/workflows/integrated-e2e.yml` runs real Playwright Browser + Supabase operations using distinct Admin/Trainer/Parent/Student accounts and deterministic SANITY-AUTO records, then uploads traces/screenshots and HTML reports.

## Automated browser suite inventory

| Test | Source | Interaction type |
|---|---|---|
| Parent submission, preferences, Admin notification | `qa/production-readiness.spec.ts` | UI and DB assertion |
| Student → enrollment → filtered class history; class → enrollment | `qa/integrated-journey-e2e.spec.ts` | Real navigation and seeded DB |
| Trainer workspace, Parent learner view | `qa/integrated-journey-e2e.spec.ts` | Role-authenticated UI |
| Zoom classroom permission by Admin/Trainer/Parent/Student; anonymous rejection | `qa/integrated-journey-e2e.spec.ts` | Authenticated/anonymous API |
| Attendance → trainer earnings → Parent/Student progress | `qa/workflows.spec.ts` | End-to-end UI and DB |
| Hold and resume enrollment | `qa/workflows.spec.ts` | UI, DB and restore |
| Schedule conflict, reschedule history and cancellation | `qa/scheduling-lifecycle.spec.ts` | UI and DB |
| Attendance exceptions/no-show | `qa/attendance-exceptions.spec.ts` | UI and DB |
| Payment package and duplicate receipt | `qa/finance-lifecycle.spec.ts` | UI and DB |
| Payroll rules, access routing, demo, mobile and other operational checks | Other `qa/*.spec.ts` suites | Mixed, see individual tests |

## Isolated GitHub Actions setup

Create environment `qa` in GitHub Actions; preferably enforce approvals and restricted branch access. Set environment vars:

- `E2E_QA_BASE_URL`: a dedicated **nonproduction** Netlify `deploy-preview-` URL wired to the **QA** Supabase project (not production)
- `E2E_SUPABASE_PROJECT_REF`: exact isolated project ref

Set environment secrets `E2E_SUPABASE_URL`, `E2E_SUPABASE_ANON_KEY`, `E2E_SUPABASE_SERVICE_ROLE_KEY`, and `E2E_QA_{ADMIN,TRAINER,PARENT,STUDENT}_{EMAIL,PASSWORD}`.

**Critical:** The preview application itself must connect to that same QA Supabase project. The test runner cannot determine the preview application's hidden Netlify environment configuration from GitHub variables. Validate this separately before enabling write-capable tests. Never reuse real learners or production service-role secrets.

Populate the dedicated QA records using existing QA seeding procedures in `database/02_qa` and configured QA identities, then run the manually dispatched **Integrated authenticated E2E (isolated QA only)** workflow.

Locally: `npm run qa:integrated-e2e` after configuration, or run `npm run qa:prod-gate` for the previous broad suite (which still has mutation and is not a safe unreviewed production command).

## Still dependent on external acceptance

Tests which require real Zoom provider account actions (start/join/record/delete), Zoom Marketplace Beta external approval, realistic simultaneous host bookings, live webhook delivery, role-matched QA identities, SQL execution on a fresh Supabase instance, DAST, and screenshot-based UX approval are **not** fully covered by CI. They remain explicit human/isolated-infrastructure release gates. Passing this workflow is not equivalent to complete end-to-end coverage for all workflows.
