# Phase 7A: email-first assisted onboarding

## Current implementation
Super Admin creates a **pending** customer invitation by name, slug, type, module choices and Owner email. The UI never asks for an Auth UUID. Invitations are 256-bit random tokens; database stores SHA-256 only, expires after seven days and holds no active membership. Delivery is **manual secure link sharing**, explicitly not marked as emailed. The invitation can be listed or revoked in the restricted API.

A new or existing user signs in at /customer-invite, verifies the exact invited email address through Supabase Auth, and activates the organization. Acceptance locks the pending invitation record and calls the existing canonical `saas_onboard_organization_v1` to atomically provision Owner membership, trial subscription, enabled modules and CRM/Tasks links. A used, expired or revoked link is rejected.

The existing `/onboarding/organization` self-registration and sign-up flow remains supported and unchanged. Newly created organizations default to Standard branding.

## IMPORTANT limitations
No automatic transactional email delivery is configured. The Super Admin must copy and securely send the link; do not confuse creating an invitation with sending email. Resend/rotation, rate limiting, end-to-end real DEV HTTP acceptance and a polished pending-invitations management UI remain acceptance work.

Neither the invited email address nor organization names should be trusted as credentials. A real verified Supabase session and service-only DB checks are required.

## Deployment
DEV only: apply migrations 79 and 80 after Phase 6F baseline. No PROD, main, or Netlify change.
