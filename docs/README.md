> **Fresh database consolidation (2026-10-21):** Former incremental SQL scripts 04–09 were included once in `database/01_install/01_CREATE_SCHEMA.sql` and removed from this branch. Follow [the current 2-file fresh installation and conditional Admin bootstrap](DATABASE_MIGRATION_ORDER.md). Historic upgrade instructions below are superseded; **do not execute the canonical fresh schema against an existing database**.

# Robotronix™ Learning Portal — Documentation Hub

**Audience:** founders/operations, developers, testers, trainers, support personnel, and deployment administrators.

**Source of truth:** this index and the guides below describe the current `chore/consolidated-fresh-install-20261018` release candidate. Verify details against the code when updating behavior. **`docs/archive/` is historical only; archived runbooks are not executable setup instructions.**

## Read in order

| Need | Guide |
| --- | --- |
| Understand the product and its users | [Application handbook](APPLICATION_HANDBOOK.md) |
| Follow an entire learner/customer journey | [End-to-end workflows](WORKFLOWS.md) |
| Install locally or bootstrap a new environment | [Environment setup — Dev and Prod](ENVIRONMENTS.md) |
| Install/verify the database and test users | [Database and QA](FRESH_INSTALL_AND_QA.md) |
| Connect and operate Zoom | [Zoom integration](integrations/ZOOM.md) |
| Configure billing and Razorpay | [Razorpay integration](integrations/RAZORPAY.md) |
| Manage Google sign-in and access | [Authentication and roles](integrations/AUTHENTICATION.md) |
| Release, monitor, troubleshoot or recover | [Operations runbook](OPERATIONS.md) |
| Run automated and manual tests | [Testing and release checklist](TESTING.md) |

## Reference map

- **Application:** Next.js App Router, TypeScript, React.
- **Identity/data:** Supabase Auth, Postgres, RLS.
- **Deployment:** GitHub `main` → Netlify, configured with production environment.
- **Classrooms:** Zoom OAuth, meeting APIs, webhooks and recordings.
- **Billing:** Razorpay invoice/payment synchronization.
- **Operational users:** Admin, Trainer, Parent; optional separately linked Student.
- **Database SQL:** `database/01_install`, `database/02_qa`, `database/03_verify`; destructive tools in `database/99_dev_tools`.

## Documentation maintenance rules

1. Every new feature/change must update the relevant *user workflow*, *integration/setup* and *test* documentation in the same PR.
2. Keep examples free of passwords, tokens, personal information and real customer details.
3. Record commands that actually exist in `package.json`; do not resurrect deleted migration or sanity SQL.
4. Put outdated documents in `docs/archive/` and label their date/status. Archive files are for research, **not** current procedures.
5. Do not state external integration behavior is proven until verified in the target environment.
6. Use relative Markdown links so documentation works directly in GitHub.

**Current release state:** local release/build/auth/roles/workflow checks were reported successful; GitHub PR checks and deploy preview passed. This does *not* equal production acceptance. See [Testing](TESTING.md).

## In-progress release branch: Priority 1 action notifications

For this unmerged, untested implementation see [Action-required notification design, upgrade notes and DEV acceptance tests](PRIORITY1_ACTION_NOTIFICATIONS.md). These changes are **not deployed or Production-verified**; the stable release guidance above remains authoritative until merge and successful deployment.

## Work in progress: P2/P3 cross-role data synchronization and Realtime recovery

[Read the P2/P3 implementation, SQL upgrade and DEV test matrix](P2_P3_REALTIME_RELIABILITY.md). This is an **unmerged, unverified implementation** on a separate branch stacked on the P1 notifications branch. It is not proof of deployment or Production acceptance.

## Consolidated release candidate (work in progress)

- [Consolidated stabilization backlog](CONSOLIDATED_STABILIZATION_BACKLOG.md) — approved requirements, implemented/pending distinctions and release acceptance.
- [System Logs guide](SYSTEM_LOGS.md) — safe diagnostic events, Admin access, installation and testing.
- [P1 action notifications](PRIORITY1_ACTION_NOTIFICATIONS.md) and [P2/P3 Realtime reliability](P2_P3_REALTIME_RELIABILITY.md) — existing candidate changes carried forward.

**Important:** The consolidated branch contains incomplete/unverified features and must not be treated as Production-ready or run against Production SQL until the full DEV release gate has passed.

## Consolidated release implementation and handover (draft)

- [All-round release QA and configuration handover](CONSOLIDATED_RELEASE_QA_HANDOVER.md)
- [Unified passwordless login and Admin grants](PASSWORDLESS_PORTAL_ACCESS.md)
- [Netbanking payout rules and bank-detail cutoff tests](TRAINER_FINANCE_NETBANKING.md)
- [System logging and cleanup](SYSTEM_LOGS.md)


## Database migration execution order (existing installations)

