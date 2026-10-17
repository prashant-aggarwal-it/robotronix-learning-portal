# Robotronix™ Learning Portal — FINAL DEPLOYMENT & OPERATIONS GUIDE

Release date: 2026-10-16
Release model: one consolidated source tree, one fresh database schema, no historical hotpatch replay.
Production URL: https://portal.robotronixstemlab.com
GitHub repository: https://github.com/prashant-aggarwal-it/robotronix-learning-portal

## 1. Golden rule

Treat this extracted folder as the only release source. Do not copy files from older Robotronix ZIPs and do not run old hotfix SQL. The current database installer is already consolidated.

Never commit `.env.local`, `.env.sanity.local`, service-role keys, Razorpay secrets, Google OAuth secrets, Zoom Client Secret, Zoom token-encryption keys or passwords.

## 2. First local verification after extracting this ZIP

Open PowerShell in the extracted project folder and run:

```powershell
npm ci
npm run check:deployment
npm run qa:workflow
```

`check:deployment` runs the release checks and a production build. The workflow suite is included separately here because its final student-page retry hardening was the last QA correction.

For the full Development QA gate, after the DEV database/QA fixtures are ready, run:

```powershell
npm run qa:dev-cycle
```

This is an alias for `npm run qa:prod-gate`.

If a Playwright run fails once with a Chromium/browser-context protocol error, rerun that suite once before changing product code. A reproducible product/DB failure should be investigated; a one-off browser-context failure should not trigger application changes.

## 3. GitHub — push this exact frozen release

Repository: `prashant-aggarwal-it/robotronix-learning-portal`
Default branch: `main`

From this project folder:

```powershell
git status
git remote -v
git branch --show-current
```

Confirm `origin` points to:

```text
https://github.com/prashant-aggarwal-it/robotronix-learning-portal.git
```

If this folder is already the existing clone, then:

```powershell
git add -A
git status
git commit -m "Final consolidated production release 2026-10-16"
git push origin main
```

Before committing, inspect `git status` and confirm no `.env*` secret file is staged. `.env.example` and `.env.sanity.example` are intentionally safe templates and may be committed.

If this extracted folder is not a Git working tree, use the existing repository clone as the destination and replace its tracked project files with this release, or clone fresh and copy this release into it. Do not run `git init` and force-push over existing history unless you intentionally want to replace history.

## 4. Development database — clean rebuild when required

Use a Development Supabase project only. Never run the DEV reset against Production.

In Supabase SQL Editor, run in this order:

1. `database/99_dev_tools/00_DEV_ONLY_RESET_PUBLIC_SCHEMA.sql`
2. `database/01_install/01_CREATE_SCHEMA.sql`
3. `database/01_install/02_INSERT_MASTER_REFERENCE_DATA.sql`
4. Create/verify QA Auth users with `npm run qa:create-users`
5. `database/02_qa/01_QA_SEED.sql`
6. `database/03_verify/01_VERIFY_RELEASE.sql`

Then run:

```powershell
npm run check:release
npm run build
npm run qa:dev-cycle
```

QA cleanup is optional:

```text
database/02_qa/02_QA_CLEANUP.sql
```

Delete QA Auth users only when you intentionally want to remove them:

```powershell
npm run qa:delete-users
```

## 5. Production Supabase — fresh install only

For the new Production database run only:

1. `database/01_install/01_CREATE_SCHEMA.sql`
2. `database/01_install/02_INSERT_MASTER_REFERENCE_DATA.sql`
3. `database/03_verify/01_VERIFY_RELEASE.sql`
4. Bootstrap the real first Admin using the documented production process.

`database/01_install/03_BOOTSTRAP_FIRST_ADMIN_EXAMPLE.sql` contains an example. Do not execute its placeholder values unchanged.

Do NOT run in Production:
- DEV reset SQL
- QA seed/cleanup
- QA Auth/Profile repair SQL from old conversations/releases
- historical hotfix/patch SQL
- old incremental migrations from earlier ZIPs

## 6. Netlify production configuration

Connect Netlify to the GitHub `main` branch and deploy the exact commit that passed the local gate.

Set Production environment variables in Netlify. Required groups include Supabase, Google OAuth, Razorpay and Zoom. Use `.env.example` only as a naming reference.

Important production values include:

```text
NEXT_PUBLIC_APP_ENV=production
NEXT_PUBLIC_SITE_URL=https://portal.robotronixstemlab.com
# Optional: direct Google "Write a review" link used only after positive learner milestones
NEXT_PUBLIC_GOOGLE_REVIEW_URL=https://g.page/r/CY2m6TlvKlmoEBM/review
ZOOM_REDIRECT_URI=https://portal.robotronixstemlab.com/api/zoom/oauth/callback
```

Keep all secrets server-only. Never rename a secret with a `NEXT_PUBLIC_` prefix.

After Netlify deploys, verify:
- `/` loads
- role login/routing works
- no production configuration warning appears
- Netlify is using the intended Production Supabase project
- security headers are present
- browser console has no blocking production errors

## 7. Production sanity cycle — BEFORE real customer data

Create `.env.sanity.local` from `.env.sanity.example` and fill Production-sanity credentials locally. Do not commit it.

Use:

```text
QA_TARGET=production
QA_BASE_URL=https://portal.robotronixstemlab.com
```

Then:

```powershell
npm run sanity:create-users
```

Run in Production Supabase:

```text
database/02_sanity/01_PROD_SANITY_SEED.sql
```

Run:

```powershell
npm run qa:prod-sanity
```

Manually smoke-check Admin, Trainer, Parent and Student logins, one class workflow, finance, communications and Zoom POC.

Then clean synthetic data:

```text
database/02_sanity/02_PROD_SANITY_CLEANUP.sql
```

Finally:

```powershell
npm run sanity:delete-users
```

Only after this is green should real learner/family data be entered.

## 8. Zoom POC after Production deploy

The current Zoom implementation is a controlled POC, not yet real-schedule automation.

Confirm the Zoom Marketplace app has the required meeting read/write/update/delete scopes and user/ZAK access, and that the redirect URI is exactly:

```text
https://portal.robotronixstemlab.com/api/zoom/oauth/callback
```

Then as Admin:
1. Open `/admin/zoom-test`.
2. Connect Zoom Host 1.
3. Create a 30-minute test meeting.
4. Start it as Trainer in one browser/profile.
5. Join as participant in another browser/profile.
6. Verify embedded camera, microphone, audio and leave flow.
7. Only then connect Host 2 and repeat.

Not yet claimed as complete: automatic host allocation, real schedule meeting creation, conflict/capacity blocking, webhook attendance, presence duration, live class dashboard and camera-state monitoring.

## 9. Real operational workflow

### New family
Use Family Onboarding → review guardian/learner/timezone/timing/course details → approve → create enrollment → assign trainer/schedule → invite/access.

### Existing active learner migration
Use the active-existing migration flow. Preserve the learner's true historical start date, total agreed sessions, opening completed sessions/minutes, portal tracking start date, negotiated package/fee, amount collected before portal and migration note. Do not create fake historical classes or fake receipts.

### Siblings
Reuse the existing family/parent record and add the sibling. Avoid duplicate parent/family identities.

### Enrollment and renewal
Each renewed course/package should be a new enrollment/package record. Never overwrite the historical negotiated terms of the previous enrollment.

### Class delivery
Trainer records attendance, actual duration, learning/progress, projects/skills, parent-visible progress note and separate internal Trainer/Admin note, then completes the class. Internal notes must never appear in Parent/Student views.

### Hold/resume and trainer changes
Use hold/resume and reassignment workflows. Do not delete delivered/history-bearing classes.

### Finance
Migrated active learners use opening finance values for historical collections. New payments are recorded normally after go-live. Student finance and trainer payroll remain separate ledgers. Protected paid/approved history should not be destructively edited.

### Progress and renewal
Effective progress = opening migrated progress + portal-delivered progress. Use near-completion warnings to contact families before remaining sessions are exhausted.

### Communications
Use messages/notifications and resolve conversations rather than deleting operational history.

### Administration
Use Audit, Alerts and Notifications for investigation. Avoid direct database edits except for documented install, verification, sanity or specifically reviewed repairs.

## 10. SEO, metadata and responsiveness

This release includes descriptive metadata and Robotronix/STEM/robotics/coding keywords in the application metadata. The portal intentionally remains `noindex, nofollow` through metadata, `robots.ts` and response headers because it contains authenticated learner, parent, trainer and finance information.

This is the correct SEO posture: optimize the public marketing website (`www.robotronixstemlab.com`) for search; keep the private portal out of search engines.

Responsive behavior is built into the portal CSS for desktop/tablet/mobile breakpoints and is covered by the Playwright mobile/responsive suite (`npm run qa:mobile`).

## 11. Release discipline

After this release is deployed and accepted:
- tag/label this Git commit as the Production v1.0.0 baseline;
- make future changes in normal Git commits/branches;
- make one reviewed consolidated database migration per future release rather than accumulating ad-hoc SQL patches;
- never reconstruct Production from old patch ZIPs.
