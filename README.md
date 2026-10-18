# Robotronix™ Learning Portal

Private learning-operations portal for Robotronix™: **Next.js 16 + React + TypeScript + Supabase**, with Zoom classroom and Razorpay billing integrations.

> **Start here:** [Professional Documentation Hub](docs/README.md) — complete user workflows, feature explanations, Dev/Production setup, integration runbooks, QA and release procedures.

## Guides at a glance

| Topic | Read |
| --- | --- |
| What the application does / navigation by role | [Application handbook](docs/APPLICATION_HANDBOOK.md) |
| Family intake → enrollment → sessions → progress → finance | [End-to-end workflows](docs/WORKFLOWS.md) |
| Clone and configure Dev/Prod (Supabase, Netlify, Google OAuth) | [Environment setup](docs/ENVIRONMENTS.md) |
| Database installer, verification and Dev QA fixtures | [Database and QA](docs/FRESH_INSTALL_AND_QA.md) |
| Zoom host accounts, classroom and recordings | [Zoom integration](docs/integrations/ZOOM.md) |
| Razorpay invoices and payments | [Razorpay integration](docs/integrations/RAZORPAY.md) |
| Roles, Google sign-in and learner linking | [Authentication and roles](docs/integrations/AUTHENTICATION.md) |
| Release/rollback/support | [Operations](docs/OPERATIONS.md) |
| Automated and manual quality assurance | [Testing](docs/TESTING.md) |

## Local quick start

```powershell
npm ci
Copy-Item .env.example .env.local
# Fill .env.local with DEVELOPMENT Supabase values only
npm run dev
```

Test a correctly configured Development environment:

```powershell
npm run check:release
npm run build
npm run qa:auth-check
npm run qa:roles
npm run qa:workflow
```

**Never commit** `.env.local`, passwords, provider secrets or Supabase service-role keys. Keep Dev/Prod projects and provider credentials separate. For fresh database installation follow the guides; do not re-run installer SQL on an installed Production project.

## Source layout

- `app/`, `components/` — UI/routes
- `lib/` — application logic/data
- `database/` — installer, Dev QA and verification
- `qa/`, `scripts/` — automated testing and release checks
- `docs/` — **maintained operational documentation**
- `docs/archive/` — historical release notes, not current setup instructions

**Release status:** this branch remains a release candidate until Production deployment and provider acceptance tests are completed.
