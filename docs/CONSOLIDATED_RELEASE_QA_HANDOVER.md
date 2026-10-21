> **Fresh database consolidation (2026-10-21):** Former incremental SQL scripts 04–09 were included once in `database/01_install/01_CREATE_SCHEMA.sql` and removed from this branch. Follow [the current 2-file fresh installation and conditional Admin bootstrap](DATABASE_MIGRATION_ORDER.md). Historic upgrade instructions below are superseded; **do not execute the canonical fresh schema against an existing database**.

# Consolidated release — operational handover and QA matrix

> Work in progress. GitHub source commits are not DEV or Production acceptance. No secrets belong in this document.

## Configuration sources of truth

| Integration | Console location / configuration | Server configuration to verify | Test |
|---|---|---|---|
| Supabase | Project Settings > API / Authentication > Providers / SMTP / URL Configuration / Logs | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; SMTP credentials saved privately in Supabase | Trainer Google + email OTP; no anonymous access to payroll tables |
| Google OAuth | Google Cloud Console > APIs & Services > Credentials / OAuth consent screen | Supabase Google provider Client ID/secret; authorized callback URL | Existing trainer Gmail account signs in; duplicate identity not created |
| Netlify | Site configuration > Environment variables / Deploys / Functions logs / Domain management | Production env matches the intended Supabase project; deployment branch verified | Preview build and environment check |
| Zoom | Zoom Marketplace > Robotronix Classroom OAuth scopes, redirect URL, beta/production account sharing; Zoom host settings | OAuth client credentials, encryption key, webhook secret | Host 1 unchanged; Host 2 only after external sharing approval; recording streams and webhooks |
| Razorpay | Dashboard > API keys / Webhooks / Invoices / Test vs Live | Webhook signature key, Razorpay keys and finance settings | Reconciliation in test mode, no live customer charges during QA |
| Email SMTP | Supabase > Authentication > SMTP Settings | Provider SMTP password/App Password **never in GitHub** | Invitation or OTP arrives; investigate Supabase Auth logs on failure |

Check actual configuration in the corresponding console. Do not claim values or switches have been verified merely because code mentions them.

## Workflow-level acceptance map

| ID | Actor sequence | Expected cross-role results | Tests |
|---|---|---|---|
| ACCESS-01 | Admin creates trainer > Grant Portal Access > trainer Google login | One Auth profile/Trainer link, role and disabled checks, portal ready | New and existing email; OAuth and JWT RLS |
| ACCESS-02 | Admin grants non-Google email > trainer email OTP | Six-digit code authentication, no public self-provisioning | Expired/replayed OTP, absent user, email throttling |
| ACCESS-03 | Admin disables trainer | Login/session access blocked and RLS denies sensitive content | Disable during active session |
| FIN-01 | Trainer changes payout > Admin reviews before/after > approve | Notification, monthly effective date, unchanged prior payroll snapshot | Correct/reject, concurrent approvals, sensitive data masking |
| FIN-02 | Admin finalizes payroll > pays via netbanking > enters date/UTR | Approved payout locks, Trainer sees paid status, no external transfer | Race/retries, invalid/no UTR, paid immutability |
| SYNC-01 | Admin reschedules or cancels class > Trainer/Parent/Student tabs open | Updated timetable, actionable alerts, no missed changes | Websocket, tab hidden, offline 60s recovery |
| LEARN-01 | Trainer completes attendance and feedback | Admin/Parent/Student progress reflects records, no extra attendance | All roles, RLS, class pay sync |
| DEMO-01 | Admin schedules demo > Trainer delivers > family reviews | Responsive layout, accurate IST labels, no unnecessary CRM buttons | Mobile/tablet/desktop, cancelled demos |
| ZOOM-01 | Authorized parent plays recording | Range 206/200 permitted, unauthorized 403, Zoom host token never disclosed | Playback in Chrome; stale token, deleted recording |
| ZOOM-02 | Admin deletes recording in Zoom trash > sync | Deleted file doesn't reappear as playable; remote API result confirmed | Reconcile after deletion; audit |
| LOG-01 | Controlled failure in portal API | Safe reference ID, Admin sees log, trainer receives 403, no tokens | Auth, webhook retry, retention |
| DOC-01 | New developer follows runbooks on clean DEV install | SQL 01–03 only for fresh DB; 04–07 only existing DB after review | Deployment/rollback and verification |
| QA-01 | Run release scripts and Playwright on exact commit | No compile, TypeScript or regressions | Save logs and failed test artifacts |

## SQL deployment policy
1. For **fresh DEV** installation use canonical schema followed by master reference data and approved bootstrap/verification.
3. Back up and reconcile existing rows before touching Production. Do not rerun full schema as an upgrade, seed QA accounts or backfill synthetic salary data into Production.
4. Run permission tests as real Trainer and Parent sessions, not only as service-role Admin. Validate updated finance snapshots against existing earnings/payout records.
5. The current candidate has **not** passed these tests. Keep the PR in Draft.

## Release sequence
`npm ci` → `npm run check:release` → `npm run build` → `npm run qa:auth-check` → `npm run qa:roles` → `npm run qa:workflow` → domain/provider DEV checks → 3-browser role flows → controlled Production smoke checks after approval.

## Rollback and troubleshooting
If code preview fails, revert to previous known-good GitHub commit and do not migrate Production database. A SQL migration may not be trivially reversible, especially immutable bank snapshots: prepare a reviewed reversible plan and backup before applying. Supabase Auth/SMTP failures are diagnosed through Supabase Authentication Logs; API failures via private Netlify function logs and restricted Admin System Logs; Zoom/Razorpay via webhook event records and provider dashboards. Never copy raw tokens, banking numbers or complete OAuth callback URLs into support tickets.

## Remaining blockers for production certification
- No connected DEV database or build environment has been exercised in this chat.
- Recording stream HTTP 401 requires a real Zoom host/provider session to reproduce.
- Host 2 integration requires Zoom provider approval.
- Full payroll cutoff migration must be tested against actual existing trainer payout shape and concurrency.
- No claim of all integration or regression checks being passed until saved evidence is available.
