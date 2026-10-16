# Robotronix Classroom — Zoom POC

This isolated proof-of-concept is intentionally not connected to normal Schedule/Class workflows yet.

## Required Zoom scopes
- meeting:write:meeting
- meeting:read:meeting
- meeting:update:meeting
- meeting:delete:meeting
- user:read:zak
- user:read:user  (required so the callback can identify the authorized Zoom host)

## Required environment variables
```env
ZOOM_CLIENT_ID=...
ZOOM_CLIENT_SECRET=...
ZOOM_REDIRECT_URI=https://portal.robotronixstemlab.com/api/zoom/oauth/callback
ZOOM_TOKEN_ENCRYPTION_KEY=<64 hex characters>
# Optional; if omitted, Client Secret signs OAuth state during POC
ZOOM_OAUTH_STATE_SECRET=<random secret>
```
Generate the encryption key locally:
`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

## Database
The Zoom POC foundation is consolidated directly into `database/01_install/01_CREATE_SCHEMA.sql`. This fresh-database release intentionally contains no Zoom hotfix/patch SQL.

## POC flow
1. Deploy these isolated routes to the portal domain (the configured HTTPS OAuth callback must exist there).
2. Open `/admin/zoom-test` as Admin.
3. Click Connect / reconnect Zoom Host 1 and authorize the Zoom account again.
4. The callback encrypts and stores OAuth tokens server-side.
5. Create a 30-minute test meeting.
6. Open Start as Trainer while logged in as Admin or Trainer.
7. Open Join as Participant in a different browser profile logged in as QA Student.
8. Both should remain in the Robotronix browser experience; the Zoom desktop app should not be required.

## Security choices
- Zoom passwords and OAuth tokens are never given to trainers/students.
- OAuth state is HMAC-signed and expires after 10 minutes.
- Access/refresh tokens are AES-256-GCM encrypted before database storage.
- Host ZAK is fetched just before starting a meeting and is not persisted.
- Client ID/Secret stay server-side.
- POC meeting APIs are separated from production schedule automation.

## Not implemented in this POC
- automatic Zoom host allocation / collision management
- schedule/reschedule/cancel synchronization
- participant webhooks and presence calculations
- late/no-show/early-end alerts
- production trainer/student assignment authorization rules
