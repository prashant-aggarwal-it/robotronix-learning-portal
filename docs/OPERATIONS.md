# Operations, deployment, rollback and troubleshooting

## Ownership model

- **Application owner/Admin:** approves business configuration, role access, production changes and billing/Zoom readiness.
- **Developer:** maintains code, SQL changes, automated QA and documentation.
- **Release operator:** verifies commit, CI and Netlify deployment; never pastes secrets into issues or support chat.

## Release procedure

1. Confirm selected release branch, changed files and security-sensitive diffs. Commit local work intentionally; do not stage `.env.local`.
2. Run `npm ci`, `npm run check:release`, `npm run build` and the DEV QA suites in [Testing](TESTING.md).
3. Confirm DEV Supabase verification SQL and QA fixtures pass; verify new database changes are backed by reviewed migrations for already installed projects.
4. Obtain approval for merging the PR into `main`. **Do not merge or deploy implicitly.**
5. Verify Netlify production deploy for the **same** GitHub commit and correct Production-scoped environment values.
6. Sign in with real Admin and inspect read-only pages: Dashboard, Students, Trainers, Courses, Enrollments, Schedule, Finance, Invoices, Zoom, Demos and notifications.
7. Test provider writes only when approved and safely isolated; use provider test modes.
8. Record deployment commit, date, CI result, DB migration applied (if any), exceptions and rollback target in the PR/release notes.
9. Tag the accepted baseline when production acceptance is complete.

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
- Do not run `database/99_dev_tools/00_DEV_ONLY_RESET_PUBLIC_SCHEMA.sql` outside an intentionally disposable DEV database.
- Do not run archived `database/02_sanity` or historical upgrade SQL against current Production.

## Reference points

- [Environment setup](ENVIRONMENTS.md)
- [Testing and release gates](TESTING.md)
- [Database active workflow](FRESH_INSTALL_AND_QA.md)
- `netlify.toml`, `.github/workflows/release-candidate.yml`
