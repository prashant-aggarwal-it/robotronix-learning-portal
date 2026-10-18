# Zoom Phase 1 — host allocation guard (October 2026)

## New database upgrade
Apply `database/04_upgrade/06_ZOOM_HOST_ALLOCATION_GUARD.sql` to a **staging** database after the Zoom Classroom V1 and Demo Experience migrations, before deploying the updated code.

- This creates a PostgreSQL GiST exclusion constraint on active Zoom meetings per host using epoch-based start/end ranges.
- It rejects concurrent or ordinary schedule operations that would overlap one host's active reservations (SQLSTATE 23P01).
- The migration refuses to install if overlapping active meetings already exist. Inspect and reconcile those records; do not bypass the guard.
- The existing host availability check is advisory. The database constraint is the final arbiter.
- For general meeting creation and class reallocation, a rejected local reservation attempts to delete its newly created remote Zoom meeting.
- For class reallocation, the old Zoom room is not deleted until the new local reservation succeeds. If old-room cleanup fails, log review and provider reconciliation are still required.

## Remaining verification gate
1. Test two simultaneous scheduling requests against the same host, with different schedule events: exactly one overlapping reservation succeeds.
2. With two independent connected hosts, verify two overlapping meetings get different hosts and a third overlapping request is rejected.
3. Test non-overlapping adjacent sessions, schedule edits, cancellations, and reallocations.
4. Confirm the rejected request does not leave a stray Zoom meeting.
5. Run `npm run typecheck`, `npm run build`, `npm run check:zoom-classroom`, and full release QA from a checked-out repository.
6. Verify recording Protect/Unprotect, +60 days, deletion, automatic retention and playback in an isolated deployed environment.
7. Confirm Zoom Marketplace scopes and reauthorization for both independent host accounts.

**Important:** No live database migration, tests, Netlify deployment, Zoom OAuth changes, or production merge has been performed by these GitHub commits. The database constraint prevents overlapping local reservations but does not make remote Zoom calls transactional; provider reconciliation is still essential.
