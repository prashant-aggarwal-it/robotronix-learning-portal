# Phase 4A — DEV administrator bootstrap and acceptance

## Identity model
- Platform administrator: `contact@robotronixstemlab.com` (Supabase email/password)
- Robotronix Academy owner: `robotronixstemlab@gmail.com` (Google OAuth)
- Neither identity receives tenant membership or platform privilege automatically.
- `saas.platform_administrators` is the only platform-role source.
- Organization membership and module entitlements remain separate.

## Manual steps (DEV only)
1. Enable Email provider and email confirmation in DEV Supabase Auth.
2. Allowlist the DEV application's `/auth/callback` and `/auth/reset-password` URLs in Supabase Auth redirect configuration.
3. Register the platform email through `/signup` and verify the mailbox. Do not use a shared mailbox password as the app password.
4. In the DEV SQL editor, after verification, run the bootstrap transaction below. It will fail closed if the account is missing/unverified or already has a tenant membership. It does not create any user or organization.

```sql
BEGIN;
DO $$
DECLARE v_user uuid;
BEGIN
 SELECT id INTO STRICT v_user
 FROM auth.users
 WHERE lower(email)='contact@robotronixstemlab.com'
   AND email_confirmed_at IS NOT NULL;
 IF EXISTS (SELECT 1 FROM saas.memberships WHERE user_id=v_user) THEN
   RAISE EXCEPTION 'Platform bootstrap requires a platform-only identity';
 END IF;
 INSERT INTO saas.platform_administrators(user_id,role_key,active)
 VALUES(v_user,'super_admin',true)
 ON CONFLICT(user_id) DO UPDATE
 SET active=true,role_key='super_admin',updated_at=now();
END $$;
COMMIT;
```

5. Sign out and sign back in. Verify the platform account reaches `/platform-admin` and cannot access customer operations.
6. Sign in with a separate ordinary customer account. Verify platform API returns HTTP 403.
7. Verify reset email links work; configure SMTP delivery and rate limits for deployment.
8. Enable MFA enforcement for privileged accounts before production rollout.

## Scope and caveats
- This file is a manual one-time DEV bootstrap guide, not a migration.
- Never execute the bootstrap on production without separate approval.
- This phase does not create a tenant, modify existing customer memberships, or provision module entitlements.
- Full end-to-end and CI validation are mandatory before certifying Phase 4A.
