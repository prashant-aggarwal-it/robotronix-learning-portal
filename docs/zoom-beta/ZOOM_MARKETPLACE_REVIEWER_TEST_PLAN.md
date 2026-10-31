# Robotronix Classroom — Zoom Marketplace Reviewer Test Plan
**Language:** English  
**Application:** Robotronix Classroom (Robotronix Learning Portal)  
**Review note:** Zoom Marketplace Admin, 28 October 2026 — Test Plan Requirements  
**Reviewer portal:** https://portal.robotronixstemlab.com  
**Document status:** Submission candidate — scope list and live recording flows must be reconciled and verified before final upload.

## 1. Purpose and prerequisites
Robotronix Classroom connects a Zoom host account to a learning operations portal so a trainer can conduct scheduled online classes and authorized parents/learners can join. Admins configure Zoom hosts, classes, recordings and applicable retention controls.

Use Chrome or Edge with third-party cookie/pop-up behavior compatible with Zoom authorization. The reviewer needs internet access to the portal and ability to complete the portal login flow. Do not use real student data. All test data below should be disposable.

**Zoom requirement:** To exercise cloud recording operations, the connected Zoom host must have cloud recording enabled and a plan/license that supports it. If the review account lacks this entitlement, arrange a Zoom-approved reviewer testing path and note which cases cannot be run; never present an untested recording scenario as passed. If 2FA or SSO is required, provide a reviewer-usable approved login process through the confidential review channel (do not disable security silently).

**OAuth roles:** Only an authorized portal Admin should perform host connection. The reviewer may use their own Zoom account to grant scopes as permitted by the app's install model and Zoom's review process. **Portal test accounts are distinct from Zoom account credentials.**

## 2. Application reviewer identities
The following four accounts were confirmed present in **Production Supabase Auth** on 31 October 2026 with active roles and past sign-ins (verification of live login and all related seed records still required):

| Role | Portal login email | Purpose |
| --- | --- | --- |
| Admin | robotronixstemlab+zoomadmin@gmail.com | Zoom host connection, host management, class and recording administration |
| Trainer | robotronixstemlab+zoomtrainer@gmail.com | Scheduled class actions, host/meeting entry |
| Parent | robotronixstemlab+zoomparent@gmail.com | View learner's scheduled class, join classroom, authorized recording access |
| Student | robotronixstemlab+zoomstudent@gmail.com | Student learning view and permitted classroom access |

**Credential delivery:** Add working role-specific sign-in instructions and any required temporary passwords/one-time-code procedures in Zoom Marketplace's secure **Test account and credentials** field. Do not publish passwords, OTPs, recovery codes, Zoom credentials, or access tokens in this document or GitHub. Gmail plus aliases deliver email to the same base inbox; that **does not independently give a reviewer access to each inbox or OTP**. If email sign-in requires the operator's mailbox, arrange independently accessible reviewer accounts or a supported approved reviewer authentication path.

## 3. Reviewer-ready seed data checklist
Before submission, confirm the following **in the reviewer-accessible deployment**:
- [ ] Admin, Trainer, Parent and Student log in successfully and reach the correct role dashboard.
- [ ] Trainer is linked to an active trainer record and a test enrollment.
- [ ] Parent is linked only to the authorized sample learner; Student account is linked to the intended learner.
- [ ] Sample learner, course, enrollment, active trainer assignment and upcoming scheduled online class are visible to applicable test users.
- [ ] One connected eligible Zoom host and, if multi-host testing is requested, a second independently authorized Zoom host.
- [ ] At least one disposable **completed** Zoom meeting with a fully processed cloud recording for playback checks.
- [ ] A second disposable recording for testing Zoom Trash, if the scope supports deletion.
- [ ] All sample data and access are non-sensitive; tests cannot impact real student recordings.

**Record actual sample identifiers privately** in the secure reviewer instructions: learner display label, class date/time with timezone, course, meeting and recording identifiers as appropriate. Do not invent class times or present historic classes as upcoming.

## 4. End-to-end reviewer walkthrough

| ID | Role and location | Reviewer action | Expected result |
| --- | --- | --- | --- |
| T01 | Admin — `/login` | Sign in with designated Admin account. | Admin dashboard loads; Zoom host configuration is available. |
| T02 | Admin — `/admin/zoom` | Select the host connection/authorization action; complete Zoom OAuth consent for a permitted reviewer Zoom user. | Zoom consent shows the app identity and requested scopes; redirect returns to portal, displaying a connected Zoom host without exposing access tokens. |
| T03 | Admin — `/admin/zoom` | Inspect host status and account details, then trigger supported host synchronization. | Host reports connected/enabled and authorized account identity; sync succeeds or reports a sanitized actionable error. |
| T04 | Admin — scheduling/class flow | Open the supplied sample online class; use the supported action to provision/create its Zoom meeting. | Exactly one meeting is created for the intended class, with correct host and meeting reference; repeat action does not unintentionally create duplicate meetings. |
| T05 | Trainer — `/trainer/classes` | Sign in independently and open the assigned test class. | Trainer sees the assigned class and permitted Zoom actions, but cannot manage arbitrary hosts or unrelated learners. |
| T06 | Trainer — class/classroom | Start/join the permitted meeting using the in-portal workflow. | Authorized trainer enters the correct Zoom classroom. If a Zoom meeting SDK is used, browser permissions/SDK initialization behave correctly. |
| T07 | Parent — parent dashboard | Sign in, open the linked learner, and join the assigned online lesson. | Parent sees the correct learner and class and joins through the permitted path without admin access. |
| T08 | Student — student dashboard | Sign in and open the linked learner's scheduled session. | Student sees only permitted learning/class access. |
| T09 | Zoom host/Admin — completed test class | End the disposable meeting and allow Zoom to process its cloud recording; use portal Zoom sync/reconciliation. | Meeting/recording metadata is visible to the authorized admin after provider processing; there is no claim of instantaneous availability. |
| T10 | Admin / permitted Parent | Open the disposable recording using the secure portal player; seek and play beyond initial access lifetime. | Browser receives video (rather than a login HTML/JSON error); seek and renewed playback authorization work and access is role-restricted. |
| T11 | Unauthorized account | Attempt to reach a different family's class/recording or protected admin view. | Access denied without disclosing recording media or tokens. |
| T12 | Admin — recording controls | Protect and unprotect a disposable recording, then inspect displayed retention fields. | Intended protections/metadata change as supported; protected recordings are not eligible for scheduled deletion. |
| T13 | Admin — disposable recording only | Move a separate test recording to Zoom Trash through the portal, then synchronize. | Zoom Trash operation returns a valid provider response and the portal marks only the intended recording deleted. Never test this using customer media. |
| T14 | Admin — OAuth/session | Reconnect/re-authorize host if required and repeat a permitted API operation. | Refreshed authorization permits meeting operations; failure is presented clearly rather than exposing secrets. |
| T15 | Admin — optional multi-host | Where a second licensed Zoom account has been prepared, connect Host 2 and schedule non-overlapping authorized class meetings. | Host assignments remain distinct; no cross-host credential leakage or accidental overlapping host allocation. |
| T16 | Admin/Zoom user — deauthorization | If this app version supports a disconnect or Zoom-side revoke flow, revoke test authorization and inspect portal status. | App no longer uses revoked credentials; reconnection requires new authorization. Confirm exact UI procedure against deployed implementation before submission. |

**Portal route references:** `/admin/zoom`, `/admin/zoom-test`, `/trainer/classes`, `/trainer/demos`, and `/classroom/[scheduleEventId]` are recorded in the repository's integration guide. Other steps deliberately refer to in-app actions until the actual reviewer-facing labels and setup data have been checked on the deployed build.

## 5. Mandatory **scope-by-scope** mapping — must reconcile against Zoom Marketplace
**Do not submit this section without completing it.** The GitHub repository does **not** establish which exact OAuth scopes (including optional scopes) are currently selected in Zoom Marketplace. Copy *every exact scope string* from the app's **Scopes** screen into the table below, one row per scope, then pair it with its corresponding Zoom API call and the test above. Mark any optional scope explicitly; if an unused scope cannot be justified, remove it from the Marketplace request and confirm the app continues to function.

| Exact requested Zoom scope | Required or optional | Zoom API/data accessed | Reviewer test ID and exact UI action | Expected result | Live result |
| --- | --- | --- | --- | --- | --- |
| **[COPY FROM MARKETPLACE]** | [Required/Optional] | Host identity/profile access | T02–T03; verify Zoom account connection | Identity belongs to the authorized Zoom host | Not yet recorded |
| **[COPY FROM MARKETPLACE]** | [Required/Optional] | Meeting create/update/read/list, as actually requested | T04–T08 | Meeting lifecycle and correct permissions | Not yet recorded |
| **[COPY FROM MARKETPLACE]** | [Required/Optional] | Cloud recording list/read/download, as actually requested | T09–T12 | Only authorized recording metadata/media available | Not yet recorded |
| **[COPY FROM MARKETPLACE]** | [Required/Optional] | Recording deletion/trash, if requested | T13 | Only disposable recording moved to Trash | Not yet recorded |
| **[COPY FROM MARKETPLACE]** | [Required/Optional] | Participant/report/meeting access, if requested | T05–T09 | Authorized class attendance and reconciliation | Not yet recorded |
| **[COPY FROM MARKETPLACE]** | [Required/Optional] | Other requested/optional Zoom scopes | [add matching test] | [specify] | Not yet recorded |

For every scope, include its exact name and a screenshot of the Zoom consent screen if helpful. If Zoom Marketplace shows a separate **optional scope** choice, document both the granted and declined paths and verify fallback behavior.

## 6. Evidence and current results
**Previously executed by the owner:** four distinct portal-role logins, Zoom Host 1 connection, meeting creation. These are historical results, not a fresh reviewer-ready certification of the latest deployment.

**Code updated but live retest outstanding:** recording playback, cloud recording deletion/trash, token-refresh coordination, recording sync, post-deletion portal consistency. A successful GitHub build does not mean provider operations are validated.

**Submission evidence to attach:** screenshots showing logged-in role landing screens (redact personal learner data), connected host, created test meeting, secure recording player, appropriate access denial, Zoom scope inventory, and test result date/deployed commit. A short narrated walkthrough can help but does not replace clear steps.

## 7. Final release gates and reviewer notes
- [ ] Confirm deployed commit and production DB migration compatibility (Zoom OAuth refresh leases and operational alerting).
- [ ] Confirm expected Netlify and Supabase configuration; do not display secret values.
- [ ] Verify all four reviewer accounts can authenticate **without assistance or access to the owner's personal mailbox**.
- [ ] Verify preloaded classes and disposable recordings are available to reviewer roles.
- [ ] Complete each Marketplace OAuth scope and optional-scope mapping with accurate test steps.
- [ ] Run T01–T16 as applicable and record PASS/FAIL/BLOCKED with evidence and date.
- [ ] Confirm any paid-plan/2FA/SAML/SSO prerequisites in the secure submission notes.
- [ ] Recheck public privacy-policy URL and security-evidence readiness separately.
- [ ] Provide this document's accessible link in **Zoom App Submission → Release Notes** and confidential credentials in **Test account and credentials**, as Zoom instructs.

**Provider guidance:**
- https://developers.zoom.us/blog/marketplace-app-test-plan/
- https://developers.zoom.us/docs/distribute/app-submission/common-rejection-issues/
- https://developers.zoom.us/docs/build-flow/submitting-apps-for-review/
