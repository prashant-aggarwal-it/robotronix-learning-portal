# Production Hardening & Experience Upgrade

Branch: `feature/production-hardening-v1`

This file tracks the production issues found during live testing and the implementation status.

## Implemented in this branch

- Zoom live rooms open in a separate tab for Admin classes, general meetings and Trainer demos.
- Ended/cancelled Zoom meetings no longer show an active Start action.
- Zoom account connect now forces an explicit Zoom login, reducing silent reuse of the previously signed-in account when adding another host.
- RoleGuard retries briefly after an external OAuth round-trip so a valid Admin session is not redirected to the public home page during session restoration.
- Secure recording playback now uses a dedicated Robotronix player page.
- Zoom recording download proxy now carries the OAuth token through Zoom's recording download flow.
- Admin `Refresh` on Zoom is replaced by `Sync with Zoom`, backed by a reconciliation endpoint for recent meetings and recording files.
- Demo guest Help/Reschedule requests are linked to learner + demo context.
- Demo requests can be marked resolved.
- Guest requests and demo feedback emit Admin portal notifications.
- Admin Demo Experience refreshes when a new Admin notification arrives and also on browser focus/online recovery.
- Demo guest page refreshed into a premium Robotronix discovery experience with AI/robotics/coding visual language, clearer session hierarchy and auto-refresh around the join window.
- Demo setup form visual styling modernized.
- Release structure checks extended for these hardening changes.

## Confirmed external/setup work still required

### Zoom Production app
1. Keep Production Client ID and Client Secret in Netlify.
2. Keep Production redirect URL:
   `https://portal.robotronixstemlab.com/api/zoom/oauth/callback`
3. Keep Production webhook:
   `https://portal.robotronixstemlab.com/api/zoom/webhook`
4. Event subscription:
   - Start Meeting
   - End Meeting
   - Participant/Host joined meeting
   - Participant/Host left meeting
   - All Recordings have completed
5. Add the Zoom scope required to delete an individual cloud recording file, then re-authorize connected hosts.
6. To add a second independent Zoom account while the app is in Beta Test, ensure that account is permitted as a beta/test user (or move the app to the appropriate distribution state). Re-authorize through Robotronix after changing eligibility.

## Database
No new database migration is required for the changes implemented above. Existing Demo Experience and Zoom Classroom migrations already contain the request status/resolved timestamp, recording protection/retention fields and notification tables used here.

## Still pending in the next implementation passes

- Verify Protect / Unprotect and +60-day retention controls end-to-end.
- Add automatic recording-retention cleanup (not just a displayed retain-until date).
- Complete second Zoom host onboarding and concurrent-host allocation production test.
- Test secure recording playback after the production branch is deployed.
- Test Delete after the required Zoom recording-delete scope is added and hosts are re-authorized.
- Test complete real class flow: schedule → trainer start → learner join → meeting end → recording → access control.
- Continue portal-wide live-data rollout: schedule/classes, onboarding queues, selected progress/attendance views and external-provider reconciliation where appropriate.
- Add Admin demo lifecycle actions: reschedule, cancel, resolve/follow-up, convert/lost.
- Improve demo conversion into onboarding with prefilled lead data.
- Add no-show and group-completion polish.
- Update release/deployment documentation after production validation.
