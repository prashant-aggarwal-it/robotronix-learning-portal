# Connect/Portal source consolidation — implementation & release gate

Branch: `feature/robotronix-connect-crm`. Do not merge to `main`, deploy, or modify Production without explicit approval.

## Implemented in repository

- Extracted Connect navigation/model and category suggestions into `features/connect/model.ts`; enquiry preference types into `features/connect/types/enquiries.ts`.
- Extracted `ConnectSidebar`, `ConnectTopbar`, `ConnectAuthGates`, and generic empty/error states.
- Grouped the Connect channel, automation, communication, report and enquiry settings components in `features/connect/components/`; deleted superseded `components/connect/` files.
- Canonicalized Connect browser API client and contracts at `features/connect/api/client.ts`; deleted unused `lib/connect-client.ts` after checking all Connect branch TS/TSX paths for imports.
- Added shared `components/ApplicationSwitcher.tsx`, used by Portal admin and Connect (when Portal admin access is available). Portal admins can open Connect before their first workspace exists.
- Added Connect route-level metadata and CSS import. Kept `cx-` CSS scoping, leaving Portal styling unaffected.
- Moved seven read-only/rollback-only database verification scripts from `database/connect/saas/` to `database/connect/tests/`; source SQL files retain their original names and order.
- Updated Connect documentation paths. Added `database/connect/README.md` and SQL/code structure checks to GitHub branch workflow.

## Deliberately NOT changed

- `main` and all deployed systems; the Production and Development database contents/schema.
- Existing Portal installer generation paths; applied SQL migration history.
- Complex Portal domain modules and the large Portal global stylesheet; bulk moves are unsafe without full regression.
- Connect main feature screens remain orchestrated in `app/connect/page.tsx` and can be split further after authenticated browser tests; this is not evidence of duplicate implementation.

## Verification boundary

**Source inspection performed:** moved files and imports have been checked on the feature branch; stale `components/connect/` and `lib/connect-client.ts` imports were removed from examined Connect source. CI has `npm ci`, TypeScript, Next.js build, structure checks and two Connect layout checks configured.

**Not yet verified:** actual completed CI logs, compiled production build, Portal role regressions, Connect authentication/tenant-switch browser UAT, webhook integrations, or mobile rendering. Passing text/path checks alone does not certify these.

## Before approving merge

1. Review GitHub Actions **Connect branch validation** logs; fix any typecheck, build, structure or import failures.
2. Test Portal admin (with and without a Connect workspace), Portal parent/trainer/student navigation, and Connect owner/manager/viewer roles.
3. Check cross-application navigation, first-workspace creation, sign-in continuity, Connect CRUD, tenant isolation and mobile sidebar.
4. Execute Connect database rollback-only DEV tests in an approved development environment only (never against Production).
5. Run existing Portal scheduling/Zoom/finance regression suite and check key styling at desktop/mobile sizes.
6. Reconfirm branch diff and migration map before user-approved merge.

No validation step should be described as passed until its run result is inspected.

## Simplified organization UX (November 2026)

- Development database read-only inspection confirmed an active `Robotronix Tech Lab` workspace (`robotronix-tech-lab`). No database records were created or altered.
- A user with one authorized workspace opens that workspace directly; its selector is hidden.
- A user with multiple authorized workspaces retains the organization dropdown.
- A user with zero workspace memberships sees an access request / retry gate instead of self-service organization creation.
- The `POST /api/connect/workspaces` provisioning API and multi-tenant backend remain available for future controlled provisioning. **Important:** this pass changes the user interface only; server-side provisioning restrictions are NOT yet implemented. Restrict the API before any public SaaS rollout.
- Existing workspace memberships and tenant permission checks remain the source of truth; a Portal login alone does not grant CRM access.
- Validate that the current account has a membership in Robotronix before testing the direct dashboard flow.
