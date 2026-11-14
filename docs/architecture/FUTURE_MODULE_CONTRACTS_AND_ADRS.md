# Future Module Design Contracts — v0.1
**Status:** Proposed, not approved for deployment. Follows the existing 167-table ownership register and master architecture blueprint.

## Conventions
- UUID primary keys, UTC timestamptz for audit events, typed enums/checks for bounded states, `created_at` and `updated_at` for mutable records.
- Reference existing `public.students(id)`, `public.courses(id)`, `public.enrollments(id)`, `public.delivery_centers(id)`, `public.xp_transactions(id)`, and `auth.users(id)` only where module prerequisites are explicit.
- Avoid storing secrets in relational tables. Use secret manager references; restrict service-role to server contexts.
- Any future table exposed through a Supabase Data API must have RLS and explicit grants. The proposal SQL has **no policies and must not be executed**.
- Proposed cross-module references in the draft require Academy. True standalone installers must use optional link packages or service-owned references, not always-on FK constraints.

## Proposed logical tables and high-value constraints
| Domain | Tables | Required integrity | Authorization |
|---|---|---|---|
| Platform | organizations, memberships, identity_links, module_entitlements, domain_events, event_deliveries | organization membership uniqueness; event dedupe; verified identity links | only scoped members; events server-only |
| LMS | course_modules, lessons, lesson_versions, content_assets, lesson_progress, submission_links | ordered modules; immutable published lesson versions; enrollment+lesson uniqueness | enrolled student, assigned trainer, admin |
| Assessment | question_banks, questions, question_versions, assessments, assessment_questions, attempts, responses | immutable question version per attempt; unique attempt number; rubric snapshot | learner sees own attempt; grading by authorized trainer |
| Gamification | award_rules, xp_awards, badges, badge_awards, streak_state | source-event idempotency; append-only awards; prohibit negative replay | learner's own awards; staff administer rules |
| Certificates | templates, credentials, credential_events | cryptographically random verification token **hash**, revocation journal | certificate owner / issuer; public minimal verification only |
| Analytics | metric_definitions, metric_snapshots, refresh_runs | metric calculation version; tenant-scoped aggregates; refresh dedupe | permission-specific data classification |
| AI | agents, prompt_versions, conversations, tool_grants, executions, usage_events | immutable version used for each execution; approval for write tools; usage accounting | caller effective grants, not agent blanket privilege |
| Operations | facilities, equipment, stock_movements, allocations, maintenance_work_orders | ledger consistency, unique asset tag, prevent simultaneous active allocation | organization/lab/staff scope |

## Implementation detail not yet modeled in 0001 draft
The SQL proposal is **a structural skeleton**, not a complete implementation-ready schema. Before enabling each module, add (and test):
1. Ownership and RLS policies with positive and negative persona fixtures, including parent/guardian student-link access.
2. State transition validation for grading, publishing, finance-adjacent awards, issuance and equipment returns.
3. Stable idempotency keys for all externally triggered events and imports.
4. Deletion, correction, archiving, erasure and retention policies.
5. Workload-driven index selection and query plans.
6. Consistent organization scope for all related rows, with join-safe scope checks.
7. Outbox execution/locking semantics, dead-letter handling and versioned event schemas.
8. Business audit records and support for legal holds where appropriate.
9. Migration scripts and compatibility adapters, independent of Release 1 installers.
10. Referential strategy to support standalone modules (avoid hard FK requirements on absent modules).

## Architecture decisions
**ADR-001:** Preserve legacy tables and RPCs throughout Release 1; no table replacement.

**ADR-002:** Model new platform org identity without automatically converting CRM tenants or Tasks workspaces.

**ADR-003:** Publish future modules as optional packages; no future DDL in `database/packages.json`.

**ADR-004:** Existing quiz/project/XP and financial ledgers remain canonical; any new record is a versioned addition or projection.

**ADR-005:** Domain events are for integration; use transactional outbox, dedupe keys and subscriber-level delivery state.

**ADR-006:** AI write actions require explicit user authority and, where consequential, human approval. Student data access is always role-filtered.

## Implementation roadmap
1. Release 1: finish runtime RLS, academy/CRM/Tasks functional QA, payments/payroll invariants and provider test coverage.
2. Platform identity proof-of-concept in separate migrations after reconciling existing membership semantics.
3. LMS content and learning-versioning foundation, with read-only existing progress bridge.
4. Assessments, then achievement rules and certificates after learning events are stable.
5. Operations and analytics data contracts; add aggregates only when required.
6. AI layer last for consequential actions, beginning with read-only summaries.

## Acceptance gate for each future module
Draft reviewed → physical DDL + RLS designed → syntax test in disposable PostgreSQL → negative-security tests → API contract tests → migration/reconciliation proof → deployment approval. No stage may be called certified from DDL text alone.
