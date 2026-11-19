# Phase 7D — Google Gmail/Workspace integration

## Implemented in DEV branch
Google OAuth 2 authorization-code + PKCE, one-time ten-minute database state, rechecked academy owner/admin membership on callback, Gmail send-only scope, Google verified sender lookup, AES-256-GCM encrypted access/refresh tokens in service-role-only Supabase tables, token refresh, Gmail API send adapter, disconnect/credential deletion, and academy email settings connect/disconnect controls. Google account authorization is distinct from the application's Supabase Google login.

## Required environment (server-only, never NEXT_PUBLIC)
- GOOGLE_EMAIL_CLIENT_ID — Google Cloud OAuth web client
- GOOGLE_EMAIL_CLIENT_SECRET — OAuth client secret
- GOOGLE_EMAIL_REDIRECT_URI — HTTPS URL exactly matching authorized Google Cloud redirect URI, e.g. https://portal.robotronixstemlab.com/api/academy/email-connections/google/callback
- GOOGLE_EMAIL_APP_ORIGIN — canonical HTTPS app origin for post-connect redirects
- ACADEMY_EMAIL_ENCRYPTION_KEY — 32 cryptographically random bytes encoded in base64; retain securely and back up (rotation requires a migration)

Google Cloud must have Gmail API enabled and consent configured. The gmail.send scope is sensitive and may require Google verification depending on audience and publishing status. Do not publish or enable automated academy emails until the OAuth client, consent, credential protection, tenant isolation and live Gmail send/revoke tests are certified.

## Important limitations
The sendAcademyGmail adapter is server-internal, NOT a user-accessible send endpoint. It deliberately requires a separately authorized academy event/recipient in later notification workflows. It does not fall back to Robotronix SMTP. Gmail API acceptance is not guaranteed inbox delivery. Provider token revocation is not yet called at Google on disconnect (local credentials are deleted). OAuth provider setup and live send/revoke tests cannot be completed without authorized Google Cloud configuration. No PROD or Netlify changes.
