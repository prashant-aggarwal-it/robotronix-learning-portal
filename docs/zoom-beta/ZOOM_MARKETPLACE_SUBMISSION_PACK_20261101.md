# Robotronix Classroom — Zoom Marketplace Submission Pack
Date: 1 November 2026 | Draft; **not an approval certificate**

## App listing draft
**App name:** Robotronix Classroom

**Short description:** Connect authorized Zoom hosts to Robotronix Learning Portal to schedule online robotics and coding classes, manage class meetings and provide role-controlled access to permitted recordings.

**Long description:**
Robotronix Classroom adds Zoom-powered meeting management to the Robotronix Learning Portal. Authorized administrators connect the Zoom host accounts used for scheduled classes. The portal creates and maintains class and general meetings, lets trainers and enrolled learners access their assigned classrooms, and synchronizes meeting and attendance information. Eligible host accounts can enable cloud recording. Authorized staff can review processed video files, apply recording protection and retention settings, and delete selected disposable or permitted recording files. Parents and students see only learning records and class resources their portal roles are allowed to access. Connecting a Zoom account is an administrator operation, not a requirement for parents or learners.

**Target audience:** Robotronix authorized administrators and affiliated trainers using the organization's online STEM education portal. The public/unlisted distribution choice requires owner confirmation.

**Support email:** Use the verified contact displayed on https://portal.robotronixstemlab.com/support; confirm it is monitored.

**Links:**
- Application: https://portal.robotronixstemlab.com
- OAuth entry: https://portal.robotronixstemlab.com/zoom/connect
- Admin integration: https://portal.robotronixstemlab.com/admin/zoom (requires Admin login)
- Terms: https://portal.robotronixstemlab.com/terms
- Privacy: https://portal.robotronixstemlab.com/privacy
- Documentation: https://portal.robotronixstemlab.com/zoom-guide
- Support: https://portal.robotronixstemlab.com/support

## Technical design — draft for form adaptation
- **Frontend:** Next.js web application hosted on Netlify. HTTPS browser sessions authenticate users; the UI is role-gated and backed by server-side authorization.
- **Identity/data:** Supabase Auth and PostgreSQL; roles Admin/Trainer/Parent/Student. Supabase database policies and service-side auth checks enforce access controls.
- **Zoom authorization:** Admin initiates an authorization-code OAuth flow. A signed short-lived state value binds the portal administrator and host intention. Callback exchanges code server-side, verifies Zoom user identity and stores access/refresh tokens encrypted in PostgreSQL. Reauthorization requires the **same Zoom user identity** for an existing host.
- **Meeting management:** Authorized backend routes create/read/update/delete relevant Zoom meetings; scheduled classroom host assignment is restricted by portal role and scheduling rules.
- **Recordings:** Zoom cloud recording files remain with Zoom; the portal stores metadata and streams permitted video through an authorized backend. The admin recording library filters out audio/timeline files without deleting them from Zoom.
- **Webhook:** `/api/zoom/webhook` accepts Zoom URL validation and signed notifications. The signature is HMAC-SHA256 over `v0:{timestamp}:{raw-body}`, checked with the configured webhook secret and a five-minute time window; event-processing records help avoid duplicate meeting event handling.
- **Uninstall/deauthorization:** When a verified `app_deauthorized` event is received, the backend checks the Zoom app client, user ID and account ID, disables only matching Zoom host identities, expires their credentials and replaces encrypted tokens with empty encrypted values. This prevents subsequent active Zoom API access via that host. Retention/deletion of historical operational records must be reconciled with Zoom's data-deletion requirements and the actual retention policy before external release.
- **Logging:** Operational error reports are intended to be sanitized; no secrets or media bytes belong in logs.
- **Deployment and releases:** GitHub Actions typecheck, structural regression, scheduling tests, production build and security audit checks. Do not claim these equal independent SAST, DAST or penetration-test reports.

## Scope justification (verify actual Production selection)
| Scope | Reason |
|---|---|
| `meeting:write:meeting` | Create classroom or staff meeting under authorized host |
| `meeting:read:meeting` | Retrieve existing meeting details/status |
| `meeting:update:meeting` | Keep existing meeting consistent with an authorized schedule change |
| `meeting:delete:meeting` | Cancel/deallocate a scheduled Zoom meeting |
| `meeting:read:participant` | Retrieve Zoom participation data for authorized attendance/workflows |
| `user:read:user` | Verify Zoom OAuth host identity |
| `user:read:zak` | Authorized host start/join workflow |
| `cloud_recording:read:recording` | Read processed recording metadata |
| `cloud_recording:read:list_recording_files` | Resolve correct meeting instance recording files for authorized playback |
| `cloud_recording:delete:recording_file` | Move a selected authorized recording file to Zoom Trash |

These are draft explanations, not evidence of current scope grants. Verify each in the Zoom Production scope screen and against the current code.

## Reviewer's confidential handoff (enter directly in Zoom submission)
- Admin, Trainer, Parent and Student account emails and unique passwords: see `REVIEWER_PORTAL_LOGIN_HANDOFF.md`. **Never put passwords in this packet, GitHub or chat.**
- Provide sample training class, non-identifying learner label, expected exact date/time and timezone, authorized Zoom host and disposable recording IDs.
- If Zoom Marketplace reviewers cannot supply a cloud-recording-capable Zoom license or they need controlled OAuth access, clarify the supported testing arrangement through Zoom's confidential review communication.
- Include `ZOOM_MARKETPLACE_REVIEWER_TEST_PLAN.md` as downloadable reviewer instructions.
- Explain that the host connection screen is restricted to adult administrators; parent/student accounts are for classroom participation and permissions testing.

## Zoom review-note responses — ready to paste after checking exact reviewer wording

### Education: User vs Admin App
Robotronix Classroom is an educational Zoom integration for online STEM, robotics and coding lessons in the Robotronix Learning Portal. The Zoom integration is **user-managed** because designated adult Robotronix administrators authorize individual eligible Zoom host users to operate class meetings. Administrators connect and manage hosts, meetings and authorized recordings; trainers access assigned classrooms; parents and students use only the permitted meeting entry points for their linked classes. Parents and students do **not** install or authorize the Zoom application. Authorization is limited to an approved administrator and a Zoom user permitted to consent. The integration does not rely on account-wide Zoom installation. Public authorization entry: https://portal.robotronixstemlab.com/zoom/connect. End-user guide: https://portal.robotronixstemlab.com/zoom-guide.

**Review caution:** Confirm this directly addresses the exact Zoom reviewer note; if Zoom asks whether account-wide admin installation is required, explain the host-account permissions and any Zoom tenant admin preapproval restrictions accurately. Do not claim any Zoom user can authorize if Zoom policy restricts it.

### App Authorization Method
Robotronix Classroom uses Zoom OAuth 2.0 **authorization code**. An approved adult portal administrator signs in, visits https://portal.robotronixstemlab.com/zoom/connect, confirms eligibility and continues to /admin/zoom, then chooses Connect Host. The server initiates the Zoom consent flow with signed state. After the eligible Zoom user approves the scopes, Zoom redirects to https://portal.robotronixstemlab.com/api/zoom/oauth/callback with a code and state. The backend verifies signed state, exchanges the code server-side, requests /users/me to identify the authorized Zoom user, and encrypts access/refresh tokens before saving the host association. Existing host reauthorization requires the **same Zoom user ID**; a different user is rejected. Only authorized server routes use tokens to manage meetings and recordings. Revocation through Zoom's installed-app management disables the integration for that host; a signed app_deauthorized webhook handler has been implemented in the pending PR and requires deployment and live verification before representing it as operational in Production.

**Review caution:** Verify exact Production scopes, OAuth redirect URL, webhook configuration and live deployment before pasting any implementation claims as completed. Do not provide OAuth client secret, access tokens or reviewer passwords in public notes.

## Final response to exact Zoom review feedback (28–29 October 2026)

**Important:** Zoom's current **App Authorization Method** is incorrectly set to **From Marketplace**. A repository change cannot update this Marketplace configuration. The owner MUST change Production → **App Listing / Adding your app** to **From your site** and set the **Direct Landing URL** to `https://portal.robotronixstemlab.com/zoom/connect`. Save the setting; do not submit before it is done. Do not confuse this landing URL with the OAuth callback (`/api/zoom/oauth/callback`). The existing login page accepts `?next=%2Fzoom%2Fconnect` and returns authorized Admin users to the Zoom landing page after password login.

### 1. Developer Contact Requirements — owner has updated
Owner screenshot shows developer name and corporate email `info@robotronixstemlab.com`. Owner must ensure saved and mailbox monitored. Acknowledgement is not Zoom approval.

### 2. Test Plan Requirements — paste into reviewer release notes after deployment
Complete reviewer test plan (public, no passwords): https://portal.robotronixstemlab.com/zoom-review-plan

The plan documents the portal Admin, Trainer, Parent and Student roles, private password sign-in, Zoom authorization steps, the 10 historically requested Zoom scopes with expected outcomes, 17 role-based functional cases, cross-user access controls, disposable sample meetings/recordings, cloud recording prerequisites, 2FA restrictions and deauthorization limitations. Portal passwords must be delivered to Zoom in an approved confidential review channel, not in GitHub or public documentation. The reviewer plan URL must return HTTP 200 in Production after explicit owner-approved deployment. Check actual Production scopes and provide seeded disposable class and recording details before submission.

### 3. Documentation URL — field value
https://portal.robotronixstemlab.com/zoom-guide

The guide covers: app installation and eligible adult administrator authorization, trainer/parent/student use, Zoom host and cloud recording prerequisites, troubleshooting, removal via Zoom Marketplace → Manage → Added Apps → Remove, effects of revocation and retention/data requests. Owner must confirm URL is publicly reachable and reflects latest branch deployment.

### 4. Education: User vs Admin App — reviewer reply
Robotronix Classroom is an education integration, but the Zoom OAuth connection is **restricted to approved adult Robotronix administrators**, not children or parents. The application is user-managed because each designated administrator connects a specific authorized Zoom host identity for scheduled classes; trainers and linked families use permitted class entry points without installing or authorizing the Zoom app. The authorization entry `https://portal.robotronixstemlab.com/zoom/connect` requires an authenticated active Admin portal role and a confirmation that the administrator is at least 18 and authorized to connect the Zoom host. Signed-out users are directed to the portal login; non-Admin accounts are blocked from the Zoom connection page and the server's Zoom connect endpoint requires Admin authentication. The integration is not a self-service authorization path for student or parent accounts. We retain the user-managed design for individual authorized host accounts rather than account-wide school installation.

**Caution:** The implemented age control is an **adult administrator confirmation plus role restriction**, not independent proof of age. Do not claim DOB or government-ID verification. If Zoom requires stronger age verification, obtain and implement the specific requirement before resubmission.

### 5. App Authorization Method — reviewer reply
We have changed the intended authorization flow to **From your site** (Marketplace setting must be saved by owner). Direct Landing URL: `https://portal.robotronixstemlab.com/zoom/connect`. Visitors who are not logged in are directed to `/login?next=%2Fzoom%2Fconnect`. Following successful Admin sign-in, they return to the Zoom landing page. Non-Admin roles cannot authorize. The adult Admin confirms eligibility and enters `/admin/zoom`, selects Connect Host, then reviews Zoom OAuth consent. Zoom redirects to `https://portal.robotronixstemlab.com/api/zoom/oauth/callback`, where signed state is verified, code exchanged server-side, Zoom user identity confirmed, and encrypted host tokens saved. Reauthorization requires the same Zoom user identity.

**Caution:** Do not tell Zoom this Marketplace setting has already been changed until the owner actually saves it. A reviewer must be able to access the landing page without being signed in and see a clear sign-in route.

### Owner's remaining steps after deployment approval
1. Change **From Marketplace → From your site**, Direct Landing URL `https://portal.robotronixstemlab.com/zoom/connect`, in Production app configuration.
2. Confirm Production Documentation URL `https://portal.robotronixstemlab.com/zoom-guide`; add reviewer test-plan URL to Release Notes/review response.
3. Rotate the previously disclosed shared reviewer password; set four strong unique passwords and test each account independently. Deliver credentials through a confirmed private Zoom reviewer channel.
4. Verify the actual Zoom Production scopes, OAuth callback, webhook/deauthorization endpoint and permission settings.
5. Confirm disposable QA data, paid Zoom cloud recording eligibility, and tests T01–T17. Do not claim unobserved tests passed.
6. Confirm PR branch deployment **only after explicit approval**; verify public URLs and smoke-test Zoom.
7. Respond to five review notes and resubmit updates when everything above is complete.

## Owner-only Production and Marketplace checks
- [ ] Screenshot current Marketplace submission warnings and Production Scopes.
- [ ] Confirm Production OAuth Redirect URL and allowed domain; verify ownership and HTTPS.
- [ ] Confirm deauthorization notification URL is `https://portal.robotronixstemlab.com/api/zoom/webhook` and supported notifications are enabled.
- [ ] Confirm `ZOOM_WEBHOOK_SECRET_TOKEN` / OAuth environment values are configured in the current deployed Netlify environment (do not share secret values).
- [ ] Confirm current production deploy includes this PR's backend after explicit merge/deployment approval.
- [ ] Sign in with four reviewer accounts independently, set private passwords if needed and verify each role's sample data.
- [ ] Test app disconnect/revoke against a *disposable* Zoom account and confirm the same-account Reauthorize flow.
- [ ] Verify Zoom-related user data deletion obligations and associated data-retention rules with policy/legal owner.
- [ ] Verify public Privacy/Terms/Support/Guide pages and that the support inbox receives mail.
- [ ] Complete marketplace title, icons, listing screenshots, category, description, privacy, support and technical design answers.
- [ ] Record PASS/FAIL/BLOCKED evidence for every test in reviewer plan.
- [ ] Upload genuine scanner-generated SAST/DAST outputs *only if* required for selected approval path. Do not invent scan outcomes.

## Reviewer release note draft
> Robotronix Classroom allows authorized Robotronix administrators to connect eligible Zoom hosts and manage educational meetings and permitted recordings from the Learning Portal. Reviewers can test an administrator's Zoom OAuth consent and meeting management, then use separately provided Trainer, Parent, and Student portal accounts to check classroom entry and role-based access restrictions. MP4 recording playback, recording protection/retention, single-file trash and host reauthorization have been implemented. Recording tests require a Zoom host with cloud recording enabled. Please use only the supplied disposable test data. Detailed test steps and credential instructions are provided separately in the confidential reviewer handoff.

## Source requirements
- https://developers.zoom.us/docs/distribute/app-review-process/
- https://developers.zoom.us/docs/build-flow/submitting-apps-for-review/
- https://developers.zoom.us/docs/integrations/end-user-auth/
- https://developers.zoom.us/docs/api/webhooks/
- https://developers.zoom.us/docs/api/marketplace/events/

## Final disclaimer
No external app-submission status, live OAuth scope grant, live deauthorization notification, owner test-account password, or final Zoom approval is established by repository evidence. Do not click Submit until owner-only gates are completed.
