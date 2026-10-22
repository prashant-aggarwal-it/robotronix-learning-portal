# Zoom — configuration, usage and operational checks

## Scope

The current code implements Zoom host OAuth, host management, meeting operations, classroom entry, webhooks, reconciliation and recording/retention interfaces. Provider behavior and permissions must still be tested on the specific deployed Zoom app/host account. Don't treat static checks as a successful live provider test.

**Where:** Admin `/admin/zoom`, `/admin/zoom-test`, Trainer `/trainer/classes`, classroom `/classroom/[scheduleEventId]`, demo `/trainer/demos`. Server APIs are under `app/api/zoom/`.

## Provider setup — separately for DEV and PROD

1. Create/configure a Zoom Marketplace OAuth app with permissions matching actual meeting, recording, user/ZAK and webhook API operations. Scopes must be checked against Zoom's current provider console.
2. Add authorized redirect **in production**:
   `https://portal.robotronixstemlab.com/api/zoom/oauth/callback`.
3. Configure the production webhook subscription URL:
   `https://portal.robotronixstemlab.com/api/zoom/webhook`.
4. Subscribe to supported meeting start/end, participant join/leave and recording completion/deletion events as permitted by your app settings.
5. Set `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `ZOOM_REDIRECT_URI`, `ZOOM_TOKEN_ENCRYPTION_KEY`; optional `ZOOM_OAUTH_STATE_SECRET`. Keep encryption keys stable, securely stored and **server-only**. Inspect `.env.example` for documented names; provider-webhook secrets/validation must follow the implemented webhook route and deployment variables.
6. Redeploy with properly scoped variables. Complete app-specific OAuth eligibility/beta-user approval as required by Zoom before adding each host.
7. As Admin visit `/admin/zoom` → connect a host → authorize in Zoom; repeat for a second independent host only after host 1 passes.
8. Confirm host enabled status, permissions and meeting reconciliation; never mix a DEV Zoom app's credentials with Production.

## Daily operation

1. Admin reviews Zoom hosts, meetings and storage/recordings in `/admin/zoom`.
2. Online class: ensure active enrollment and schedule event before starting the related meeting/classroom.
3. Trainer opens their scheduled class and uses its supported Zoom actions; Parent/learner joins only through the authorized link/flow.
4. Compare actual meeting participation/webhook records with application attendance; don't assume one automatically proves the other.
5. Admin may use **Sync with Zoom** to reconcile remote meetings/recordings.
6. Recording access uses protected playback endpoints; only authorized users should see them.
7. Respect recording retention/protection; scheduled Netlify retention function exists in `netlify.toml` (`15 2 * * *`), but confirm actual scheduled execution and safe deletion behavior before relying on it.

## Recording retention and privacy

- The default is **60 days** for newly reconciled Zoom cloud recordings. A host-specific retention value or Admin recording-level protection/extension can override the default.
- `zoom_recordings.retain_until` controls eligibility; records with no expiry are not selected by the current expiry query. The cleanup also excludes protected records and rechecks authorization/eligibility before acting.
- At expiry, the implementation requests Zoom `action=trash`, **not guaranteed irreversible deletion**. Robotronix retains a metadata/status record; Zoom's own Trash/recovery policy may differ.
- The scheduled function `zoom-retention` is configured for **02:15 UTC daily (07:45 IST)**. Verify function execution and secret matching in Netlify before claiming live enforcement. Do not use its manual Run action for production testing.
- Use the [recording-retention verification register](../zoom-beta/RECORDING_RETENTION_VERIFICATION.md) and [privacy addendum draft](../zoom-beta/PRIVACY_ADDENDUM_DRAFT.md) before publishing a public privacy promise.

## Zoom Marketplace Beta approval

The Technical Design review and Security/Privacy Compliance review are separate. The reviewer requested SSDLC evidence, raw SAST/DAST outputs, public Privacy Policy, TLS 1.2+, and applicable security policies. See [the reviewer response and evidence checklist](../zoom-beta/EVIDENCE_CHECKLIST_AND_REVIEWER_RESPONSE.md). Do not claim approval, publish the app, or invite external accounts until Zoom approves the Beta submission.

## Safe acceptance test

- Host 1 OAuth connect and reconnect; no redirect errors.
- Create a *controlled* test meeting, verify host can start and a separate approved user can join.
- Check host overlap/capacity handling and a second host if enabled.
- Check meeting lifecycle/status, participant presence, webhook delivery and retry.
- Verify recording ingestion, secure playback and access denial to unauthorized users.
- Verify retention protection prevents unintended delete; test deletion only using disposable recordings with appropriate provider scopes.
- Verify no unintended real-customer notifications/invites.

## Troubleshooting

| Symptom | Inspect |
| --- | --- |
| OAuth redirect fails | Zoom app redirect allowlist, `ZOOM_REDIRECT_URI`, deployed host, callbacks |
| Host connects but meeting fails | Account beta eligibility, granted scopes, enabled host, provider error |
| Webhook events absent | Zoom event subscriptions, endpoint `/api/zoom/webhook`, deploy logs, webhook validation |
| Recording missing | Host recording settings, `/api/zoom/reconcile`, provider processing delay |
| Second class conflicts | Host allocation overlap constraint and current meeting state |
| Retention not running | Netlify scheduled function logs, cron config, secret and deletion guard |

**Source code:** `lib/server/zoom*.ts`, `app/api/zoom/`, `netlify/functions/zoom-retention.mts`; SQL is integrated in `database/01_install/01_CREATE_SCHEMA.sql`, **not** separate `04_upgrade` files.
