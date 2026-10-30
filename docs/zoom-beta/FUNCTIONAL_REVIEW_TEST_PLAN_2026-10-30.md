# Robotronix Classroom — Zoom Marketplace Functional Review Test Plan
Version: 30 October 2026. Scope: production submission; exercise only disposable reviewer accounts/classes. This is a test procedure, not a claim that each test has passed.

## Reviewer prerequisites and account access
- Public end-user guide: https://portal.robotronixstemlab.com/zoom-guide
- Marketplace install landing page (after deployment): https://portal.robotronixstemlab.com/zoom/connect
- Portal sign-in: https://portal.robotronixstemlab.com/login
- App OAuth redirect: https://portal.robotronixstemlab.com/api/zoom/oauth/callback (callback only; do not open directly).
- Marketplace authorization option: **From your site**. The Zoom app currently remains **User-managed** until the Education reviewer accepts the adult-staff-only approach or authorizes an Account-managed migration.
- Reviewer accounts: one approved, adult Robotronix portal Admin linked to an eligible Zoom test host; a trainer; a parent/test learner; optionally a second Zoom host in a separate eligible account. **Provide usernames and any password/OTP/2FA arrangements privately in Zoom review notes, never in GitHub.**
- If needed, pre-approve Zoom test hosts for Beta testing in the Zoom developer console. Confirm each host plan allows the scopes/features being tested.
- Admin must provision disposable course, enrollment, scheduled lesson, trainer and learner records (no real children's personal data).
- Record the deployed commit SHA, host account eligibility, exact app scopes shown in Production > Scopes, and any restricted feature access before executing.

## Step-by-step functional journey
| ID | Actor | Steps | Expected result |
| --- | --- | --- | --- |
| F01 | Signed-out reviewer | Open /zoom/connect; select Sign in; authenticate as the provided Admin. | Returns to connection landing page. No Zoom authorization occurs while signed out. |
| F02 | Parent or Trainer | Sign in and open /zoom/connect. Attempt /admin/zoom as a normal, non-admin account. | No host authorization action is available. Admin area does not reveal host secrets or private Zoom data. |
| F03 | Adult Admin | Open /zoom/connect. Confirm authorized adult status, continue to Admin Zoom workspace. | Connection controls are accessible only to an approved Admin. This **self-attestation is not independently verified age proof**; reviewer acceptance is required for User-managed Education apps. |
| F04 | Admin | In /admin/zoom select host connection; review Zoom consent/scopes; authorize a disposable eligible Zoom host. | Zoom returns to /api/zoom/oauth/callback and then /admin/zoom; host shows connected. Do not disclose tokens. |
| F05 | Admin | Refresh Admin Zoom workspace and inspect connected host details. | Same host appears; no duplicate host record, access tokens or secrets visible in the UI. |
| F06 | Admin | Prepare disposable online class with the connected host and assigned trainer/learner. | Scheduled class is visible in Admin, Trainer and authorized Parent calendar. |
| F07 | Admin | Review Zoom host allocation and the near-start meeting provisioning window (normally <=35 minutes before start). | No premature mass meeting creation; eligible near-term class becomes ready using an approved host. |
| F08 | Trainer | Sign in; open My Classes; choose assigned class and start/join Classroom near session start. | Correct authorized class opens; trainer gets intended host privileges. |
| F09 | Parent / learner | Sign in, open the same assigned class using the offered join action. | Joins as attendee only, without host or unrelated learner access. |
| F10 | Admin | Reconcile meetings/participant records from Zoom for that test class, when permitted by actual scopes. | Zoom meeting status and participant information are synchronized or actionable error displayed. |
| F11 | Admin / authorized viewer | On test host where cloud recording is enabled, record a disposable class, allow Zoom processing, reconcile recording and test viewing. | Recording only appears and plays for authorized roles; no unauthorized user can view. If host plan does not support recording, mark BLOCKED and explain. |
| F12 | Admin | Test host/meeting time collision with approved disposable schedules (if multiple hosts are available). | Reservations do not double-book one host; unresolved conflicts shown for Admin. |
| F13 | Admin | Update/cancel an unused test class and reconcile. | Corresponding meeting/reservation update or cleanup without unexpected duplicate meetings. |
| F14 | Zoom host owner | Open Zoom Marketplace > Manage > Added Apps, select Robotronix Classroom, Remove, confirm on disposable host only. | Zoom revokes access; future meeting management/sync can no longer use removed authorization. Admin must re-link before reuse. |
| F15 | Admin | Repeat connect for previously removed disposable host if desired. | New authorization succeeds without reuse of invalid previous tokens. |

## Scope-by-scope validation (complete from actual Production Scopes screen)
Zoom requires **each requested OAuth scope** to be justified and mapped to an independently reproducible test.
Create one row for EVERY permission shown in Marketplace; for each record:
1. Exact Zoom scope identifier (copy from console, do not guess).
2. Why it is necessary for a real product action.
3. Test ID(s) F04–F15 demonstrating the action.
4. Expected Zoom API operation and displayed portal outcome.
5. Result PASS/FAIL/BLOCKED; provider response and evidence (redacted).
6. Whether a narrower scope would suffice; remove unused scopes before resubmitting.

**Do not submit this plan as scope-complete until this matrix is filled from the actual Marketplace Scopes list.**

## Deployment and reviewer safety
- Test Zoom authorization against a reviewer-accessible deployment and matching DEV/PROD credentials; avoid production customer data.
- Do not store account passwords, OTPs, Zoom tokens, client secrets or encryption keys in code, screenshots or review documents.
- Note any 2FA, license-tier restrictions, host account invitations, cloud recording toggles and external Zoom beta-user limitations.
- Do not claim webhook, recording, ZAK, scheduled reconciliation or retention work until confirmed in a live controlled provider test.
- Reviewer must be given an exact end-to-end account path and any required test data privately.

## Marketplace manual updates
1. App Listing > Adding Your App > **From your site**; Direct Landing URL `https://portal.robotronixstemlab.com/zoom/connect`.
2. Documentation URL: `https://portal.robotronixstemlab.com/zoom-guide`.
3. Developer Contact: verified company-domain contact email (create/verify first).
4. Education: recommend Account-managed when Zoom can confirm migration plan for two Zoom host accounts; otherwise document adult-only Admin provisioning and request reviewer acceptance of age-gated User-managed authorization.
5. Preserve current callback URL and production OAuth credentials until reviewed.
6. After deployment, smoke test F01–F05; provide private reviewer credentials/access path; add scope test matrix; submit updates in Marketplace.
