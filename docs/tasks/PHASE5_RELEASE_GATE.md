# Universal My Tasks v1.0 — Phase 5 Release Gate

**Target:** Development Supabase `fflejkqcspivnhsmkdtn`; feature branch `feature/universal-my-tasks`.

**Do not deploy to Production or merge into main until explicitly approved.**

## Implemented milestones

1. Task-only account activation independent of Learning Portal roles; Auth email must be verified.
2. Workspace membership and invitation onboarding (existing Phase 3, checked against task-only accounts).
3. User-private CSV/JSON export and confirmed CSV import with mapping, up to 200 tasks per atomic batch.
4. User-scoped diagnostics and safe operational failures logged to existing structured system logs.
5. Standalone notification inbox with assignment alerts and reminders; Portal-role notifications remain unchanged.
6. Private-schema isolation, active CRM membership checks, and task-only suspension protection.
7. Automated structural, validation and CSV regression tests.

## Mandatory UAT matrix (not automatically passed)

| ID | Scenario | Expected result |
|---|---|---|
| T01 | Verified new Google user, no Portal profile | `/tasks/welcome` activation and private My Tasks access |
| T02 | Unverified/anonymous user | Activation denied; no task data |
| T03 | Disabled Portal account | Access denied even with prior task account |
| T04 | Suspended task account | Access denied without blocking other Portal modules |
| T05 | Existing four Portal roles | Task operations function as before |
| T06 | Workspace A/B users, restricted task | No cross-workspace or nonmember data visibility |
| T07 | Invite verified email, join then remove | Correct member access, immediate revocation |
| T08 | Two member identities and administrator | Workspace admin cannot view restricted task without permission |
| T09 | Import CSV with quoted commas/newlines | Correct field mapping and preview; 1–200 rows imported |
| T10 | Import invalid 99th row | No partial rows remain after transaction failure |
| T11 | Export CSV and JSON for owner | Personal tasks only; no shared teammate tasks |
| T12 | Import malicious spreadsheet formula | Exported values are spreadsheet-safe strings |
| T13 | Completed CRM task, explicit link | Linked personal task completes in CRM if role still permits |
| T14 | CRM membership removed | CRM sync access revoked; no cross-tenant updates |
| T15 | Complete class review task | Class/attendance/payroll remain unchanged |
| T16 | Mobile widths 360/390/768 px | Onboarding, settings, workspace, import preview usable |
| T17 | Attachment sharing and revocation | Signed URL access stops after expiry; revoked users cannot obtain new URLs |
| T18 | 2,000+ tasks, filters, board, calendar | Usable pagination/performance; no request waterfalls or timeouts |
| T19 | Rate/size limits | 250 KB CSV file, 200-row import and 10 MB attachment caps enforced |
| T20 | Failure/monitoring | Safe reference ID in operational log, no task content or tokens logged |

## Automated gates

```bash
npm run check:tasks
npm run test:tasks
npm run typecheck
npm run build
```

Read-only database checks: `database/tasks/verify_phase5_readonly.sql`.

## Remaining external release prerequisites

- Signed-in, multi-identity Development browser UAT for the matrix above.
- Verify current Auth provider configuration for new task-only users, Google callback and email verification settings.
- Review safe retention/deletion, backups, monitoring, usage limits and transactional load with actual target tenant sizes.
- Invitation delivery is currently in-app; production email invitations require a configured sender and template.
- Standalone reminder delivery requires the scheduled Netlify reminder job to be running and monitored. A Development migration alone does not activate the job.
- Define SaaS billing, public registration, support and legal terms separately before commercial launch. V1.0 does not contain paid plans.
- Explicit written approval for main merge, Production migration and deployment; then run production smoke tests with read-only defaults.

## Rollback approach

No destructive automatic rollback. If the feature is not approved, leave the feature branch undeployed and do not expose the standalone navigation. Schema objects on Development are additive and can remain dormant pending a reviewed migration plan. No user data is automatically imported or deleted.
