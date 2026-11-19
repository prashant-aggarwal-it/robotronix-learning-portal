# Phase 7E — Academy SMTP integration

Implemented: tenant-scoped SMTP credential table (private, RLS, service-role only), encrypted password with ACADEMY_EMAIL_ENCRYPTION_KEY, owner/admin connection and disconnection API, SMTP TLS/STARTTLS verification, strict sender=authenticated mailbox, public-IPv4-only DNS restriction against internal-network SSRF, sender adapter, and owner settings form. No Robotronix platform SMTP fallback. Internal sending adapter has no public send endpoint; notification permissions and delivery orchestration are Phase 7F.

Environment: ACADEMY_EMAIL_ENCRYPTION_KEY must be a persistent 32-byte base64 secret configured on server. Never expose through NEXT_PUBLIC or log credentials. Supported SMTP ports 465 implicit TLS and 587 STARTTLS; require certificate validation. Network egress to external SMTP must be permitted by hosting provider.

Limitations: SMTP authentication does not establish mailbox ownership in every provider; the adapter restricts sender to authenticated mailbox and does not support arbitrary aliases. A live SMTP verification, test delivery, disconnection and negative cross-tenant checks are still required for operational certification. No PROD or Netlify changes.
