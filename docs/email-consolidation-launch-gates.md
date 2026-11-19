# Academy email consolidation — development status and launch gates

Implemented: platform-only SMTP invitations; academy-specific Google OAuth/Gmail API, SMTP, and Microsoft OAuth/Graph adapters; encrypted provider credentials; tenant owner/admin provider management; opt-in event preferences; queue, retry, lease recovery, manual retry, delivery history; member invitation queuing when the academy has opted in; invitation acceptance page; guarded GitHub Actions worker scheduler.

Configuration required on deployment: ACADEMY_EMAIL_ENCRYPTION_KEY (persistent 32-byte base64), ACADEMY_NOTIFICATION_WORKER_SECRET (32+ chars), ACADEMY_INVITATION_APP_ORIGIN (canonical HTTPS origin), ACADEMY_NOTIFICATION_WORKER_URL GitHub Actions secret (HTTPS URL ending /api/internal/academy-notifications/process), Google OAuth client/secret/redirect, Microsoft Entra client/secret/redirect, and tenant SMTP credentials as applicable. Scheduled GitHub Actions workflows run from the default branch only, after deployment and secrets setup. No automatic email delivery should occur in DEV without explicit opt-in and credentials.

NOT COMPLETE: The full enrollment, class, fee, trainer and progress event sources have not been safely wired. DEV academy enrollment links are tenant-scoped but their recipient relationships are in legacy public tables and need an audited, tenant-safe mapping before automated mail is enabled. A scheduled worker also needs deployment, secrets and live operational verification. Provider consent, token revocation, SMTP deliverability, suppression, bounce handling, and end-to-end certification remain launch gates. Do not claim all email requirements completed or activate PROD.

Invitation email behavior: a member invitation is created regardless of delivery. When academy email is enabled, the route queues an invitation email with a one-time token link to /accept-invitation. The response retains the manual token fallback for delivery failures; this token is sensitive and must be shared securely.

No production database changes or Netlify deployments were made.
