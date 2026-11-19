# Super Admin operations development

## Phase 8A — Customer directory hub (implemented in feature branch)
- Directory customer drill-down with organization status and identification.
- Contextual links to customer access, subscription, and branding sections.
- Access and subscription editors preselect the chosen customer.
- No database migrations, production access, or Netlify deployment.

## Phase 8B — Customer lifecycle and invitations (next)
- Reliable invited/activated lifecycle from authenticated invitation records and delivery events.
- Resend, revoke, expiry state and clear distinction between queued, sent and delivered.
- Owner email lookup is role-checked; avoid showing invitation secrets by default.

## Phase 8C — Subscriptions and operational overview
- Customer subscription summary with trial expiry, modules and status; dashboard exceptions.
- Efficient paginated API queries rather than per-row network calls.

## Phase 8D — Platform operations and safety
- Internal administrator management with verified-email lookup, audit visibility, confirmation for destructive changes and owner separation.
- System email health and per-tenant delivery health without exposing credentials.

## Phase 8E — Certification
- DEV permission-isolation tests, lifecycle smoke tests, responsive and keyboard usability review.
- Merge/release only after CI and manual acceptance. PROD is out of scope.
