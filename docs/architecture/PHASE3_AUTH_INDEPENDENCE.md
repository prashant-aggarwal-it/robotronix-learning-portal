# Phase 3 — Independent sign-in, onboarding and product account permissions

**Branch:** `feature/modular-platform-architecture`  
**Status:** Implemented in source; CI checks and isolated authenticated E2E are release gates. **Not merged or deployed.**

## Boundary implemented

All products use Supabase Auth within their *own selected deployment project*. They do **not** require the Learning Portal's `public.profiles` for CRM-only or Tasks-only use. A combined installation in one Supabase project shares one Auth identity. Multi-project SSO, token exchange, identity mapping and paid entitlements remain separate future work.

| Product mode | Authentication | Product authorisation | Onboarding |
|---|---|---|---|
| Portal-only | Existing Supabase login/OAuth/OTP | Existing Portal active profile, role and trainer access controls | Existing parent/family onboarding |
| CRM-only | Supabase Auth; verified email required | CRM `connect.memberships` / tenant-scoped RPCs, not Portal roles | New CRM account can create its own workspace or accept an invitation |
| Tasks-only | Supabase Auth; verified email required | `tasks.accounts` active/suspended state and task RPC permissions | `/tasks/welcome` calls `task_account_activate`, no Portal tables |
| Explicit combined | Shared Auth identity in same project | Separate per-product authorization; Portal role does not automatically grant CRM/Tasks | Each enabled product requires its own setup |
| Existing legacy combined (no `PRODUCT_MODE`) | **Preserved** Portal-first behavior | Existing disabled Portal account blocks access as before; Tasks can use Portal-active account | Existing Portal onboarding behavior remains |

## Code changes

1. `lib/platform/auth-routing.ts`: pure product-aware routing, strict in-app post-auth path allowlist, disabled/unlinked account decisions and Portal legacy-compatible redirects.
2. `lib/platform/auth-client.ts`: Supabase sign-in/Google OAuth/existing-account OTP and opt-in email registration for explicit CRM/Tasks deployments. Only loads identity details for installed product(s); legacy Portal accounts do not need optional CRM/Tasks RPCs.
3. `app/login/page.tsx`: product-aware registration, sign-in/OTP, message, redirect and Portal-only parent/Zoom CTAs.
4. `app/auth/callback/page.tsx`: login completion and OAuth redirects use the same safe product-aware resolver.
5. `lib/server/tasks/auth.ts`: Tasks account state and verified email enforce standalone permissions; Portal profile read happens **only in legacy mode** to preserve existing security.
6. `app/api/tasks/onboarding/route.ts`: avoids Portal profile lookups for explicit modules and never writes onboarding error telemetry to Portal tables.
7. `lib/server/connect-auth.ts`: CRM user token verification and email confirmation (explicit modular modes) before executing CRM membership-checked RPCs.
8. `features/connect/ConnectAuthGates.tsx` + `app/connect/page.tsx`: independent CRM sign-in copy, Google/OTP link, verified users' new-workspace creation, secure invitation-code acceptance and Portal navigation lookup only when CRM–Portal integration is installed.
9. `lib/platform/auth-routing.test.mjs`: standalone and combined destinations, legacy policies, suspended users, malicious `next` strings, Portal-free Tasks onboarding guard.
10. `package.json`: `check:auth` command, included in `check:release`; feature branch CI runs it, TypeScript and Portal compatibility build.

## Security invariants

- The deployment flag is **not** a customer entitlement or proof of database schema availability; API/RPC membership checks remain mandatory.
- Supabase `auth.getUser(bearer)` verifies each API request's user identity before any CRM/Tasks service-role RPC is called.
- In **explicit** CRM/Tasks modes, unverified emails are denied by product-specific server API layers; new email registration cannot bypass verification by redirecting the browser.
- CRM tenant membership/role must be checked by every business RPC; a new account with no workspace sees a workspace creation/invitation view, not another tenant's records.
- Tasks suspended accounts cannot execute Tasks core operations; activating a new account requires verified email.
- URL overrides accept only exact known internal paths (no external, protocol-relative, encoded, query or fragment redirects).
- Existing Portal-only and legacy combined sign-in account restrictions remain unchanged.
- No extra user is granted Portal access merely by creating a CRM/Tasks account.

## How to verify

```bash
git switch feature/modular-platform-architecture
git pull --ff-only origin feature/modular-platform-architecture
npm ci
npm run check:modules
npm run check:auth
npm run typecheck
npm run build
```

Clean-project E2E tests still required: (1) Portal existing admin/parent/trainer/student and disabled accounts; (2) CRM-only signup, email verification, OAuth, workspace creation, invitation acceptance (manual secure token delivery), roles and tenant isolation with no Portal tables; (3) Tasks-only signup, activation, tasks creation and suspended user denial with no Portal tables; (4) combinations, OAuth callback `next` safety and cross-product identity rules. Confirm provider OAuth redirect URLs and email templates in each Supabase project before release.

## Still pending in subsequent phases

- **Phase 4:** comprehensive server-side product entitlement checking for every API, including internal actions and integration adapters.
- **Phase 5:** per-product branding/landing/nav and an entitlement-aware Application Switcher.
- **Phase 6/7:** optional cross-project integrations, scheduler cutovers, per-product deployment builds/domains and secrets.
- **Phase 8:** isolated database + authenticated browser QA and production release approval.

**No production databases, cron jobs, deploys or `main` commits were modified by Phase 3.**
