# Phase A — EdTech Integration Architecture and Delivery Contracts

Date: 2026-11-09  
Status: **Approved direction from conversation; contract proposal implemented as versioned source artifact, not runtime APIs.**  
Related: [Gate 0](GATE0_BASELINE_AUDIT_20261109.md), [platform blueprint](EDTECH_PLATFORM_ARCHITECTURE_BLUEPRINT_20261109.md), [machine-readable v1 contract](contracts/portal-integration-v1.json), [OpenAPI 3.1 draft](contracts/portal-integration-openapi-v1.json).

## 1. Architecture decision records

**ADR-A1 — Products remain independent.** Connect is multi-institute CRM/admissions; Portal owns academic operations and delivery. Portal integration is an opt-in connection. Independent identities, entitlements and future deployments. In current DEV they happen to coexist in a Supabase project, but no cross-schema FK or direct table sharing is introduced.

**ADR-A2 — Portal owns all real teaching demos.** Connect owns booking intent and sales coordination. Portal owns trainer availability, slot reservation, Zoom provisioning, demo session/participant, reschedule/cancel/no-show and feedback. Connect's native appointment remains available for sales calls and standalone customers, but is not the canonical Portal demo.

**ADR-A3 — One business action, one authority.** Portal has to expose a narrow service also used by its admin UI. Connect cannot send `requireAdmin` credentials or call `/api/admin/demos` as a surrogate Portal administrator. Public request types must not reveal parent contact or trainer access secrets.

**ADR-A4 — Eventual consistency is explicit.** A Connect request may return `requested`/`confirming`, not a fictitious confirmed Zoom meeting. Eventual results are delivered at least once and reconciled. A duplicated request/event does not create a duplicated booking, task, invoice or enrolment.

**ADR-A5 — Admission and academic truth are separate.** Connect negotiates accepted commercial terms; Portal validates and creates enrolment. CRM Won is triggered only by Portal `EnrollmentConfirmed` under agreed finance policy. Demo attendance or legacy Portal `demo_leads.status='converted'` alone is not enrollment confirmation.

**ADR-A6 — EdTech-only, subject-neutral.** Generic programme/learner/guardian/session/curriculum concepts support tutoring, music, languages, vocational and STEM. Do not hardcode subject-specific skill or grade attributes into cross-product APIs.

## 2. Service boundaries and logical modules

1. `connect/admissions`: opportunity, offer snapshot, contact links, follow-ups and CRM calendar projections.
2. `portal/demo-domain`: policy validation, slot reservation, participant, trainer assignment, Zoom saga and state transitions.
3. `portal/enrollment-domain`: verified guardian/learner identity, onboarding, package and academic enrollment confirmation.
4. `portal/lifecycle-projections`: read-only summaries for approved scopes; never raw academic/financial ledger access.
5. `integration/adapter`: per-installation authentication, idempotent commands, durable outbox/inbox, versioned events, external links, retries and reconciliation.

**Repository implementation boundary:** shared demo business logic must leave `app/api/admin/demos/route.ts` and become a server-only domain service; existing admin/trainer/guest endpoints consume it or its read models. Connect-specific routes stay tenant-scoped and call a limited Portal integration client. This refactor is Phase B work, not part of the design-only Phase A changes.

## 3. Contract behavior

The JSON contract records route names, method, scope, required body fields, event envelope, result shape, states and transitions. All paths are provisional until the Portal integration namespace and installation lifecycle are finalized.

### Commands and reliability

- Per-installation authentication; authenticate caller AND check both Connect tenant and linked Portal institution. Revoked integration returns `FORBIDDEN`.
- Every mutation carries `requestId` plus `Idempotency-Key`; equal key + equal canonical payload returns the same accepted/result response, equal key + different payload returns a conflict.
- For update/cancel, use expected version. Stale version returns `STALE_VERSION`, never silently overwrites another staff action.
- Recheck trainer qualification, working hours, overrides, class and demo conflicts, location buffers and Zoom host capacity **at confirmation**, not just availability search.
- Use a database-enforced slot reservation or per-trainer transactional advisory locking around local booking; no check-then-insert race.
- Persist booking intent and state atomically, provision Zoom asynchronously, update status and emit event via durable outbox. Do not hold DB transaction open across Zoom HTTP call.
- If Zoom succeeds but acknowledgment fails, replay by persisted provider correlation and reconcile; do not create another provider meeting blindly.
- Preserve group session as one booking with separate participants and separate CRM opportunity links.

### Errors and client semantics

- `SLOT_CONFLICT`: refresh slots and prompt alternative.
- `STALE_VERSION`: reload booking and require review of new state.
- `CONSENT_REQUIRED`/`LINK_UNVERIFIED`: ask for missing guardian authorization or manual identity review.
- `DEPENDENCY_UNAVAILABLE`/`RETRYABLE`: preserve pending request and its ID, show truthful status, retry safely.
- `ALREADY_FINAL`: do not reopen completed/cancelled session through a normal reschedule command; use documented admin correction flow.
- Disclose neither raw provider error content nor private identity/contact fields in generic client error messages.

### Event handling

- Verify signature/integration status, persist event first, acknowledge promptly and consume asynchronously.
- Unique `(integration_id,event_id)`; subject versions prevent older events from reverting newer projections.
- Delivery is at least once, not guaranteed exactly once; effects such as follow-up creation are idempotent against originating event ID.
- Failed events enter bounded retry with alert/dead-letter and administrator reprocess option. A reconciliation endpoint lists the authoritative Portal state for outstanding links.
- Support versioned event schemas and backward-compatible additive changes; breaking event changes require new version and dual-read window.

## 4. Identity and tenant mapping

- Keep distinct Connect `person` and Portal `parent`/`student`/`trainer` identities. External links are per Connect tenant, Portal institution and connection.
- Contact phone and email are candidates for matching, not sufficient identity proof. Guardian with two learners remains one adult person and two learner relationships.
- For existing Portal parents/learners, verify relationship using authorized account/guardian evidence and manual review when ambiguous; link existing IDs instead of creating duplicates.
- Do not require an auth login for a pre-admission prospect or demo guest. Portal guest access retains limited-token scope.
- Mapping data should carry verified_at, method, reviewed_by, active/revoked lifecycle and audit evidence; do not expose the verification evidence to all roles.
- Disconnect preserves historical links/audit under retention policy but suspends command/event exchange; disconnect must not delete Portal students or CRM contacts.

## 5. Authorization matrix (policy intent)

| Actor | Read/demo availability | Book demo | Reschedule/cancel | Demo feedback | Enrollment handoff | Finance summary |
| --- | --- | --- | --- | --- | --- | --- |
| Connect owner/admin | Yes | Yes | Yes | Approved summary only | Yes | Authorized summary |
| Connect manager | Yes | Yes | Policy-limited | Approved summary only | Yes with approval | Policy-limited |
| Connect sales agent | Yes | Yes | Own/assigned booking only | Approved summary only | Request only | No by default |
| Connect viewer | Read assigned context | No | No | No private detail | No | No |
| Portal admin/coordinator | Yes | Yes, native Portal workflow | Yes | Approved academic record | Approve/complete | Authorized ledger |
| Portal trainer | Assigned schedule only | No CRM booking | Request via Portal | Own assigned learners | No | No |
| Parent/learner | Own guest/Portal access | No CRM rights | Request through guest process | Own permitted report | Own onboarding | Own permitted invoices |

**Enforcement:** server/API AND database/tenant-scoped service; never grant CRM agent a Portal administrator token. The eventual detailed capability matrix must be tested with positive and malicious cross-tenant IDs.

## 6. Commercial and curriculum compatibility

- Portal `course`/future immutable `course_version` is the academic truth. Connect `programme`/offer is a sellable catalogue view; map it to one or more Portal courses/programmes by verified integration link.
- Accepted offer snapshots store fee, currency, tax/discount, session entitlement, payment terms, policy version and approval evidence; Portal may reject incompatible terms.
- Enrollment may remain `pending` until fee arrangement, required consent and schedule prerequisites are met; Connect does not presume enrollment from acceptance.
- Course progress and consumed sessions are distinct. Future curriculum, assessment, credentials and gamification remain Portal-owned and subject-neutral.
- Continue supporting Portal-only manual enrolment and Connect-only admissions without imposing foreign keys between products.

## 7. Migration reconciliation (DEV investigation and forward plan)

Live read-only inspection on 2026-11-09 verified 60 `connect` tables, 80 `public` tables, 51 migration ledger entries, and source file 40–47 objects present in DEV. Recorded migration names do not independently identify each file 40–47. This may be bundled or manually applied work and **cannot be safely replayed blindly**.

Before new integration DDL:

1. Export schema-only definitions and DB migration ledger in an authorized DEV snapshot, excluding rows/credentials.
2. Compare table columns, constraints, indexes, functions/signatures/grants and triggers to all 37 current source SQL files; produce an object-to-source-to-migration ledger.
3. Identify scripts applied via a combined migration vs manual execution using migration definitions/history where available. Do not pretend exact history from names alone.
4. Rehearse clean setup against an isolated disposable DEV database/project and then forward-only reconciliation against a sanitized DEV clone; never apply test verification SQL to production.
5. Create reviewed, idempotent corrective migrations only for objectively proven drift, with backup/restore and rollback plan. Use CLI migration tooling as instructed by current Supabase version; no DDL is part of this Phase A contract PR.

**Current executable status:** source contract check is automated; full live schema checksum/clean-install validation is explicitly **not yet completed**. This remains a release blocker before Phase B database writes.

## 8. Privileged function security review (DEV)

Supabase advisors on 2026-11-09: `rls_enabled_no_policy` 88 (60 Connect private + 28 public), search-path warnings 9, `btree_gist` in public 1, anonymous definer execution 39, authenticated definer execution 57, leaked-password protection 1. Read-only catalog review found 28 security-definer trigger functions and 39 directly callable security-definer functions in Portal `public`; 17 of the callable functions were executable by `anon`, 35 by `authenticated`.

**Interpretation:** trigger functions generally cannot be invoked as ordinary scalar RPCs, but the executable callable functions deserve review. Advisory counts are warnings, not direct proof of exploit. Do not blanket-revoke: RLS helper predicates and active Portal RPCs may depend on currently granted EXECUTE.

Required remediation workflow: classify each callable as policy helper, user RPC, internal-only, or trigger; audit body and caller-context checks; ensure safe `search_path`; restrict grants to intended roles; ensure service-role Connect RPCs retain tenant membership checks; test every Portal role and unauthorized caller before promoting changes. Review public RLS-no-policy notices separately. Existing `connect` schema usage is denied to `anon`/`authenticated`, but service-role bypass demands explicit tenant checks.

No function grants or security policies were changed here. Security remediation requires isolated DEV tests and separate sign-off due to the risk of breaking Portal access.

## 9. Test and acceptance plan

Machine-readable design contract checker: `node scripts/check-connect-portal-contract.mjs`.

Consumer/provider contract tests to add when API exists: happy booking, permission denial, cross-tenant ID, invalid parent/child link, duplicate request same/different payload, two simultaneous bookings for one slot, Zoom timeout and replay, reschedule version conflict, cancellation at each state, group member addition, no-show, trainer feedback privacy, once-only opportunity Won, Portal-only workflows, Connect-only calendar, reconnect/disconnect and event ordering.

Release gates: typecheck/build; Connect code/DB layout; full four-role Portal regression; DB migration rehearsal; authenticated browser and Zoom DEV journeys; finance/Razorpay regression; security advisor review with accepted exceptions; observability and restore drill. Phase A source checks passing must **not** be represented as end-to-end integration success.

## 10. Decision register and Phase B handoff

| Decision | Recommended baseline | Status |
| --- | --- | --- |
| Connect independent SaaS | Yes, optional Portal adapter | Adopted design |
| CRM primary prospect booking interface | Yes, Portal authoritative execution | Adopted design |
| Opportunity Won policy | Portal confirmed enrolment under configured fee/approval policy | Adopted design; policy configuration pending |
| Trainer assignment | Portal capability and availability, manual override | Contract proposal; race semantics require implementation |
| Slot reservation | DB-backed atomic lock/reservation | Contract proposal |
| Event guarantee | At-least-once with durable dedupe/reconciliation | Contract proposal |
| School/group demos | One Portal session, separate participants/opportunities | Contract proposal |
| CRM standalone demo | Ordinary CRM appointment / future external provider adapter | Adopted design |
| Currency/taxes/installment handling | Accepted offer snapshot validated by Portal | Detailed finance policy pending |
| Data retention, consent, identity proof | Minimal/verified with configurable legal policy | Requires owner/legal review |

**Phase A deliverables produced:** ADRs, permission matrix, command/event v1 machine-readable contract, recovery/idempotency policy, identity mapping, curriculum compatibility, security and migration risk assessment, and executable design checks.

**Honest completion boundary:** the *architecture-contract implementation* is complete in source. Migration reconciliation, permission hardening and real UAT are documented but not executed; they require separate controlled DEV work and must be finished before any claim of Phase B production readiness. No Production changes, no application API deployment, no merge to `main`.
