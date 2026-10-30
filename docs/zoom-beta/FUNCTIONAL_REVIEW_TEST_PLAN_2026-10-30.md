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

## Production OAuth scope audit and reviewer test matrix (code-reviewed 30 October 2026)

This maps the eight scopes visible in Zoom Marketplace Production to implemented server-side API calls in GitHub main. **Code-reviewed does not mean live-tested.** Reviewer must record PASS/FAIL/BLOCKED and redacted evidence after testing a disposable host.

| Exact production scope | Implementation evidence | Reproducible reviewer action | Expected result | Live result |
| --- | --- | --- | --- | --- |
| `meeting:write:meeting` | `lib/server/zoom-classroom.ts`: `POST /users/me/meetings`; `app/api/zoom/test-meeting/route.ts` | F04–F05 connect host, create disposable test meeting in Admin Zoom or provision eligible near-start online class (F06–F07). | Meeting created in Zoom and reflected in portal without duplicate. | NOT RUN |
| `meeting:delete:meeting` | `lib/server/zoom-classroom.ts`: `DELETE /meetings/{id}`; `app/api/zoom/test-meeting/route.ts` | F13 cancel/delete a **disposable future** meeting/test class. | Meeting removed/cancelled remotely; portal state reconciled. | NOT RUN |
| `meeting:update:meeting` | `lib/server/zoom-classroom.ts`: `PATCH /meetings/{id}` | F13 change a future disposable online class time (where authorized workflow permits). | Corresponding Zoom meeting time updates without duplicate. | NOT RUN |
| `meeting:read:meeting` | `lib/server/zoom-classroom.ts` and `app/api/zoom/reconcile/route.ts`: `GET /meetings/{id}` | F10 Admin reconciles a provisioned test meeting. | Updated meeting metadata/status shown in portal. | NOT RUN |
| `cloud_recording:read:recording` | `app/api/zoom/reconcile/route.ts`: `GET /meetings/{id}/recordings`; `app/api/zoom/recordings/[recordingId]/stream/route.ts`: authorized download | F11 use recording-enabled eligible host, conduct disposable class, allow Zoom processing, reconcile and play as authorized viewer. | Recording discovered and playable only by permitted viewer; requires Zoom recording-capable plan. | NOT RUN |
| `user:read:user` | `app/api/zoom/oauth/callback/route.ts`: `GET /users/me` | F04–F05 complete OAuth, then inspect Zoom host listing in Admin. | Host ID/email linked to correct authorized host; no access token shown. | NOT RUN |
| `user:read:zak` | `app/api/zoom/sdk-session/route.ts`: `GET /users/me/zak` for authorized host | F08 start eligible test meeting as assigned trainer via embedded Classroom; verify host experience (meeting SDK). | Authorized host session can start; attendee cannot obtain host privilege. | NOT RUN |
| `meeting:read:participant` | **No direct participant REST API call found in inspected Zoom integration.** `app/api/zoom/webhook/route.ts` processes signed `meeting.participant_joined` / `meeting.participant_left` event payloads; `app/api/zoom/overview/route.ts` reads stored sessions from Supabase. | F08–F10 can demonstrate participant events, **but this does not prove this REST OAuth scope is needed**. | Treat as candidate for removal after confirming no other code path or Zoom product feature depends on scope. | SCOPE JUSTIFICATION PENDING |

### Scope decision before submission

- Keep the seven scopes with directly identified REST API calls, subject to real reviewer-accessible functional tests and Zoom scope entitlement verification.
- Investigate and, if genuinely unused, **remove `meeting:read:participant` from Production requested scopes**; do not claim event webhook handling alone demonstrates its necessity. Recheck any resulting authorization/consent URL and test-host authorization after scope changes.
- The `meeting:read:meeting` and recording scopes above use the explicit endpoints identified in code. Zoom's final scope/API mapping must be confirmed against a successful live response; if Zoom rejects any call with missing authorization, adjust only to the documented minimum scope.
- The Zoom webhook currently supports URL validation, signed meeting and recording events. Verify event subscriptions and the secret-token setup independently; Zoom's prior dashboard showed **event subscription revalidation failure**. This is a separate blocker, not an OAuth scope test.
- The User-managed Education age-gate decision and verified developer-domain email remain separate outstanding Marketplace feedback items.

### Evidence worksheet for each test

Record **test ID, UTC timestamp, portal account role, disposable Zoom host account (redacted), Zoom meeting ID (redacted), API operation, PASS/FAIL/BLOCKED, expected vs actual outcome, and screenshot/log reference**. Do not paste passwords, secrets, OAuth tokens, ZAK, attendee personal data, or real students' details.

### Pre-submission gates

1. Prepare separate reviewer-accessible adult Admin, Trainer, Parent and learner profiles, with only synthetic student data; deliver credentials and 2FA/OTP arrangements privately through Zoom.
2. Confirm connected test Zoom host and record the host's license/recording eligibility; current freshly rebuilt Production DB had **zero connected hosts** at latest check.
3. Run F01–F15 on Production or reviewer-reachable Beta with correct matching Zoom credentials. Mark tests blocked where feature/license is unavailable; never assert PASS from code inspection.
4. Verify Zoom webhook endpoint URL revalidation and meeting event delivery if participant presence/recordings are part of reviewer test.
5. After removing any truly unused requested scopes, regenerate/reconfirm the Zoom authorization URL, reauthorize disposable host, and repeat impacted tests.
6. Do not submit until the scope matrix contains actual test outcomes and reviewer setup instructions are repeatable.

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
