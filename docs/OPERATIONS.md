# Operations, deployment, rollback and troubleshooting

## Ownership model

- **Application owner/Admin:** approves business configuration, role access, production changes and billing/Zoom readiness.
- **Developer:** maintains code, SQL changes, automated QA and documentation.
- **Release operator:** verifies commit, CI and Netlify deployment; never pastes secrets into issues or support chat.

## Release procedure

1. Confirm selected release branch, changed files and security-sensitive diffs. Commit local work intentionally; do not stage `.env.local`.
2. Run `npm ci`, `npm run check:release`, `npm run build` and the DEV QA suites in [Testing](TESTING.md).
3. Confirm DEV Supabase verification SQL and QA fixtures pass; verify new database changes are backed by reviewed migrations for already installed projects.
   For a replacement **empty** project, generate `database/generated/ROBOTRONIX_FRESH_INSTALL.sql` with `npm run db:build-fresh-install` and execute it once. Never use the fresh installer as an upgrade against an existing populated database.
4. Obtain approval for merging the PR into `main`. **Do not merge or deploy implicitly.**
5. Verify Netlify production deploy for the **same** GitHub commit and correct Production-scoped environment values.
6. Sign in with real Admin and inspect read-only pages: Dashboard, Students, Trainers, Courses, Enrollments, Schedule, Finance, Invoices, Zoom, Demos and notifications.
7. Test provider writes only when approved and safely isolated; use provider test modes.
8. Record deployment commit, date, CI result, DB migration applied (if any), exceptions and rollback target in the PR/release notes.
9. Tag the accepted baseline when production acceptance is complete.

### Replacement Supabase project cutover

1. Confirm explicitly that the new project is replacing Production and understand that existing Auth users and portal records **will not move automatically**. Establish migration/retention expectations and recovery options before disabling the old project.
2. Install and verify the new empty database, create the intended real Admin Auth identity, configure Google provider and redirect allowlists, and perform DEV-equivalent role checks.
3. Update Netlify Supabase project URL and keys for all relevant environment scopes; never disclose key values in release logs.
4. Check Zoom host OAuth reconnect requirements, encryption key continuity, Razorpay callbacks, reminder/recording scheduled functions, and site hostname.
5. Smoke-test production before admitting new families or payment flows. Preserve the old project until the replacement is accepted.

## Initial diagnostic checks

- **App will not load:** Netlify build/deploy logs, site/domain DNS, TLS, root URL and current commit.
- **Login redirects incorrectly:** Supabase/Google OAuth callback, Auth Site URL allowlist, environment URL, profile role/active status.
- **Admin cannot see records:** correct Supabase project, RLS/grants, role links, API/server logs; don't disable RLS as a workaround.
- **Class not visible:** enrollment and event status, trainer assignment, timezone, scheduled date, session filters.
- **Live UI stale:** `hooks/useLiveRefresh.ts` subscriptions/recovery, Supabase Realtime, permissions, browser connectivity.
- **Zoom failures:** see [Zoom](integrations/ZOOM.md).
- **Invoice mismatch:** see [Razorpay](integrations/RAZORPAY.md).

## Rollback

1. Stop new operator/provider write actions while diagnosing.
2. Locate the last **known-good deployed commit** in Netlify, compare configuration and recent code changes.
3. Revert/redeploy the tested application revision if needed; verify Auth and read-only workflows.
4. **Never** assume rolling back frontend code reverses a database migration. Database rollback requires a separate reviewed plan, backup and compatibility assessment.
5. Reconcile outstanding Zoom meetings/webhooks and Razorpay events separately—remote provider changes aren't reverted by a Git rollback.
6. Document incident, cause, impact and checks before resuming writes.

## Backups and security

- Protect Supabase project access; use tested backups and an explicit restore rehearsal appropriate to your plan.
- Rotate exposed credentials immediately through their provider; redeploy and validate callbacks afterward.
- Keep secrets in Netlify env vars or private local files; never put them in GitHub docs, logs, screenshots or support tickets.
- Production's real Admin must never be used as a synthetic test account.
- Supabase Free Plan does not provide scheduled project backups; for a destructive reset/replacement, explicitly record the owner-approved recovery posture before proceeding.
- Do not run `database/99_dev_tools/00_DEV_ONLY_RESET_PUBLIC_SCHEMA.sql` outside an intentionally disposable DEV database.
- Do not run historical upgrade SQL or the QA seed generator's archived source against Production.

## Reference points

- [Environment setup](ENVIRONMENTS.md)
- [Testing and release gates](TESTING.md)
- [Database active workflow](FRESH_INSTALL_AND_QA.md)
- `netlify.toml`, `.github/workflows/release-candidate.yml`
