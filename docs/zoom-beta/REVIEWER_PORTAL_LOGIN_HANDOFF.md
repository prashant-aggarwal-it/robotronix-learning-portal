# Zoom Marketplace reviewer portal access — secure handoff

## Current state (verified 2026-11-01)
The Production Supabase project already has four **active, email-confirmed** Zoom QA accounts with password credentials present and corresponding active portal profiles. All four have previously signed in. Trainer and student profiles are linked to their respective portal entities. **Do not create duplicate accounts or turn off global email confirmation.**

| Role | Existing reviewer email |
|---|---|
| Admin | robotronixstemlab+zoomadmin@gmail.com |
| Trainer | robotronixstemlab+zoomtrainer@gmail.com |
| Parent | robotronixstemlab+zoomparent@gmail.com |
| Student | robotronixstemlab+zoomstudent@gmail.com |

The aliases deliver email to the same Gmail inbox, but **normal password sign-in does not require mailbox access**. The sign-in page now presents email/password prominently, while Google and email OTP remain available. There is no special reviewer bypass, hardcoded credential or security exception.

## Owner's required actions before submission
1. Verify the deployed site shows **Sign in with password** at `https://portal.robotronixstemlab.com/login`.
2. Privately set a **unique, strong password** for each existing Supabase Auth user using a supported Supabase admin workflow. Do not enter passwords into source code, SQL migrations, issue comments, screenshots, PRs or chat messages. Prefer an authenticated Admin Auth API or Supabase Dashboard. Changing Auth passwords does not require creating new profiles or changing roles.
3. Test each account in a **fresh private browser session**, with no existing Google or OTP session. Verify role-specific landing page and that the Trainer, Parent and Student see only linked QA data. Record pass/fail, not passwords.
4. Check that no login requires an emailed verification challenge, additional MFA or CAPTCHA in the reviewer environment. If MFA is enforced, provide Zoom an approved, independently usable test path; **do not disable MFA globally**.
5. Ensure test classes and recordings contain no real learner data. Confirm the reviewer Admin has only necessary testing access and is monitored; disable reviewer accounts after the review when no longer needed.
6. Provide the four login emails, passwords and any special access instructions **only** in Zoom Marketplace's confidential reviewer-credentials fields. Do not put secrets in this public plan or GitHub.
7. Zoom OAuth authorization is **separate** from Robotronix portal login. Reviewers use their own Zoom account as permitted by Zoom's test process. Cloud-recording tests require appropriate Zoom licensing and permission.

## Acceptance checklist
- [ ] Production deployment of the login UI verified.
- [ ] Four unique reviewer passwords privately set and tested.
- [ ] Independent password login for all four roles verified.
- [ ] Admin/trainer/parent/student permissions and QA data verified.
- [ ] 2FA/CAPTCHA and paid Zoom requirements documented.
- [ ] Credentials entered securely in Zoom submission (never GitHub).
- [ ] Recording playback and delete tested using disposable data.

## Technical notes
- `app/login/page.tsx` uses existing `signIn(email,password)`, which calls `supabase.auth.signInWithPassword`; `getCurrentAccountAccess()` validates the active profile and routes by role.
- The previous UI had a password form hidden under a disclosure, and the email field was outside that form. The new page makes both fields explicit in one form.
- Password hashes are present in Auth, but **the actual passwords cannot and must not be retrieved from the database**.
- No database migration, new authentication service, special API route, or Production data mutation was necessary for the UI improvement.
