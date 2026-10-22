> **Current release candidate (2026-10-22):** Branch `release/consolidated-stabilization-20261020`, release PR #6. Schema and reference data produce one generated installer using `npm run db:build-fresh-install`. Only run it on an **empty** database; do not run it against existing production data.

# Robotronix™ Learning Portal — Documentation Hub

**Audience:** founders/operations, developers, testers, trainers, support personnel, and deployment administrators.

**Source of truth:** the current stabilization branch and the guides below. These explain implemented code and flag unverified provider behavior. Archived runbooks are historical, not installation instructions.

## Read in order

| Need | Guide |
| --- | --- |
| Understand the product and its users | [Application handbook](APPLICATION_HANDBOOK.md) |
| Follow an entire learner/customer journey | [End-to-end workflows](WORKFLOWS.md) |
| Install locally or bootstrap a new environment | [Environment setup — Dev and Prod](ENVIRONMENTS.md) |
| Generate/install/verify one-shot SQL and test users | [Database and QA](FRESH_INSTALL_AND_QA.md) |
| Connect and operate Zoom | [Zoom integration](integrations/ZOOM.md) |
| Configure billing and Razorpay | [Razorpay integration](integrations/RAZORPAY.md) |
| Manage Google sign-in and access | [Authentication and roles](integrations/AUTHENTICATION.md) |
| Release, monitor, troubleshoot or recover | [Operations runbook](OPERATIONS.md) |
| Run automated and manual tests | [Testing and release checklist](TESTING.md) |
| Review latest changes and unresolved release gates | [Consolidated stabilization backlog](CONSOLIDATED_STABILIZATION_BACKLOG.md) |
| Prepare Zoom Beta reviewer evidence and retention policy | [Zoom Beta evidence checklist](zoom-beta/EVIDENCE_CHECKLIST_AND_REVIEWER_RESPONSE.md) |

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
4. Remove superseded runbooks from the active tree once their useful guidance is folded into current docs; Git history preserves them. `docs/archive/README.md` explains the historical cleanup.
5. Do not state external integration behavior is proven until verified in the target environment.
6. Use relative Markdown links so documentation works directly in GitHub.

**Current release state:** the candidate built and passed local TypeScript/structural checks on 2026-10-22; GitHub release and security checks passed at commit `7a4ac06`. Subsequent documentation/installer commits require their own CI verification. Authenticated DEV QA and end-to-end Zoom retention behavior have not been freshly certified. Production has not been updated by this work. See [Testing](TESTING.md).

## Consolidated feature specifications and acceptance

P1 [action-required notifications](PRIORITY1_ACTION_NOTIFICATIONS.md) and P2/P3 [cross-role Realtime reliability](P2_P3_REALTIME_RELIABILITY.md) have been incorporated into the stabilization candidate's canonical schema and app. Their original incremental-upgrade instructions are historical and must not be applied to a fresh project. Functional cross-role verification is still a release gate.

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


## Database installation for a fresh Supabase project

Run `npm run db:build-fresh-install`, then execute the generated `database/generated/ROBOTRONIX_FRESH_INSTALL.sql` **once** in a new empty project. Run the read-only verification SQL afterward. The optional first-Admin bootstrap is separate. See [Database migration order](DATABASE_MIGRATION_ORDER.md); QA seeds and DEV resets are never Production installation steps.
