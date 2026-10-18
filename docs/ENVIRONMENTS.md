# Environment setup — Development and Production

This is the canonical **from-zero technical setup guide**. It assumes repository access, Node/npm, Git, Supabase and Netlify accounts. The app's current Netlify build targets Node 22 (see `netlify.toml`).

## Separation rules

| Item | Development | Production |
| --- | --- | --- |
| Git code | Feature/release branch | Approved `main` commit |
| Supabase | Dedicated DEV project | Dedicated PROD project |
| Data | Synthetic QA | Real operational data |
| URL | `http://localhost:3000` | `https://portal.robotronixstemlab.com` |
| Razorpay | Test credentials only | Live credentials, after acceptance |
| Zoom | Controlled/test configuration | Approved production OAuth/provider account |
| QA database fixture | DEV only | **Do not run** |
| Reset SQL | Only after explicit DEV review | **Never** |

## A. Clone and start local application

```powershell
git clone https://github.com/prashant-aggarwal-it/robotronix-learning-portal.git
cd robotronix-learning-portal
npm ci
Copy-Item .env.example .env.local
```

Edit `.env.local` **locally**. Use the DEV project values from Supabase → Project Settings → API/Keys (the exact Supabase console labels can change). Keep `NEXT_PUBLIC_SITE_URL=http://localhost:3000`, `NEXT_PUBLIC_APP_ENV=local`, `QA_BASE_URL=http://localhost:3000`. Use the appropriate public client key in `NEXT_PUBLIC_SUPABASE_ANON_KEY`; never place a service-role key in a `NEXT_PUBLIC_` variable.

Start:
```powershell
npm run dev
```

## B. Provision an entirely new Supabase environment

1. Create a new project in the correct environment and save the project URL and keys securely.
2. In Supabase SQL Editor, **for an empty project only**, execute:
   - `database/01_install/01_CREATE_SCHEMA.sql`
   - `database/01_install/02_INSERT_MASTER_REFERENCE_DATA.sql`
3. In Supabase Authentication, configure Google OAuth provider and Google Cloud OAuth client for the exact application/callback URIs shown in the provider consoles. Set appropriate Supabase Auth Site URL and allowed redirect URLs for local and deployed environments; do not mix Dev/Prod credentials.
4. For Production, create the real Admin Auth identity and use `database/01_install/03_BOOTSTRAP_FIRST_ADMIN_EXAMPLE.sql` only after intentionally replacing the placeholder. If the real Admin profile already exists, **do not bootstrap again**.
5. Run `database/03_verify/01_VERIFY_RELEASE.sql`; review warnings and expected grants/RLS.
6. DEV only: create QA identities and execute `database/02_qa/01_QA_SEED.sql`, then run tests.

**Existing project warning:** the fresh schema is an **installer**, not an incremental migration. Do not rerun it on a live installed project merely to deploy a new frontend. For future schema changes create a reviewed and backward-compatible migration.

## C. Configure integrations

Read these separate setup guides:
- [Google sign-in & roles](integrations/AUTHENTICATION.md)
- [Zoom OAuth, webhook, recordings](integrations/ZOOM.md)
- [Razorpay billing, invoice webhooks](integrations/RAZORPAY.md)

Use `.env.example` as the authoritative *variable-name template*; secret values belong in private local env files or Netlify Environment Variables.

## D. Deploy to Netlify Production

1. Link the repository to a Netlify site, confirm production branch = `main`, and publish the approved commit.
2. Build command: `npm run build`; publish directory: `.next`; Netlify Node version: `22` from `netlify.toml`.
3. Configure **Production-scoped** Netlify variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_ENV=production`, `NEXT_PUBLIC_SITE_URL=https://portal.robotronixstemlab.com`; plus provider secrets if the integration is enabled.
4. Configure the production hostname in Netlify Domains and the DNS CNAME in the domain DNS provider. Confirm TLS/HTTPS.
5. Set OAuth and webhook callbacks for the production hostname in the **actual** Supabase, Google, Zoom and Razorpay consoles.
6. In a safe private environment with production variables loaded, run `npm run check:production-env` (it checks consistency but not third-party connectivity).
7. Confirm the Netlify deploy commit matches the approved GitHub commit. Smoke-test role login and read-only module pages.

## E. Validate before acceptance

```powershell
npm run check:release
npm run build
npm run qa:auth-check
npm run qa:roles
npm run qa:workflow
```

Run Playwright suites against **DEV QA data** unless you have explicitly designed a protected Production QA environment. See [Testing](TESTING.md).

## Current known state

Both Dev and Production schema/reference installation were previously reported; Production real Admin profile was verified. **Do not reapply installer SQL to those projects.** Existing Zoom/Razorpay and Production smoke tests still require deployment-specific acceptance.
