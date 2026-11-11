> **Historical design (superseded 2026-11-05).** This document describes the former Portal-coupled CRM prototype and is retained as design history only. The current standalone multi-tenant Connect architecture is documented in [SAAS_ARCHITECTURE_DECISION.md](SAAS_ARCHITECTURE_DECISION.md). Do not implement or apply migrations from this historical specification.

# Robotronix Connect — Architecture Audit & Implementation Gate

Date: 2026-11-05
Branch: `feature/robotronix-connect-crm`
Source baseline: `main` @ `d6d1418f2c868d9e1d016df6289ffbabbe6e262f`

## Scope and constraints
- No real customer data is live yet. Large schema changes are acceptable if they preserve application behavior and migration reproducibility.
- This development stays on the dedicated Connect branch. Never merge to `main` or deploy without explicit approval.
- Development Supabase is the target for eventual migration and QA; production is out of scope.
- A Git branch does **not** isolate a shared Supabase database. Never apply in-progress CRM DDL to the production DB.
- Live Development DB inspection is **blocked**: both `list_tables` and small read-only `execute_sql` calls failed with connection timeout. Source SQL findings are not proof of deployed schema.
- Latest portal fix branches may diverge from `main`. Reconcile with user-approved changes before touching overlapping files.

## Verified in repository `main`
- Stack: Next.js 16, React, TypeScript, Supabase; Zoom + Razorpay; Playwright QA scripts.
- `public.demo_leads` has one row with both parent and child fields, source, status, admin note. Its statuses are `new, contacted, demo_scheduled, demo_completed, follow_up, converted, lost`.
- `public.demo_sessions` and `public.demo_session_participants` support multi-participant sessions, trainer feedback, guest tokens, recommendation and `converted_student_id`.
- Demo APIs: `app/api/admin/demos/route.ts`, `app/api/demo/[token]/route.ts`, `app/api/demo/[token]/onboarding-prefill/route.ts`.
- Student intake is handled separately by `onboarding_submissions`; portal has `parents`, `students`, `student_guardians`, `enrollments`, `courses`.
- `family_introductions` tracks referrals.
- `lib/server/admin-api.ts` enforces active admin role, not granular CRM salesperson capability.
- Existing admin demos screen, trainer demos, portal messages/notifications, audit, operational alerts, system logs, invoices and Razorpay webhook are potential integration points.

## Decision: prospective customer domain
Avoid trying to grow `demo_leads` into an all-purpose contact table or duplicating portal parent auth records for prospects.

Proposed bounded model (names provisional):
1. `crm_contacts`: adults/business contacts, normalized identifiers, source and consent; no auth requirement for prospect.
2. `crm_contact_methods`: phone/WhatsApp/email handles with verified/provider identifiers where appropriate.
3. `crm_organizations` + `crm_organization_contacts`: schools and institutional prospect relationships.
4. `crm_prospective_learners`: minimum child information, linked to responsible adult contacts.
5. `crm_opportunities`: distinct course/school/kit sale, status, stage, owner, value, attribution, next action.
6. `crm_activities`, `crm_tasks`, `crm_stage_history`: append-only history and actionable ownership.
7. `crm_conversations`, `crm_messages`, `crm_channel_accounts`, `crm_webhook_events`: channel-specific integration with idempotency.
8. `crm_attribution_touchpoints`, `crm_consent_events`: source and permission history.
9. `crm_portal_links`: explicit mappings to existing demo lead, parent, learner, onboarding and enrollment IDs.

Use one canonical contact per adult, not one new contact per WhatsApp message or child. Same parent may have two children, several opportunities, and school affiliation.

## Integration approach
- Retain `demo_sessions` and `demo_session_participants`; link an opportunity to the existing demo lead and session/participant where feasible.
- Preserve guest links, participant assessments, trainer outcomes, recommended course and `converted_student_id`.
- Avoid duplicate trial scheduling implementation.
- Reuse the portal course catalogue and existing onboarding and invoice logic rather than creating new independent versions.
- Store channel events as immutable webhook receipts; process once with provider message/event uniqueness.
- Lead conversion should be idempotent and create/link the correct family and enrollment only once.
- Use fine-grained `crm.read`, `crm.write`, `crm.manage`, `crm.inbox` staff privileges rather than granting blanket `admin` authority. Enforce server-side and database authorization.
- Keep guardian contact data separate from trainer-visible learner records.
- Retain original lead source, capture subsequent touches; don't overwrite attribution.
- Start with manually logged phone calls and website intake, then connect API channels after consent/provider compatibility validation.
- Keep the current WhatsApp Business number untouched until WA Simple, coexistence and provider event constraints are verified.

## Recommended development sequence
0. Unblock live DEV schema read access; inspect actual columns, FKs, RLS, policies, migrations and views. Compare source installer versus deployed schema. Record row counts only (no personal data export).
1. Reconcile unmerged portal branches and identify overlapping files. Protect latest fixes.
2. Produce reviewed SQL migrations in repository; additive compatibility-first evolution and backfill of existing demo leads. Do not remove existing tables in v1.
3. Build contacts, learners, opportunities, tasks, activity timeline, quick-add, dashboard, pipeline.
4. Integrate trials and onboarding; validate once-only conversion and audit logs.
5. Website form and channel adapters; secure webhooks, retries, outbound consent.
6. Cross-role permissions, RLS/security advisors, regression tests, dev QA, rollback review.
7. No production promotion or main merge without explicit instruction.

## Acceptance scenarios
- Parent with two children and two opportunities retains one canonical adult contact.
- Repeat enquiry via phone and WhatsApp attaches to existing contact.
- Duplicate webhook events do not duplicate messages or leads.
- A trial can be rescheduled without duplicate scheduled classes or broken guest links.
- Trial completion preserves feedback and recommendations; conversion links exactly one learner/enrollment.
- Existing portal demos, onboarding, finance, Zoom and role-based access pass regression tests.
- Sales-only user cannot access private student records or administrative finance.
- Follow-up queue detects unowned and overdue work; closed/lost leads do not get promotional reminders.
- Contact preferences/opt-outs prevent inappropriate outbound messaging.
- DEV-only schema rollout is repeatable on a fresh test installation and reversible by reviewed recovery plan.

## Current status
Repository/source audit completed for principal integration points. Live Dev schema not yet verified because of connector query timeouts. No application code changes, schema writes, merges or deployments were performed in this audit.
