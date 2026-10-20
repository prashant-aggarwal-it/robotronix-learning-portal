# Unified passwordless portal access — setup, security and QA

**Status:** Implemented in source; not end-to-end tested in Supabase DEV/Production. Do not remove existing sign-in routes before approval.

## Supported paths
1. **Admin-approved existing identity:** Admin opens Trainer or manually-created family's Portal Access panel and clicks **Grant portal access**. Backend Admin API checks the target, email, any existing linked identity, role conflicts and duplicate trainer linkage, then provisions/links the Supabase Auth user and stores `portal_access_requests.status='provisioned'` until first sign-in. The Admin can share the regular portal URL; no invitation token is needed.
2. **Google account:** Trainer/Parent uses Continue with Google under the **same approved email**. This requires Supabase Google provider, Google OAuth and identity-linking checks. Verify the returned profile ID matches the Admin-linked record; do **not** assume provider linking works across all email types without DEV tests.
3. **Any approved email (including non-Gmail):** Portal login requests email OTP using `shouldCreateUser:false`; Supabase must already contain the Admin-provisioned account. OTP verification uses Supabase `type:'email'`. No public user may grant themselves the Trainer role.
4. **Existing account compatibility:** The old invited login, linked login, disable/enable and password sign-in remain for migration. The UI offers legacy password in a collapsed section, not as the first option.

## Mandatory Supabase configuration — NOT AUTOMATIC
- Configure **Supabase > Authentication > SMTP Settings** with a working transactional mail provider, sender domain and DKIM/SPF according to provider documentation. Gmail's 534 Application-specific password error was diagnosed previously; never store app passwords in GitHub.
- Configure **Supabase > Authentication > Email Templates > Magic Link** so the intended sign-in email contains an OTP code (template must include the provider's token placeholder `{{ .Token }}`). If using a magic link instead, the UI must be adapted accordingly. The current OTP code UI assumes an actual numeric code appears in the email.
- Set **Authentication > URL Configuration** approved portal origin and OAuth callback URLs. Align Google Cloud OAuth settings and Supabase Google provider credentials.
- Confirm **OTP expiry**, email sending limits, browser redirects and cookies in DEV.
- Never share service-role keys in client-side code or email; admin creates the account server-side with role checks.

## Upgrade
- Fresh DEV installation: canonical 01 schema includes the new `provisioned` access state.
- Existing DEV: use additive `database/01_install/08_PASSWORDLESS_PORTAL_ACCESS.sql` after migrations 04–07.
- Existing Production account migration needs a review of duplicate Auth users and whether Google identity is correctly linked before deployment. No delete/recreate of existing live users.

## Acceptance cases
| ID | Test | Expected |
| --- | --- | --- |
| AUTH-01 | Admin Grant to unlinked test trainer | Portal record linked but shown 'first sign-in pending' |
| AUTH-02 | Trainer Gmail Google OAuth first login | Same user ID, Trainer portal, status Portal-ready |
| AUTH-03 | Approved Outlook/Yahoo email OTP | Sign-in email code delivered, verifies and routes to correct role |
| AUTH-04 | Unknown email tries OTP | No new user created; no role escalation |
| AUTH-05 | Reuse existing trainer identity | No duplicate Auth user or double trainer link |
| AUTH-06 | Duplicate email used by wrong role | Server refuses link |
| AUTH-07 | Admin disables trainer while signed in | Access and restricted RLS data blocked |
| AUTH-08 | Wrong/replayed/expired email code | Authentication denied |
| AUTH-09 | Parent manually attached to multiple learners | Correct parent_students relationship preserved |
| AUTH-10 | Login routes for onboarding families | Self-service family onboarding still works |
| AUTH-11 | Rate limiting and delivery | Email spam/OTP throttling handled without account enumeration |
| AUTH-12 | Existing Production invitations | Old invited trainer still signs in with Google or legacy password |

**Release gate:** All these tests require a connected DEV Supabase and real Google/SMTP setup. They have **not** been executed in this ChatGPT session.
