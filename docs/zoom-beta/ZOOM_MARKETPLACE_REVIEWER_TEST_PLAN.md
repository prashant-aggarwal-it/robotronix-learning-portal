# Robotronix Classroom — Zoom Marketplace Reviewer Test Plan
Updated: 1 November 2026 | Status: **Ready for reviewer rehearsal, NOT yet certified for submission**

App: Robotronix Classroom, integrated with Robotronix Learning Portal
Portal: https://portal.robotronixstemlab.com
Support: https://portal.robotronixstemlab.com/support
Guide: https://portal.robotronixstemlab.com/zoom-guide

## Important accuracy note
Historical tests are **not** fresh reviewer acceptance results. Earlier HTTP 400 errors for MP4 playback and individual-file deletion were subsequently resolved after Zoom scope changes and host reauthorization. The owner observed successful MP4 playback and a successful deletion response before 1 November 2026. The present production deployment, exact scopes and credentials still require independent retesting.

## 1. Reviewer prerequisites
- A reviewer-accessible deployed build including password sign-in, host Reauthorize, MP4-only recording list and the deauthorization handler.
- Four existing approved portal accounts, each with independently usable unique credentials delivered **only** through Zoom's confidential Test account and credentials field. Do not publish passwords or OTPs in GitHub.
- Disposable records: active trainer, sample learner, sample course/enrollment, upcoming online class, a completed meeting with processed MP4 and **separate disposable recording** for Trash.
- A Zoom user/account permitted to authorize this application, with cloud-recording entitlement for recording tests. Portal credentials and Zoom OAuth credentials are separate.
- Do not supply real children's recordings, guardian contact details or customer billing data.

| Role | Existing login email | Expected access |
|---|---|---|
| Admin | robotronixstemlab+zoomadmin@gmail.com | Zoom host/meeting/recording administration |
| Trainer | robotronixstemlab+zoomtrainer@gmail.com | Assigned class and permitted classroom entry |
| Parent | robotronixstemlab+zoomparent@gmail.com | Only linked learner/class/authorized recordings |
| Student | robotronixstemlab+zoomstudent@gmail.com | Only linked student learning/classroom data |

Actual passwords must be privately set and independently tested by the owner. Email aliases by themselves are not adequate reviewer sign-in instructions.

## Reviewer quick-start — follow these steps in order

**Access and credentials (supplied privately in Zoom Marketplace):**
1. Open https://portal.robotronixstemlab.com/login in a fresh private/incognito browser window.
2. Select **Sign in with password** and enter the reviewer Admin email `robotronixstemlab+zoomadmin@gmail.com` and the corresponding password supplied **privately** to Zoom. No Gmail inbox access should be needed for normal password sign-in.
3. Confirm the Admin dashboard loads. Navigate to **Admin → Zoom** (`/admin/zoom`). If a host is already connected, use the existing disposable reviewer host for meeting/recording cases; if Zoom authorization needs testing, click Connect/Reauthorize and complete Zoom's authorization-code consent with an **eligible Zoom user**. This is a *separate Zoom login*, not one of the four portal passwords.
4. Verify the connected Zoom identity and run the host/meeting tests T02–T04 and T09–T16 below. Use only disposable meetings and recordings. **Never revoke or delete a production host or live class to run a reviewer test.**
5. In separate clean sessions, sign in using the Trainer, Parent and Student emails and their **individual** privately supplied passwords. Run T05–T08 and T17; verify they cannot access Admin Zoom controls or another learner's recordings.
6. Record results for each test (PASS, FAIL or BLOCKED), with date, deployed version and evidence. A BLOCKED test is not a PASS.

**Prerequisites and limitations:** The reviewer needs the four independent portal passwords, a preconfigured sample class/enrollment/linked learner and disposable recording, plus a Zoom user eligible to authorize this app. Zoom cloud-recording tests require a cloud-recording-capable Zoom plan and processed MP4 file. The reviewer must be told separately if Zoom requires a particular approved test account, if 2FA/CAPTCHA is enforced, or if the sample recording is not yet available. Do not bypass authentication or disable protections globally.

**Authorization expected outcome:** An eligible Zoom user completes Zoom consent, returns to the portal and is linked to the correct Zoom host; the portal must not expose access/refresh tokens. Reauthorization of an existing host must use the same Zoom user identity. Denied consent should not create a host or expose tokens.

**Scope-by-scope verification:** Use the scope-to-test matrix in Section 3. Compare every scope against the *actual Production → Scopes* selection before submission. If any scope is optional, test the consent flow once with that permission granted and once denied, and document which features remain usable; do not claim an optional-scope denial test passed unless observed. A scope that is required for a feature may cause that feature to be unavailable when declined; this must be explained rather than treated as a successful operation.

**Multi-user flow:** Admin schedules a disposable class with an authorized Zoom host; assigned Trainer can enter the corresponding classroom; linked Parent and Student can view their own class entry points; unrelated users cannot view the class, recordings or host administration. If the reviewer lacks a linked sample learner, mark this BLOCKED and supply the exact disposable QA enrollment details privately.

**Recording flow:** Complete a disposable meeting, wait for Zoom to process the cloud MP4, refresh the portal library, play and seek as an authorized role, verify unauthorized access is rejected, and send a *different disposable recording file* to Zoom Trash. Confirm the selected file, not the entire meeting's recordings, was affected.

**App removal:** In an authorized disposable Zoom installation, revoke the app and verify the matching host is disabled after the signed `app_deauthorized` notification. If the event is unavailable for this app distribution state, mark T16 BLOCKED and include the reason; do not represent backend unit/structural checks as a successful live uninstall test.

**Security and data handling:** No real children's data, private customer records, Zoom tokens, reviewer passwords or recording bytes should be included in test-plan attachments or screenshots.

## 2. Reviewer steps
For each case enter PASS / FAIL / BLOCKED with screenshot, date, deployed commit and tester.

| ID | Role / route | Test | Expected result | Live status |
|---|---|---|---|---|
| T01 | Admin /login | Sign in with password in clean private session | Admin home opens without owner's mailbox access | Pending |
| T02 | Admin /admin/zoom | Connect an authorized disposable Zoom user using consent | Correct host linked; tokens not shown | Pending |
| T03 | Admin /admin/zoom | Inspect host; sync with Zoom | Host and recording/meeting metadata reconcile | Pending |
| T04 | Admin schedule/class | Provision sample upcoming online class | Exactly one intended meeting; repeat is idempotent | Pending |
| T05 | Trainer /trainer/classes | Sign in, open assigned sample class | Only assigned class, permitted controls | Pending |
| T06 | Trainer classroom | Join/start sample meeting | Authorized Zoom host/classroom entry | Pending |
| T07 | Parent /parent | Join linked learner's scheduled class | No cross-family or Admin access | Pending |
| T08 | Student /student | View linked class and classroom link | Only assigned student data | Pending |
| T09 | Admin /admin/zoom | End disposable meeting, await cloud recording, sync | MP4 visible after provider processing; audio/timeline hidden from portal gallery | Pending |
| T10 | Admin/authorized learner | Open, play and seek disposable MP4 | Secure playback; authorization and byte seeking work | Pending |
| T11 | Unauthorized user | Attempt cross-family recording / host admin API | Denied; media and tokens not revealed | Pending |
| T12 | Admin recording controls | Protect, unprotect, modify retention on sample MP4 | Correct protection and retention behavior | Pending |
| T13 | Admin recording controls | Send separate disposable file to Zoom Trash | Only selected file deleted; response and sync correct | Pending |
| T14 | Admin Zoom host | Reauthorize **same** Zoom user, retry sync | Same host ID/meeting associations preserved | Pending |
| T15 | Admin meeting controls | Update/cancel disposable meeting | Provider and portal reflect intended change | Pending |
| T16 | Zoom Marketplace app management | Revoke disposable app installation; inspect host | Signed app_deauthorized event disables matching host, makes access unusable; other hosts unaffected | Pending |
| T17 | All four roles | Open linked test dashboards after fresh login | Role boundaries maintained, no live customer data | Pending |

T16 can only be certified with an actual Zoom deauthorization notification for a published/external app or a suitably authorized integration test. Zoom may not emit these notifications for private/development app installs. The deauthorization backend has code and structural tests, not live event certification.

## 3. Production OAuth scopes — reconcile against current Zoom portal
The list below is based on prior Marketplace screenshots/discussions, **not** an automatically retrieved current scope list. Verify exact spelling, required/optional selection and user/account permissions in the actual Production → Scopes screen.

| Scope | Reviewer proof |
|---|---|
| `meeting:write:meeting` | T04 create a disposable meeting |
| `meeting:update:meeting` | T15 update meeting metadata |
| `meeting:delete:meeting` | T15 cancel/delete disposable meeting |
| `meeting:read:meeting` | T03 read meeting details |
| `meeting:read:participant` | T05–T09 participant/attendance synchronization |
| `cloud_recording:read:recording` | T09–T10 secure recording metadata/playback |
| `cloud_recording:read:list_recording_files` | T09–T10 locate the meeting's video file and refresh its URL (added after initial playback HTTP 400) |
| `cloud_recording:delete:recording_file` | T13 single-file Zoom Trash |
| `user:read:user` | T02 identity of authorized host |
| `user:read:zak` | T06 authorized Zoom host-start workflow |

This is **10** historically discussed scopes. Remove any not genuinely necessary or not currently granted only after reconciling actual deployed API calls. If a scope is optional, test both consent granted and denied.

## 4. Zoom Marketplace setup / review entry
- OAuth redirect URL: confirm `https://portal.robotronixstemlab.com/api/zoom/oauth/callback` matches the Zoom app configuration and actual `ZOOM_REDIRECT_URI`.
- Meeting event webhook and deauthorization notification URL: `https://portal.robotronixstemlab.com/api/zoom/webhook`. Confirm HTTPS, URL validation, signature secret, enabled events, and separate Marketplace deauthorization notification configuration.
- Public pages: Privacy `/privacy`, Terms `/terms`, Support `/support`, Guide `/zoom-guide`. Confirm public HTTP 200 and links in Zoom listing.
- Provide exact reviewer steps and credentials in confidential fields. Never commit private test passwords, OAuth tokens, Zoom app secrets, or live child media.
- Confirm listing screenshots, branding, domain verification, contact, installation audience, and technical design answers.
- Include actual evidence for any Zoom-requested security scans or documents; do not describe GitHub's static checks as SAST/DAST scanner output.
- After prior Zoom feedback, verify any outstanding Marketplace warnings before submission.

## 5. Evidence log (fill after live rehearsal)
| Test ID | Result | Date + timezone | Deployed commit | Evidence link/reference | Notes |
|---|---|---|---|---|---|
| T01–T17 | Pending | — | — | — | Must be tested; no invented passes |

Historical (not current reviewer evidence):
- Host 1 OAuth authorization and meeting create/join were successfully exercised.
- A disposable MP4 played in the portal after adding list-recording-files scope and renewing consent.
- A disposable Zoom recording deletion returned `{"ok":true,"status":"deleted"}`.
- The code was updated to show MP4 files only and add a Reauthorize action; merged to main on 1 November 2026.
- These results do **not** certify the final deployment, all roles, data privacy, or deauthorization.

## 6. Submission decision
Do not mark the app ready until the owner verifies Production deployment, all reviewer logins, real Zoom permissions and eligible cloud recording, live T01–T17 outcomes, technical and security submission fields, and Zoom Marketplace's actual status. The optional security evidence package for **external beta Authorization URL approval** must not be confused with the standard Marketplace review, which separately checks security and technical design.

Official docs:
- https://developers.zoom.us/docs/distribute/app-review-process/
- https://developers.zoom.us/docs/build-flow/submitting-apps-for-review/
- https://developers.zoom.us/docs/integrations/end-user-auth/
- https://developers.zoom.us/docs/api/webhooks/
