# Education Suite — Future Domain Data Model (Design Contracts, NOT executable SQL)

**Purpose:** freeze stable relationships and ownership now so LMS, Assessments, Gamification, Certificates, AI, Analytics and Operations can be built later without replacing Academy/CRM/Tasks identities.

**Scope:** conceptual models. They are not approved migrations or promises that requirements are final. Existing `public.courses`, `public.students`, `public.enrollments`, `public.quizzes`, `public.quiz_attempts`, `public.xp_transactions`, and existing project/progress records are the current baseline and must not be duplicated.

## Shared identifiers and tenancy

- `organization_id` (UUID) is the intended institution-level owner for all organisation-owned future records. It must eventually map to the existing CRM tenant, Academy organisation context, and Tasks workspace where appropriate, **without assuming those IDs mean the same thing today**.
- `student_id` references existing Academy student identity. Do not create an alternate LMS or gamification student table.
- `enrollment_id` links learning participation and progress to an actual Academy course enrollment. Multiple enrollments per student are valid.
- `user_id` references Supabase Auth for operators and participants who have logins. A student record need not imply an authenticated user.
- All collection-specific keys are UUID; external provider IDs are stored separately and never serve as tenant authority.
- Whenever an entity links two owned objects, verify both belong to the same organization; a foreign key by ID alone does not enforce tenant alignment.

## Curriculum / LMS

| Logical entity | Critical fields | Integrity and tenancy rules |
|---|---|---|
| `learning_program_versions` | id, org_id, course_id, version, status, published_at | unique(org_id,course_id,version); published versions immutable |
| `learning_modules` | id, program_version_id, title, order_index | unique(program_version_id,order_index) |
| `learning_lessons` | id, module_id, content_ref, delivery_mode, order_index | unique(module_id,order_index); content reference not secret inline HTML |
| `learning_enrollment_progress` | enrollment_id, lesson_id, status, completed_at, recorded_by | unique(enrollment_id,lesson_id); verify enrollment-course compatibility |
| `learning_assignments` | id, lesson_id, rubric_id, due_policy, version | assignment version remains stable for submissions |
| `learning_submissions` | id, assignment_id, enrollment_id, submitted_at, artifact_refs | append revisions; submitted artifact ACL follows learner/guardian/trainer |

Current course, project and quiz infrastructure may already satisfy some of these concepts. Map and reuse it before implementing new tables.

## Assessment and skills

| Logical entity | Critical fields | Integrity and tenancy rules |
|---|---|---|
| `skills` | id, org_id, stable_code, name, parent_skill_id | unique(org_id,stable_code); cycle-safe hierarchy |
| `rubric_versions` | id, org_id, rubric_code, version, criteria_json | unique(org_id,rubric_code,version); immutable when used |
| `assessment_definitions` | id, lesson_id, rubric_version_id, version | immutable once attempts exist |
| `assessment_attempts` | id, assessment_id, enrollment_id, attempt_no, submitted_at, score | unique(assessment_id,enrollment_id,attempt_no); parent access scoped |
| `skill_evidence` | id, skill_id, enrollment_id, source_type, source_id, verified_by | source-backed claims, audit corrections rather than silent overwrites |
| `mastery_snapshots` | enrollment_id, skill_id, level, evaluated_at, model_version | derived, recomputable projection, not authoritative evidence |

Prefer adapting `public.quizzes`, `public.quiz_attempts`, and `public.learning_observations` rather than creating parallel assessments without a verified migration plan.

## Gamification

| Logical entity | Critical fields | Integrity and tenancy rules |
|---|---|---|
| `achievement_definitions` | id, org_id, code, rule_version, visibility | unique(org_id,code,rule_version); published rules versioned |
| `achievement_awards` | id, definition_id, student_id, source_event_key, awarded_at | unique(definition_id,student_id,source_event_key); prevent double awards |
| `xp_ledger` | id, student_id, org_id, event_key, delta, reason, occurred_at | unique(org_id,event_key); append-only and reversible with compensating events |
| `challenges` | id, org_id, window, participation_rules, status | eligibility by enrollment and consent |
| `challenge_completions` | challenge_id, student_id, evidence_id | unique(challenge_id,student_id) if one completion allowed |
| `streak_snapshots` | student_id, org_id, as_of_date, streak_count | derived metric; timezone-aware; never punitive |
| `leaderboard_views` | org_id, scope, season, consent_filter | opt-in visibility; avoid publishing identifiable child rankings by default |

`public.xp_transactions` is an existing ledger; reconcile its semantics and historical transactions before adopting any new `xp_ledger`.

## Certificates and portfolio

| Logical entity | Fields | Integrity |
|---|---|---|
| `certificate_templates` | id, org_id, version, design_ref | frozen template version per issued certificate |
| `issued_certificates` | id, student_id, enrollment_id, template_id, issue_no, verification_hash, issued_at, revoked_at | unique(org_id,issue_no); revocation audit; public verifier exposes minimal data |
| `portfolio_entries` | id, student_id, project_id, visibility, approved_by | explicit parent/student permissions and moderation |
| `portfolio_artifacts` | id, entry_id, storage_ref, mime_type, scan_status | signed access; no public storage bucket by default |

Current `public.learner_projects` and `public.project_submissions` remain authoritative until adapted.

## Finance extension and billing

- `fee_agreements`: per-enrollment effective-dated fee terms, billing cadence and currency; preserve rolling monthly plans with no unjustified outstanding balance.
- `invoice_lines`: immutable signed amounts, tax metadata, currency and applicable export/GST rule version.
- `payment_intents` and `provider_events`: provider idempotency keys and verified payment state.
- `payment_allocations`: one payment may settle multiple invoices, one invoice may have multiple payments; distinguish unapplied advances.
- `credit_notes` and `refunds`: explicit reasons, reconciled sums, never mutate settled history.
- `trainer_payroll_runs`: effective-dated compensation plans and immutable approved payout records.
- Preserve current `public.student_invoices`, `public.student_fee_payments`, `public.student_family_receipts`, `public.trainer_earnings`, `public.trainer_payouts` until historical reconciliation proves an alternative.

## AI, automation and audit

| Logical entity | Fields | Protection |
|---|---|---|
| `automation_definitions` | org_id, code, trigger, version, enabled | owner/administrator approval |
| `automation_runs` | id, org_id, definition_version, input_ref, status, idempotency_key | unique(org_id,idempotency_key); queued retries |
| `ai_assistant_sessions` | id, org_id, user_id, scope, created_at | explicit scoped access; do not expose other tenants |
| `ai_action_proposals` | id, actor_id, proposed_action, target_ref, approval_state | human approval for external messages, enrollment changes or financial actions |
| `ai_usage_events` | org_id, model, tokens, cost, consent_basis, created_at | minimise data, organisation quotas and retention limits |
| `audit_events` | org_id, actor_id, object_ref, event_type, before_hash, after_hash | protected append-only logs |

Never grant an agent service-role access without an actor/organisation enforcement layer.

## Analytics

Use derived materialised or asynchronously maintained **read models** based on authoritative facts, not duplicate writable financial truth. Define `report_snapshots` by org, report, period, version, created_at. Preserve source-event references and recomputation capability. Cross-organisation benchmarking requires explicit privacy aggregation standards.

## Multi-branch / resources

- `branches`: unique(org_id,branch_code); geographic/timezone metadata; not a substitute for org tenancy.
- `staff_branch_assignments`: effective-dated staff rights.
- `rooms`, `equipment_assets`, `inventory_movements`, `resource_reservations`: availability periods, audit and overlap prevention.
- Existing `public.delivery_centers` may be reused; inspect identifiers and assignments first.

## Cross-cutting acceptance rules

1. Organisation owner/role decisions must be tested separately from trainer/guardian/CRM/Tasks permissions.
2. All new links use explicit, idempotent bridge records; no implicit joining by email alone.
3. Every new API and RPC has role and cross-tenant negative tests.
4. Every financial and gamification event uses an idempotency key and preserves compensating history.
5. Future module SQL is not released until data rules, migration mapping, RLS policy and clean-install tests are approved.
