# Phase 4C — DEV Tenant Security Audit and Certification Gate

## Scope
DEV Supabase `uzzuquxeeqonxeqcuohh` only. No production operations, deployments, or customer-data resets.

## Verified database posture (2026-11-16)
- `public`: 80/80 ordinary tables have RLS enabled
- `saas`: 26/26 ordinary tables have RLS enabled
- `connect`: 66/66 ordinary tables have RLS enabled
- `tasks`: 21/21 ordinary tables have RLS enabled
- No policies with exactly `qual='true'` or `with_check='true'` in these four schemas.
- Sixteen `public` SECURITY DEFINER functions are executable by `anon`. Most are legacy Academy authorization helper functions; one is public Academy branding lookup. These require function-by-function input, output, and privilege review. Do not revoke blindly because RLS policies and public branding may depend on them.

## Implemented
- Server-side SaaS membership lookup now requires a verified, non-anonymous user.
- Existing tenant resolver rejects IDs outside active memberships, and does not silently select among multiple organizations.
- Module checks require active organization authorization and module entitlement.
- Organization selection cookies carry an identifier only and are not accepted as authentication.
- Platform administrator checks remain separate from SaaS tenant membership.
- Phase 4C branch is added to authenticated DEV two-tenant E2E workflow triggers.
- Phase 4C security contract tests added.

## Mandatory certification gates not yet executed
1. `npm ci --ignore-scripts`
2. `npm run typecheck`
3. `node --test lib/server/saas/phase4c-tenant-security.test.mjs lib/server/saas/phase4b-onboarding-contract.test.mjs`
4. Existing SaaS authorization, subscription and organization-link contract tests
5. Authenticated DEV two-tenant E2E workflow (GitHub Actions; environment `qa`)
6. Negative tests: user A cannot list, read, modify or delete user B's Academy, CRM, Tasks, invoices, files, or communications.
7. Privileged-RPC review of public SECURITY DEFINER functions, including anonymous execution.
8. Repeat RLS and DB security advisors, resolve findings or document justified exceptions.

## Certification
NOT PASSED until live authenticated cross-tenant tests and required build/test checks pass. No claim of zero vulnerabilities.

## Certification update — 2026-11-17

### Completed and evidenced
- Local operator reported `npm run typecheck` success and 34/34 local tests passed (9 auth routing, 14 backend modules, 11 Phase 4B/4C contracts).
- GitHub Actions authenticated DEV two-tenant workflow run [#99, attempt 4](https://github.com/prashant-aggarwal-it/robotronix-learning-portal/actions/runs/43908647954) completed **successfully**, including the authenticated Academy/CRM/Tasks isolation job and Phase 3C invitation acceptance/revocation job.
- DEV-only QA fixture RPCs were installed with `service_role` execute access and no `anon` or `authenticated` execute access; synthetic trial subscriptions were added to fixture setup and cleanup.
- Academy enrollment RPC was corrected to use the Asia/Kolkata calendar date, consistent with the enrollment date validation trigger; correction committed in `database/saas/10_academy_tenant_api.sql`.
- Read-only privileged-function inspection found 16 `public` SECURITY DEFINER functions executable by `anon`: 15 legacy Academy role/relationship helpers that use `auth.uid()` directly or indirectly, and `saas_public_academy_brand(text)`, which intentionally serves public branding for active subscribed Academy organizations.
- DEV security advisors run on 2026-11-17. Informational `rls_enabled_no_policy` findings (155) were returned across internal schemas. These are not evidence that RLS is disabled; server-only schemas require explicit classification before changing access. [Supabase advisor reference](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

### Outstanding security decisions and limits
- Do **not** assume the 15 legacy authorization helpers need public/anonymous EXECUTE simply because RLS policies may call them. Review call sites, RLS evaluation role, and anonymous request behavior before any REVOKE. No function grants were modified during this audit.
- Classify all advisor findings by schema exposure and intended server-only design; do not create permissive policies to silence the linter.
- The green E2E workflow validates the covered cross-tenant scenarios; it does not independently prove all future routes, storage objects, billing flows or communication APIs secure.
- A full production readiness/security signoff remains **pending** until these reviews are completed and relevant regression tests are rerun after any hardening changes.

### Gate outcome
**Phase 4C functional DEV E2E gate: PASS.** **Phase 4C final security certification: PENDING** due to privileged-function grant review and security-advisor disposition. No PROD changes, main merge or Netlify deployment authorized.

## Additional DEV privilege review — 2026-11-17
- Inspected all 16 anonymous-executable `public` SECURITY DEFINER functions. Fifteen are read-only boolean/identity Academy authorization helpers using `auth.uid()` (directly or through helper calls); one is `saas_public_academy_brand(text)`, which returns publicly intended branding for active subscribed Academy tenants. **No anonymous mutation-capable SECURITY DEFINER function was found in this set.** Existing EXECUTE grants were retained to avoid breaking RLS policy evaluation and public branding.
- Inspected RLS-enabled tables without policies in four key schemas: `connect` 66, `public` 26, `saas` 22, `tasks` 17. All `connect`, `saas`, and `tasks` no-policy tables had no direct SELECT grant to `anon` or `authenticated`. Two `public` no-policy tables (`invoice_sequences`, `system_settings`) had authenticated privileges despite default-deny RLS.
- **DEV-only correction executed and verified:** `REVOKE ALL PRIVILEGES ON TABLE public.invoice_sequences, public.system_settings FROM anon, authenticated;`. Post-change queries confirm no authenticated SELECT or INSERT grants on either table. Existing RLS remained enabled. Privileged service-side access was not revoked.
- Advisor `rls_enabled_no_policy` INFO notices for server-only tables are an intentional default-deny posture, **not a reason to add permissive policies**. This audit is scoped to the inspected schemas and the 16 public anonymous-executable definer functions; other advisor categories and application endpoints are not exhaustively certified here.
- This change was made directly in DEV. It must be added to the canonical deployment SQL/migration package and covered by a post-change regression run before final signoff.
