# Phase 7G — Microsoft 365 email integration (development)

Implemented in DEV: Microsoft Entra ID OAuth authorization-code with PKCE, 10-minute one-time state, owner/admin check, delegated Mail.Send/User.Read/offline_access permissions, encrypted refresh/access tokens, token refresh, Microsoft Graph /me/sendMail adapter, account disconnection, provider selection in academy notification preferences, and academy settings controls. Microsoft Graph /me/sendMail returns HTTP 202 without a provider message ID; the notification worker records acceptance without a message ID.

Server-only environment configuration:
- MICROSOFT_EMAIL_CLIENT_ID
- MICROSOFT_EMAIL_CLIENT_SECRET
- MICROSOFT_EMAIL_REDIRECT_URI (HTTPS, exact Entra registered redirect)
- MICROSOFT_EMAIL_APP_ORIGIN (canonical HTTPS app origin)
- ACADEMY_EMAIL_ENCRYPTION_KEY (persistent base64-encoded 32-byte encryption key shared with Google/SMTP)

Entra application registration must support the desired organizational/personal account audience, Microsoft Graph delegated Mail.Send and User.Read, and offline_access. Admin consent may be required by customer tenant policies. Configure redirect https://portal.robotronixstemlab.com/api/academy/email-connections/microsoft/callback only when deploying the matching app.

Not certified: live Entra account connection, permissions/consent, Graph sending, revocation, cross-tenant tests, and CI/typecheck. Per user request, defer testing; do not activate PROD or assume a live account is connected. Phase 7F event trigger wiring and scheduler remain separate outstanding development. No PROD or Netlify deployment.
