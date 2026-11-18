# Phase 7A — Email-first SaaS customer onboarding

## Implementation status

**Core onboarding and invitation backend implemented and tested on DEV.** No PROD, main, or Netlify changes.

### Super Admin assisted onboarding
The Control Centre's **New customer** form now asks for the academy name, URL slug, organization type, Owner name/email and enabled trial modules. It does **not** ask for an Auth UUID. The verified Super Admin creates a seven-day pending invitation with a 256-bit cryptographic token. The database stores only the SHA-256 token hash. A pending invitation **does not create an organization or grant any access**.

The UI displays a one-time manual-delivery invitation URL for the Super Admin to securely send to the Owner; **email is not sent automatically**. Admins can list statuses, replace a link (invalidates previous token; 60-second cooldown) and revoke pending invitations. Create attempts are rate limited to 20 per Admin per hour. Create/replace/revoke operations write platform administration audit entries.

### New or existing Owner acceptance
The link opens `/customer-invite?token=...`. The invitation survives the existing login, OAuth callback and signup flows via `pending-invitation.ts`. The Owner signs in with the **exact invited email**, which must be confirmed in Supabase Auth. The server verifies the actual bearer token and the DB verifies the confirmed email and locks the pending invitation. Wrong-email, expired, revoked or replayed tokens are denied.

On valid acceptance, the existing `saas_onboard_organization_v1` provisions the organization, Owner membership, 14-day trial, enabled modules and eligible CRM/Tasks workspace links in the same database transaction. The pending invitation is marked accepted. This reuses canonical provisioning and ensures idempotency and concurrency-safe acceptance.

An already registered Owner may accept a second organization's invitation without creating another Auth identity.

### Self-registration
The existing `/signup` and `/onboarding/organization` journey remains supported. Verified customers can self-register for allowed trial modules, but cannot set a paid plan, change commercial branding or become Platform Admin. Signup now honors a stored pending invitation even if verification and session establishment happen immediately.

New customers default to Standard Robotronix branding. Admins configure paid subscriptions and commercial branding separately.

## DEV schema history
- `79_phase7a_pending_customer_invitations.sql`: pending records, locked one-time activation, strict email checks.
- `80_phase7a_pending_customer_admin_rpc.sql`: service-only create/list/revoke.
- `81_phase7a_invitation_throttle_rotation.sql`: rate limit and link rotation.
- `82_phase7a_invitation_audit.sql`: audit for pending invitation create/rotate/revoke.

All four migrations have been **applied successfully to DEV**, not PROD. Anonymous/authenticated database roles cannot execute privileged invitation RPCs.

## Verified acceptance
- DEV transaction-rollback verification: pending does not confer membership; wrong verified email denied; correct verified email provisions exactly one Owner, trial and academy module; replay, revoke and expiry rejected. No retained data.
- [Real authenticated DEV HTTP Actions run 44299859092](https://github.com/prashant-aggarwal-it/robotronix-learning-portal/actions/runs/44299859092): signed-in synthetic Super Admin creates invitation; unauthorized requester denied; wrong-email and replay denied; invited Owner activates Academy; same Owner joins a second Academy without duplicate Auth identity; revoked invitation denied; independently verified user self-registers; cross-tenant authorization passes.
- Browser tests `qa/phase7a-customer-onboarding.spec.ts`: mock-backed Super Admin form and invitation page.
- TypeScript, Next.js production build and Phase7A contract tests in `.github/workflows/phase7a-customer-onboarding.yml`.
- [DEV QA cleanup Actions run 44300187322](https://github.com/prashant-aggarwal-it/robotronix-learning-portal/actions/runs/44300187322): exact synthetic users removed; SQL independently verified zero synthetic Auth users/organizations/invitations/admin grants, and last-owner guard enabled.

**Limitations:** Test users were created with DEV Supabase Admin API and email-confirmed by QA; this verifies real bearer authorization, not actual external mailbox delivery. Browser acceptance uses mocked API responses. Full SMTP delivery, inbox bounce/retry tracking, publicly accessible invitation URL configuration, and customer-performed acceptance using a real external mailbox are not independently certified. The manual copy-link fallback is implemented and clearly labeled.

## Operational customer test
1. Run DEV locally with correct `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and server-only `SUPABASE_SERVICE_ROLE_KEY`.
2. Sign in as a verified Platform Admin; open `/platform-admin#onboarding`.
3. Enter real name, Owner email and unique slug; select allowed modules; create invitation.
4. Copy the one-time link and share privately. Do not expect automatic email delivery.
5. In another browser profile, sign in (or register and confirm) as the invited Owner, open the link and accept.
6. Verify the Academy appears in the Owner workspace and the Super Admin Directory, then configure subscription/branding independently.

## Production release posture
**Not yet certified for an automated email-based public launch.** The manual invitation process can be used for controlled DEV testing. Configure a supported transactional-email provider and verify full delivery + real mailbox acceptance before advertising "Create customer and send email." Carry forward migrations 79–82 only after an approved production release plan and backup/recovery review. Never merge/deploy automatically.
