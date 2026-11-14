# Phase 3F — Database Release and Rollback Runbook

**Not executed against PROD.** DEV reference project: `uzzuquxeeqonxeqcuohh`; PROD project: `njyktzenybimykpqaegn` (untouched). The two environments must not be assumed schema-identical.

## Preflight before requesting production approval
1. Authorize a read-only PROD inventory, and compare applied migration history, RLS, function grants, indexes and foreign keys to DEV.
2. Obtain an encrypted restorable backup and test restore in an isolated, authorized staging clone. Verify identities and sensitive data protection.
3. Freeze source SHA, migration checksums and approved target environment variables.
4. Review Phase 3B, 3C, 3D and 3E additive package dependency order; do not blindly re-run fresh-install scripts over existing data.
5. Verify duplicate index and Advisor findings against real query plans before removing indexes or changing RLS.
6. Verify service-only RPC privileges and per-tenant mapping integrity.

## Proposed execution sequence (future only)
- Clone PROD metadata into approved staging, apply migration preflights, backup and restore rehearsal.
- Apply only missing migrations in canonical order; use transactional preconditions, idempotent DDL where justified and the approved deployment window.
- Phase 3E critical order: scoped installer (48), tenant access (49), installation write guard + dropping legacy single-active index (50), dual module entitlement (51), Academy enrollment/demo record ownership (52).
- Deploy matching application code only after required database functions/grants are installed.
- Verify independent CRM A/B/C activation, entitlement disable, cross-tenant data denial, admission/enrollment/Tasks and job controls.
- Record SQL checksums, timestamps, owner signoffs and smoke results.

## Rollback
Rollback of multiple active customer integrations to a single-active legacy index is **not** a safe blind schema rollback. Freeze new integration operations, assess active tenant count, isolate affected customers, and restore using a rehearsed data-preserving strategy or validated backup. Preserve billing, enrollment, admissions and historical link records.

## Current blockers
No approved PROD inventory or staging clone, no backup/restore rehearsal, no live provider tests. **Production database migration: NOT AUTHORIZED; status BLOCKED.**
