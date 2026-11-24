# Super Admin final UX & functional closure

Branch: `fix/super-admin-final-ux-functional-audit` (DEV only). No production or Netlify deployment.

## What changed

- Directory is the customer hub. Routine rows show customer name/status/created, not UUID or slug.
- Selected customer panel offers Access & owner, Subscription & modules, Branding. Technical IDs remain under expandable details with copy actions.
- Existing `#customers`, `#subscriptions`, `#branding` and `#directory` deep links are preserved.
- Customer access handles customer status/owner invitations; platform-wide admin access is separated into System Health > Security & Incidents and uses verified email lookup and explicit confirmation.
- Branding Studio and branding entitlements now receive the selected customer.
- Onboarding clarifies email delivery, groups owner fields, and puts the workspace slug under Advanced settings.
- Subscription management adds validated paid plan entry, explicit no-charge language, and maintains success feedback when refreshing.
- Consistent follow-up buttons, responsive layout and visible focus states.

## Functional acceptance (requires authenticated local browser; CI cannot certify external delivery)

1. Search an active customer in Customers. View it, verify name and status; expand Technical details and test both copy buttons.
2. Access & owner: rename DEV test customer; refresh; verify new name; create/rotate/revoke a DEV-only invitation and confirm server-side status.
3. Subscription & modules: verify selected customer; extend a synthetic DEV trial; confirm summary and event history update. Test invalid plan and invalid date rejection. Do not activate real paid customers as a test.
4. Branding: verify the same selected academy in entitlement control and Studio; change theme on an isolated DEV academy; confirm saved values and access restrictions.
5. New Customer: create a disposable DEV academy with test owner email, verify invitation status, rotate/revoke; never assume provider acceptance is inbox delivery.
6. Security > platform administrators: look up existing verified DEV-only user; test grant/revoke only with a safe dedicated test account; verify last-admin guard.
7. Use browser Back/Forward, mobile width, refresh, and every "Manage" button from Overview/Directory.
8. Unauthorized and non-platform-admin callers must receive 401/403; never expose service role credentials.
9. Check worker scheduler, email provider delivery, backup/restore independently before PROD readiness.

## Limits

CI checks implementation contracts, TypeScript and production build. Authenticated browser acceptance, real external email delivery and backup restore are separate operational checks. These changes do not touch production or apply new database migrations.
