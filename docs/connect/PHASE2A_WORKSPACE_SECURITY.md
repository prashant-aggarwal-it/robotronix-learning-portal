# Connect Phase 2A — Workspaces, Auth, Roles and Invitations

Date: 2026-11-05
Branch: `feature/robotronix-connect-crm`
Status: **Backend and database foundation implemented; frontend and full application regression pending.**
Database: DEVELOPMENT only (`fflejkqcspivnhsmkdtn`). Production and Portal `main` untouched.

## Product boundaries
- One Supabase database per environment; Learning Portal `public` schema and Connect private `connect` schema.
- Both use Supabase Auth `auth.users`, while Connect has its own `connect.memberships` and tenant roles.
- A person may belong to several institutes, each with a distinct role.
- No Connect foreign keys to Portal business tables.
- No direct client grants on `connect` schema. Routes run only on trusted Next.js server with service credentials and independently validate Bearer access tokens using `auth.getUser(token)`.

## Implemented
- Atomic workspace bootstrap: creates a tenant and an active owner membership together.
- Active workspace discovery per authenticated user; suspended/closed tenants filtered.
- Staff member listing restricted to active owner/admin/manager.
- Invite creation restricted to owner/admin; role cannot be owner.
- Cryptographically strong invitation tokens, stored only as SHA-256 hashes; 7-day expiry, email match to *confirmed* Auth user, single acceptance, revocation.
- Staff role/status changes: owner controls owner/admin roles; admins can manage manager/counsellor/viewer; last active owner cannot be disabled or downgraded. Mutations serialized per tenant.
- Access denied on unknown workspace/nonmember; service functions explicitly revoke `anon` and `authenticated` execution.
- Future CRM business tables remain private and server-only; no unreviewed CRUD exposure.

## API contract (server uses service role; clients use access token, NEVER service key)
Use header `Authorization: Bearer <valid Supabase access token>`.
All responses include `Cache-Control: no-store`.

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/connect/workspaces` | Workspaces where active user is active member |
| POST | `/api/connect/workspaces` | Bootstrap a workspace; body `{ "slug": "academy-one", "name": "Academy One" }` |
| GET | `/api/connect/workspaces/:tenantId/members` | Authorized staff listing |
| PATCH | `/api/connect/workspaces/:tenantId/members/:memberId` | Staff role/status; body `{ "role": "manager", "status": "active" }` |
| POST | `/api/connect/workspaces/:tenantId/invitations` | Create invite; body `{ "email": "recipient@example.com", "role": "counsellor" }` |
| POST | `/api/connect/invitations/accept` | Accept invite; body `{ "token": "<one-time invitation token>" }` |
| DELETE | `/api/connect/workspaces/:tenantId/invitations/:invitationId` | Revoke pending invite |

Invite creation currently returns the one-time bearer token to the authorized issuer. Delivery is **manual secure sharing**; SMTP/email delivery and public acceptance UI are not yet implemented. Never log, store in analytics, or expose invitation tokens in URLs. For commercial deployment, implement a vetted transactional email service, rate limiting and abuse protection before enabling this endpoint publicly.

## Database files
- `database/connect/saas/01_connect_independent_schema.sql` — 35 initial Connect tables.
- `database/connect/saas/05_workspace_security.sql` — canonical new-install security module (invitation table and 6 RPCs). Run in that order for a fresh standalone Connect schema.
- `database/connect/saas/07_member_management.sql` — canonical membership management RPC.
- `database/connect/saas/06_auth_user_permission_fix_dev.sql` — history-only correction to existing Development database (already folded into 05).
- `database/connect/saas/08_verify_workspace_security_dev.sql` — transactional rollback-only verification requiring two existing test Auth users.

## Tests actually run in Development
1. Schema contains 36 Connect tables, all with RLS, and 80 existing Portal tables.
2. No Connect business-table FK to Portal business schemas.
3. No `connect` schema access for browser `anon`/`authenticated` roles.
4. No `anon` or `authenticated` privilege on workspace creation or invite acceptance RPCs; service role can execute.
5. Ran workspace creation and membership lookup with SQL role explicitly set to **service_role** — passed.
6. Ran two-user invite test with SQL role `service_role`: wrong email rejected; correct invite accepted; duplicate acceptance rejected; counsellor self-promotion rejected; owner updates/disable allowed; last owner downgrade rejected. Test fully rolled back.
7. Verified zero tenant, membership and invitation rows retained.

## Security limitations and future work
- Service role bypasses RLS by design: **every new API must verify Auth identity and tenant-level authorization before reading/writing Connect data**. The DB RPCs implemented here enforce workspace/member permissions; full contacts/opportunities APIs still to be written.
- No direct per-tenant RLS policies for end users, because the private schema has **no direct client access**. If direct PostgREST access is ever enabled, first implement and test explicit per-tenant RLS policies for every affected table; never grant broad access just to make queries work.
- No automatic invitation email, sign-up acceptance UI, workspace settings UI, subscription entitlements/rate limiting, or abuse controls yet.
- Production migration not applied, no branch merge/deploy.
- **No Next.js typecheck/build or authenticated browser Playwright regression run has been executed in this session.** These are mandatory release gates and must not be represented as passed.

## Safe next steps
1. Run `npm run typecheck`, `npm run build` and existing role/demo/onboarding/finance regression suites locally/CI on the Connect branch against Development.
2. Add accessible workspace and invitation UI, explicit invitation email delivery and recovery/error handling.
3. Build contacts, opportunities, tasks APIs with tenant enforcement reusing the validated membership guard.
4. Retest two institutes and role-level access through authenticated HTTP endpoints before enabling any commercial use.
