# Phase 8E — Certification evidence and release decision

## Baseline
- Branch: `feature/education-suite-phase8e-certification`, descendant of 8D.
- Phases 8A, 8B, 8C and 8D: GitHub CI succeeded on respective phase branches as checked on 19 November 2026.
- PROD, Netlify and the main branch unchanged in this phase.

## Evidence gathered
- DEV schema review: RLS enabled on `saas.academy_email_connections`, `academy_email_notification_jobs`, `pending_customer_invitations`, `platform_admin_audit`, `platform_administrators`, and `platform_subscriptions`. Direct SELECT privileges for `anon` and `authenticated` were false on these tables.
- Existing API routes inspected for authorization, response headers and filtering.
- Phase 8E adds repeatable regression checks for privileged admin routes, confirmed session enforcement, absence of credential/message disclosure in email health, bounded administrator lookup, invitation hash/rotation/revocation and confirmation for destructive operations.
- CI runs those tests, TypeScript typechecking and Next.js build. Check the GitHub Actions run for the current head before calling the automated suite green.

## Release acceptance matrix
| Gate | Current decision | Evidence needed |
| --- | --- | --- |
| 8A–8D build | PASS | Individual GitHub Actions runs |
| Platform table RLS and direct grants | PASS (schema check) | DEV SQL metadata inspection |
| Admin route static authorization checks | CI pending | Phase 8E regression run |
| Nonadmin runtime API denial | NOT TESTED | Authenticated nonadmin session must receive 403 |
| Cross-tenant role and object isolation | NOT TESTED | Two different real/synthetic tenant sessions; attempt cross-tenant reads and writes |
| Owner invitation acceptance/resend/revoke | NOT TESTED END-TO-END | Two distinct DEV verified mailboxes and signed-in acceptance |
| Gmail/Microsoft/SMTP deliverability | NOT TESTED LIVE | Provider credentials, actual test send and recipient receipt |
| Subscription trial boundaries | NOT TESTED LIVE | Controlled DEV trial dates and status transitions |
| Responsive and keyboard-only usability | NOT TESTED | Browser viewport and accessibility walkthrough |
| Deployment/PROD operational readiness | OUT OF SCOPE | Separate authorization and deployment decision |

## Decision
**Not release-certified.** Passing source and schema checks is not proof of live multi-tenant isolation, real-world email delivery, or browser-level usability. Do not merge to main or promote to production solely on this document. Complete the remaining acceptance gates with controlled DEV identities and test-provider credentials.
