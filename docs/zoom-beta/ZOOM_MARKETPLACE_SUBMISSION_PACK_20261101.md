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
