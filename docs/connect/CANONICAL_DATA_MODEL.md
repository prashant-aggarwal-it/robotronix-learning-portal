> **Historical design (superseded 2026-11-05).** This document describes the former Portal-coupled CRM prototype and is retained as design history only. The current standalone multi-tenant Connect architecture is documented in [SAAS_ARCHITECTURE_DECISION.md](SAAS_ARCHITECTURE_DECISION.md). Do not implement or apply migrations from this historical specification.

# Robotronix Connect — Canonical Data Architecture (Proposed ADR)

Date: 2026-11-05
Status: **Design proposal — not approved or migrated**
Branch: `feature/robotronix-connect-crm`

## Objectives and principles
Design correct durable entity boundaries now, without overengineering implementation. We have no live customer records, but the deployed DEV database remains unverified due to query timeouts. No DDL is authorized by this document.

Reviewed: source SQL for `profiles`, `parents`, `students`, `student_guardians`, `parent_students`, `onboarding_submissions`, `demo_leads`, `demo_sessions`, `demo_session_participants`, `family_introductions`, `communication_threads`/`communication_messages`, `courses`, `enrollments`; demo APIs and role guard.

## Critical data ownership decisions

1. **Identity is not login.** CRM person records exist without Supabase Auth. Auth users are optionally linked to people/staff profiles, not required for leads.
2. **People, learners, families, organizations are different concepts.** A learner is a person; a guardian is a person; family membership and responsibility are join records with temporal validity and role. An adult can belong to multiple families; a school contact can simultaneously be a parent.
3. **Do not force parent/child into one `demo_leads` record.** `demo_leads` becomes a compatibility/projection record until a staged replacement is validated; do not delete demo/guest references.
4. **Enquiry, opportunity, and activity are distinct.** An inbound enquiry is an immutable originating touch; an opportunity is one commercial pursuit; one contact can have multiple opportunities and repeated touchpoints. Pipeline stages describe opportunities, not identities.
5. **Organization relations are many-to-many.** Link contact people to schools and institutions with explicit roles; school opportunities link to organizations. Contacts can also make personal purchases.
6. **Education domain stays canonical in the portal.** Courses, scheduling, demonstrations, enrollment, billing, attendance and progress should have one owner. CRM references those records; it does not duplicate financial or academic ledgers.
7. **Privacy is integral.** Learner and guardian association data must not be indiscriminately visible to trainers or outreach roles. Marketing consent, operational communication, source of consent and withdrawal are separately recorded.
8. **Every external integration is idempotent.** Distinct provider account + provider ID uniqueness, raw signed webhook receipt metadata, retry state, processing status, and a queue/outbox for outbound messages. Treat provider payloads as untrusted input.
9. **No sales stage overwrite without history.** Capture stage transitions and reasons; update projection/current stage atomically in one transaction.
10. **Do not use unbounded generic EAV or JSON blobs for core relationships.** Use constrained columns and foreign keys; JSONB only for optional provider payloads and extensible metadata with validated schemas.
11. **No speculative multi-tenant complexity.** `organization_id` denotes a customer institution, not a SaaS tenant. A separate `workspace_id` is needed only if independently isolated operating entities are genuinely supported; don't confuse the two.

## Proposed schemas and canonical tables

### crm (non-exposed or carefully exposed schema)
- `people`: person_id UUID PK; display_name; normalized_name; lifecycle; created_at; updated_at; archived_at. Do not store minor data unnecessarily.
- `contact_methods`: ID, person_id FK, kind (phone/email/whatsapp/etc), normalized_value, raw_value, provider scoped identity, is_primary, verified_at, is_active. Non-null constraints and partial uniqueness scoped to verified identifiers; **do not auto-merge solely on shared household phone**.
- `families`: family_id PK, name optional, timezone and location context.
- `family_people`: family_id/person_id, role (guardian/learner/other), effective dates, primary flag; uniqueness constrained for active relationships where relevant.
- `guardian_learner_relations`: guardian_person_id, learner_person_id, relationship type, contact authorization, effective dates; FKs, distinct persons constraint.
- `organizations`: organization_id PK; type (school/play_school/corporate/ngo/other), legal/display name, contact information via appropriate link, parent organization reference optional.
- `organization_people`: organization_id/person_id, title, decision role, start/end validity.
- `inquiries`: inquiry_id PK, channel, received_at, intake account, raw/source identifier, message subject/summary, person_id nullable pending matching, source campaign; immutable source metadata.
- `opportunities`: opportunity_id PK; type (individual_course/school_program/kit/workshop/other), primary_contact_id, organization_id nullable, owner_staff_id nullable, pipeline_id, stage_id, expected_value/currency, expected_close_date, status, loss_reason_id nullable, first_inquiry_id, created_at, closed_at; enforce valid type-specific association rules in service/database.
- `opportunity_learners`: opportunity_id/person_id FK, links one or multiple learners to an opportunity.
- `pipelines`, `pipeline_stages`, `stage_history`: configured stage sequence, category and allowed transitions; history contains actor, old/new state and timestamp.
- `activities`: activity_id, type (call/note/meeting/message/other), opportunity/contact relations, happened_at, actor, outcome; privacy classification.
- `tasks`: task_id, owner, due_at, status, priority, opportunity_id, contact_id, reason, completion timestamp. Index by owner+status+due_at; overdue should be computable.
- `campaigns`, `attribution_touchpoints`: original source immutable, later touchpoints separate, UTM provider IDs captured when provided.
- `conversations`, `messages`: provider-scoped conversation/message identity, contact and optional opportunity, direction, delivery status, timestamps; do not conflate with internal portal messaging.
- `channel_accounts`, `webhook_receipts`, `outbound_messages`: provider credentials only in secure server-side vault/config; signature verification, idempotency keys, retry/ack and immutable receipt.
- `consent_events`, `contact_preferences`: purpose, channel, actor/source, captured_at, revoked_at; explicit withdrawal and audit trail.
- `record_links`: typed references to *verified* portal demo/onboarding/parent/learner/enrollment records, or preferably explicit FK junctions where stable. Avoid loosely typed polymorphic FKs for core links.
- `merge_reviews`, `person_merge_events`: suggested duplicates, reviewed decisions, reversible cross-reference mapping, history preservation.
- `crm_staff_permissions`: least-privilege staff access, maintained apart from guardian/learner identities.

### Existing portal domains
Keep `courses`, `demo_sessions`, `demo_session_participants`, `enrollments`, `student_invoices` and schedule as operational record owners. Evolve existing `parents`, `students`, `student_guardians` and onboarding to link to canonical person/family identities. Preserve authentication relationships. Optionally create compatibility views rather than forcing immediate rewrite of every portal screen.

## Practical uniqueness and constraints
- Every stable entity has UUID PK, timestamps and explicit FKs with intentional ON DELETE behavior.
- Never cascade-delete paid invoices, audit entries, trial feedback or external communication history when deleting a contact; use restrict/anonymization/retention workflow.
- Unique `(provider_account_id, provider_external_message_id)` where external ID is present.
- Unique `(provider_account_id, provider_external_webhook_event_id)`, or deterministic digest for events without stable provider IDs.
- Unique `(opportunity_id, learner_person_id)` in opportunity learners.
- Partial unique for active verified provider account identifiers; shared emails/phone numbers can exist across households, so avoid globally forcing uniqueness for unverified contact data.
- Use `timestamptz` for event timestamps, `date` for date-only business fields; store contact time zone.
- Monetary values use `numeric(14,2)` and ISO currency, not floating point. Never infer revenue solely from proposal value.
- Check allowed state transitions and use a version field or transactional concurrency control for simultaneous agents.
- Use indexes on search keys, foreign keys, active owner/stage/due date and provider idempotency; benchmark before adding speculative indexes.
- Archive/retention/anonymization obligations are separate from leads being Lost or Won.

## Canonical journeys
1. WhatsApp enquiry arrives → validate provider signature and persist receipt → normalized identifier lookup → match candidate person or manual review → create inquiry, create/link opportunity → assign owner and next task.
2. Parent enquires via mobile call → fast intake (number, course, learner info if supplied, follow-up) → match existing contact → append inquiry/activity, not duplicate person.
3. A contact has two children → one person record, multiple guardian/learner relationships and distinct opportunities.
4. Demo booked → existing demo session/participant + opportunity links; trainer sees only learner-appropriate info, not guardian private details.
5. Trial completed → feedback preserved in demo participant → activity and next task generated → accepted programme/payment confirmed → map to existing portal student/parent, link to enrollment and close opportunity as Won **once**.
6. School coordinator enquiry → person and institution, organization relationship, institutional opportunity; no fake student record.
7. Kit purchase → order/fulfillment domain later, opportunity links to actual order and payment; never pretend invoice is purchase until paid.

## Security and testing gates
- Private schema or strict grants and RLS for exposed CRM tables. Server-side service role only via narrow authenticated actions; no secret keys in client.
- Staff role permissions are enforced in API and DB, not UI-only.
- RLS select/insert/update/delete positive AND negative tests for sales, admin, parent, student, trainer, unauthenticated.
- Index permission policy predicates and avoid circular policies and unreviewed SECURITY DEFINER functions.
- Encrypted/secured channel connection secrets and no raw token exposure in API responses.
- Provider webhook signature checks, replay protection, retryability and durable outbox.
- Unit/integration tests for identity matching, shared numbers, duplicate leads, conversion idempotency, concurrent updates, stages and permission boundaries.
- Fresh-install migration test from empty DB plus existing portal QA seeds; restore/rollback plan and schema diff.

## Phased migration proposal
A. Verify live Development schema before touching it; exact definitions and historical migration state may differ from source SQL.
B. Snapshot schema + non-PII counts; identify incompatible constraints; reconcile other active branches.
C. Write canonical identity and CRM domain SQL migrations on Connect branch, with explicit down/recovery procedures.
D. Add compatibility links and deterministic backfill of existing demo leads. Validate row-level matches manually when ambiguous.
E. Switch writes behind new API services (transaction boundary) and keep legacy reads as projections until QA passes.
F. Deprecate legacy duplicate fields *only after* all workflows pass; keep durable FK links to demos and enrolments.
G. Never merge or deploy without explicit user approval.

## Decisions to resolve before DDL
- Whether a learner must be represented in `people` or have a dedicated `learners` table referencing `people` (recommended: person + learner profile; maintain education-specific attributes separately).
- Whether family entity should exist independently of a portal parent account (recommended yes).
- Which CRM-only staff roles are needed (recommended: sales agent, sales manager, CRM admin; fine-grained permission scopes rather than new global role).
- Exact account-wide and child-data retention policies and authorized guardian contacts.
- Whether future multiple *independent* legal businesses must be separated; don't add SaaS tenant boundaries without requirement.

## Status
Architecture design only. GitHub branch dedicated. Live DEV DB query timed out in prior checks; no live schema comparison performed. No code, database, production, merge or deployment changes.
