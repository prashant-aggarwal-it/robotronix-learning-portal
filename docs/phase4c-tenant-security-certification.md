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
