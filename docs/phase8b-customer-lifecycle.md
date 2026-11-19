# Phase 8B — Customer invitation lifecycle

## Implemented
- The onboarding invitation list automatically loads when the Super Admin opens New Customer.
- Invitations show an activation-oriented status: waiting for owner, expired, revoked, activated (when backend reports accepted/activated).
- Email delivery is labelled separately from invitation activation. Provider-accepted is not represented as delivered to the inbox.
- Resend (secure token rotation) and revoke actions guard against concurrent requests. Reload after successful mutation; request failures are visible.
- New customer submission now says 'attempt invitation delivery' rather than promising a sent email.
- Manual recovery link remains opt-in and hidden until explicitly revealed.

## Acceptance and operational caveats
- Live SMTP delivery requires configured platform invitation transport; no SMTP credentials or deployment configuration were added.
- Backend accepts invitations through existing RPCs. The list reflects authoritative invitation status; no synthetic success statuses are written.
- Provider acceptance is not end-user inbox delivery; final delivery/activation must be checked in a real deployment.
- DEV account-to-account isolation and actual acceptance email flow remain manual QA gates.
- No production database or Netlify changes were made.
