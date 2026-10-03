# Deployment — Netlify + Supabase

## 1. Database
For a fresh Supabase project, run only:

`supabase/production-v1-baseline.sql`

Do not run old migration/hotfix scripts; they have been consolidated into the baseline.

## 2. Supabase Auth
- Configure Site URL for the deployed portal.
- Add the deployed portal URL to allowed redirect URLs.
- If using Google OAuth, enable the Google provider and use the Supabase OAuth callback URL in Google Cloud.

## 3. Netlify environment variables
Set:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL=https://YOUR_PORTAL_DOMAIN`
- `NEXT_PUBLIC_APP_ENV=production`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

The service-role key is server-only. Never expose it with a `NEXT_PUBLIC_` prefix.

## 4. Build
Netlify uses the repository settings in `netlify.toml`.
Before pushing a release, run locally:

```bash
npm ci
npm run check:release
npm run build
```

## 5. First administrator
Create/sign in the intended admin Auth user, then use `supabase/bootstrap-first-admin.example.sql` with that email.

## 6. Custom domain
After the Netlify URL works, connect the desired portal subdomain (for example `portal.robotronixstemlab.com`) and update `NEXT_PUBLIC_SITE_URL`, Supabase Auth URLs, and Google authorized origins accordingly.
