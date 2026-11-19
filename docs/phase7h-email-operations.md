# Phase 7H — Email operations development

Implemented in DEV: notification settings page at /[academySlug]/manage/email/notifications, tenant-scoped recent delivery history (metadata only, no message bodies), failed-job manual retry with academy owner/admin authorization, and SQL lease recovery for abandoned sending jobs (15-minute lease, maximum five attempts). Email settings page links to operations.

The queue remains opt-in and disabled by default. Provider connection must be verified before enabling; retries revalidate the chosen provider and event preferences. The worker endpoint remains protected by ACADEMY_NOTIFICATION_WORKER_SECRET and requires a separately configured trusted scheduler.

Outstanding before claiming completion or deploying to PROD:
- Wire actual enrollment, class, fee, trainer, progress and invitation domain events to queueAcademyNotification with recipient authorization and stable event-specific idempotency keys.
- Configure a reliable scheduler with monitoring and secret management.
- Verify recovery, race conditions, cross-tenant isolation, provider acceptance and uncertain-delivery duplicates; a provider can accept a message before the database marks it sent.
- Complete Google, SMTP and Microsoft live authorization and delivery tests, CI/typecheck and UX checks.
- Define retention, suppression, consent and opt-out policy before live use.

No PROD migration or Netlify deployment. User explicitly deferred testing, so do not claim certification.
