# Robotronix Classroom — Proposed Zoom Privacy Addendum (for public policy)

**Draft only — not published.** Prepared 2026-10-22 for the existing Robotronix public Privacy Policy at https://www.robotronixstemlab.com/privacy. Obtain owner/legal review against actual live settings, verify the retention cleanup, and publish on the approved site before citing the public page to Zoom. Do not falsely claim complete permanent erasure after 60 days.

## Proposed public-facing text

### Live online classes and Zoom integration

Robotronix Classroom uses Zoom to arrange and deliver online learning sessions. Where a trainer or authorised host connects their Zoom account, our service requests only the Zoom permissions needed for supported classroom operations such as linking a host, scheduling and managing meetings, obtaining meeting status and relevant participation or recording information. The specific scopes requested are displayed during Zoom authorisation.

To provide this service, we may process a connected host's Zoom user and account identifiers, email address, encrypted OAuth access and refresh tokens, meeting identifiers and schedules, participant names and attendance metadata, recording file metadata, and information needed to control access to recordings. We do not sell Zoom user data. We use it to operate classes, administer schedules, support learners and troubleshoot service issues.

Zoom OAuth tokens are stored in an access-controlled backend and encrypted before database storage. They are used on the server for authorised Zoom API requests and are not intentionally shown to parents or students. Zoom itself processes meeting audio, video and cloud recordings under its own privacy and service terms.

### Recordings, access and retention

Classes may be recorded when recording is enabled for the applicable host and session. Recording availability to parents and learners is controlled by class enrolment/permissions and administrator visibility settings. Administrators can manage recording availability, protect specific recordings from automatic cleanup, or extend a retention period when justified.

Our **default retention period for newly processed Zoom cloud recordings is 60 days from the recording's end**, with a recording-start fallback if the end timestamp is unavailable. A different period may apply to a specific host or recording when configured by an authorised administrator. At expiry, our scheduled process ordinarily requests Zoom to move an eligible, unprotected recording file to Zoom Trash and marks it deleted in the Robotronix application. **Moving a file to Zoom Trash is not the same as immediate permanent erasure**; Zoom's own trash, recovery, backup and retention terms may continue to apply. Limited meeting and audit metadata may be retained for legitimate operational, safeguarding or legal reasons. We will respond to applicable access, correction or deletion requests under law and our retention obligations.

### Your choices and requests

Parents/guardians may contact Robotronix about their child's class recording access or request correction/deletion of personal information, subject to applicable legal and legitimate educational recordkeeping requirements. Connected Zoom account holders can revoke the app's Zoom authorisation through their Zoom account; doing so may prevent integration features until reauthorised. Contact Robotronix at info@robotronixstemlab.com for privacy requests.

## Required factual checks before publication

- [ ] Confirm actual Zoom OAuth scopes and purposes against the Production app manifest and implemented API calls.
- [ ] Confirm parent/guardian recording consent and applicable child privacy notice/collection flows; do not imply universal recording consent.
- [ ] Confirm exact host and per-recording default/overrides in production, retention scheduler configuration, and the distinction between trash and permanent deletion.
- [ ] Confirm what metadata remains after deletion, under which lawful/contractual retention, and how data-subject requests are handled.
- [ ] Confirm current privacy contact channel and response procedure.
- [ ] Review the existing public policy for consistency, publish an effective date and the Zoom addendum at a stable public URL, and verify anonymous availability.
- [ ] Update Zoom Marketplace Privacy Policy URL if necessary and attach a dated screenshot of the published page.

## Internal implementation evidence

- Token protection: `lib/server/zoom.ts` (AES-256-GCM)
- Host link: `app/api/zoom/oauth/callback/route.ts`
- Recording metadata: `lib/server/zoom-recording-reconcile.ts`
- Playback restrictions: `app/api/zoom/recordings/[recordingId]/route.ts` and `stream/route.ts`
- Cleanup: `app/api/zoom/retention/route.ts` and `netlify/functions/zoom-retention.mts`
- Approved default and remaining verification gaps: `docs/zoom-beta/RECORDING_RETENTION_VERIFICATION.md`

**Release note:** This document is private working material on the stabilization branch. It does not establish that the public Privacy Policy has been updated or that the retention process is operating correctly in production.
