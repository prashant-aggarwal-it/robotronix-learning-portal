# Robotronix Connect — Standalone SaaS Architecture Decision (2026-11-05)

## Product objective and boundary
Robotronix Connect is a **standalone multi-institute CRM and admissions SaaS**, suitable for independent academies, coaching institutes, training centres, STEM businesses and schools. The Robotronix Learning Portal is an OPTIONAL integration and never a schema dependency. A customer can subscribe to either product independently or use both.

**Current design:** one independent Connect application with an independent database/project for commercial rollout; a modular-monolith Next.js backend; Supabase Auth + PostgreSQL; secure, versioned HTTP/webhook integration contracts. During architectural development the schema is installed in the existing **Development** Supabase project, in its own private `connect` schema; this is NOT yet an independent deployed Connect database/app.

## Data ownership rules
- **Tenant:** an institute workspace with isolation, timezone, currency and lifecycle. Every business record belongs to a tenant. Global plans are deliberately not tenant-scoped.
- **Membership:** Connect staff login identity (`auth.users` of its own project), role, tenant and active/disabled state. No reference to Portal `public.profiles`.
- **People:** per-tenant canonical identity; contact methods are unique only per person/kind, because phone/email can legitimately be shared by family members.
- **Households, person relations, organizations:** preserve family/guardian/learner/institute relationships; no hardcoded parents/students coupling.
- **Programs, pipeline and opportunities:** independent institute-offered programs, configurable pipeline stages, relationships to interested people.
- **Tasks, activities, appointments:** native CRM sales and admissions operations; no Portal scheduler dependency.
- **Channels, conversations, messages, webhook receipts, outbox, inquiries:** provider-independent integrations, idempotency and message history. Provider OAuth/credentials must be stored securely outside these public business columns.
- **Consent, attribution, audit:** meaningful append-only history, attribution and observability.
- **External integration connections/links:** external IDs map business records via contracts, never direct cross-product foreign keys.
- **Plans, entitlements, subscriptions:** optional SaaS commercial model without hard-coded INR plan pricing or dependence on Portal finance. The billing/payment provider and invoice ledger are future modules.

## Implemented today — verified in Development
1. Applied `connect_saas_v2_independent_foundation_20261105`, creating **34 `connect.*` tables**.
2. Preflight verified all **28 `public.crm_*` prototype tables empty**. Removed them with a transactional RESTRICT-only cleanup migration `retire_empty_crm_prototype_20261105`; no CASCADE was used.
3. Confirmed existing **80 Portal public tables remain**, old CRM prototype tables 0, and no Connect FK references Portal tables.
4. All 34 Connect tables have RLS enabled, with no `anon`/`authenticated` direct schema/table access. Server service-role access only. Full tenant membership policies and server authorization still need implementation/test.
5. Two-tenant rollback test verified cross-tenant contact relationships rejected by composite foreign keys; invalid stage FK rejected. No test records retained.
6. Removed standalone CRM module from Portal's canonical fresh-install sequence. Standalone installation source: `database/connect/saas/01_connect_independent_schema.sql`.

## Design decisions / deliberate tradeoffs
- Use **shared-schema, tenant-keyed multi-tenancy** rather than one PostgreSQL schema per customer. Every related record includes tenant scope and composite tenant-aware keys where relationships are tenant-owned.
- Start with server-only APIs and deny direct client DB reads until tenant-scoped authorization has been reviewed. **Service role bypasses RLS**, so each API must authenticate, validate membership/permission and enforce tenant-scoped queries.
- Maintain the Learning Portal's current data master independently until integration contracts and identity matching are implemented; the products do not share database FKs.
- Snapshot/historical enrollment, payments, messages and invoices can legitimately preserve original facts without violating canonical identity design.
- The prototype DDL remains visible in Git history / Development migration history but is **not** part of current installation sources.

## Release-blocking work (NOT yet complete)
**Schema correctness** — review semantics and constraints of relationships, stage-history transitions, contact dedupe, event outbox, provider identifier uniqueness, external link integrity, audit immutability, indexing and lifecycle / privacy retention.
**Authorization** — authenticated membership enforcement, tenant isolation tests for all read/write endpoints, role/permission matrix, staff invitation lifecycle, malicious cross-tenant-ID tests.
**Integration/API** — versioned endpoints, event and webhook contracts, idempotent conversion and robust retry behavior. No direct Portal links.
**SaaS infrastructure** — separate Connect Dev/Prod Supabase projects, independent Auth setup and tenant bootstrapping, secrets management, deployment pipeline and backups.
**Fresh install/QA** — execute new schema in an *empty separate Supabase project*, test schema bootstrap, application build, Playwright end-to-end and tenant isolation suites.
**Portal safety** — existing Portal functionality preserved at database schema level, but its full runtime regression suite has not been executed in this session.

## Near-term implementation order
1. Finalize and test independent tenant authorization (no `service_role` trust by accident).
2. Strengthen the canonical schema and integrity checks; remove design ambiguities early.
3. Add test fixtures and fresh installation verification in an isolated Connect database.
4. Implement minimal production-grade backend flows: institute onboarding, people/households, pipeline, task queue, trial appointments.
5. Implement UI and standard API/webhook integration contract.
6. Add channels/provider adapters only when API permissions and testing are proven.
7. Portal Connect adapter as first integration, preserving standalone functionality.
8. Subscription enforcement, imports/exports, analytics, performance and release hardening.

## Release policy
No merge to `main`, no Production database changes, no deploy until user approval. This architecture foundation is **implemented**; the complete commercial SaaS product is **not** implemented yet.
