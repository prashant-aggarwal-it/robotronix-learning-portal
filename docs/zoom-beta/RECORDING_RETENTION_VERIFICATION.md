# Zoom Recording Retention — 60-Day Policy and Verification Register

**Decision:** Robotronix owner selected **60 days as the default** on 2026-10-22. **Status:** implementation statically inspected; production enforcement not yet independently verified. **Scope:** Zoom cloud recordings handled by Robotronix Classroom. This does not define retention for invoices, attendance, messages, recordings outside this integration, or Zoom's own trash-backup systems.

## Policy intent

Newly reconciled classroom recordings should normally be retained for **60 calendar days from recording end** (or recording start if an end timestamp is unavailable), subject to a documented administrator protection/extension and host-specific exceptions. Parent/student playback is available only when the authorised class access and learner-visibility controls permit it.

At expiry, the scheduled cleanup requests Zoom to **move the recording file to Zoom Trash** and changes its local status to `deleted` after Zoom confirms the operation. This is **not necessarily permanent erasure** from Zoom's systems; applicable Zoom trash retention and provider policies remain relevant. The metadata row is retained by Robotronix rather than immediately purged.

## Static implementation evidence

| Control | Code or schema | Inspected behavior |
| --- | --- | --- |
| Host default | `database/01_install/01_CREATE_SCHEMA.sql` | `zoom_host_accounts.recording_retention_days integer not null default 60`, constrained 1–3650 |
| Meeting default | same schema | `zoom_meetings.recording_retention_days integer not null default 60` |
| New recording expiry | `lib/server/zoom-recording-reconcile.ts` | `retain_until = recording_end/start + recording_retention_days`, fallback 60; `ignoreDuplicates: true` preserves existing lifecycle decisions |
| Host override | `app/api/zoom/hosts/route.ts` | Admin may change per-host retention days (1–3650); a host override can differ from 60 |
| Admin exemptions | `app/api/zoom/recordings/[recordingId]/route.ts` | Admin can extend expiry, mark protection, change learner visibility or request deletion |
| Cleanup authorization | `app/api/zoom/retention/route.ts` | POST requires nonempty matching `INTERNAL_CRON_SECRET` request header |
| Cleanup eligibility | same route | Only status completed, unprotected, expired records selected (up to 100 per invocation); each row rechecked before provider deletion |
| Cleanup action | same route | Zoom API DELETE with `action=trash` then local status `deleted`; failed rows recorded for retry |
| Scheduler | `netlify.toml`; `netlify/functions/zoom-retention.mts` | `15 2 * * *` scheduled invocation forwards authenticated POST |
| Playback gating | `app/api/zoom/recordings/[recordingId]/route.ts` and `stream/route.ts` | Admin access; trainers need class host permission; learners/parents need class access and both visibility flags; stream grant and active profile revalidated |

## Verification gaps before declaring production enforcement

1. Confirm canonical SQL is applied in the actual production Supabase instance; inspect current host rows for overrides and current recording rows for missing/expired `retain_until` values **read-only**.
2. Confirm Netlify actually deploys/enables the scheduled function, that `INTERNAL_CRON_SECRET` is configured in both service contexts, and that the daily invocation succeeds. Do not disclose secret values.
3. In a controlled nonproduction environment, create disposable Zoom recording metadata and test expiry, unprotected trashing, protection exemption, admin extension, retry on provider error, and backlog pagination.
4. Confirm behaviour when a Zoom recording has already been deleted or trashed externally; current code may count that as a failed cleanup.
5. Verify 60-day policy with any pre-existing host-specific values; applying a default does **not** retroactively shorten an explicit override.
6. Distinguish Zoom Trash from permanent removal in public privacy language and administrator procedures. Confirm Zoom-side trash recovery/permanent purge settings.
7. Verify old records without expiry are handled by a reviewed migration or documented exception; the current `.lt("retain_until", now)` query will not select NULL.
8. Review error logging: provider exception details must not expose access tokens, learner names or sensitive URLs.
9. Validate end-to-end role-isolation tests and recording-stream access; a previous playback HTTP 401 requires retest.

## Release gate

**Do not execute live deletion tests, change existing retention dates, or assert that all old recordings are deleted in 60 days.** After nonproduction validation, preserve run logs and a read-only production configuration snapshot. Any production change must use the normal stabilization-to-release approval route.

## Owner approval record

- Default selected: **60 days** (2026-10-22).
- Exceptions: configurable per host and per recording, subject to administrator decisions.
- Technical enforcement verification: **pending**.
- Privacy notice public update: **pending**.
