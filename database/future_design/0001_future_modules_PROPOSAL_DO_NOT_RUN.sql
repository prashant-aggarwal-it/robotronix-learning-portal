-- ROBOTRONIX FUTURE MODULES — DESIGN DRAFT ONLY.
-- DO NOT execute on DEV or PROD. NOT part of Release 1 packages.
-- Relational proposals, pending security tests and migration approval.
-- Column names on existing referenced tables verified via DEV catalog.
CREATE SCHEMA IF NOT EXISTS platform;
CREATE SCHEMA IF NOT EXISTS lms;
CREATE SCHEMA IF NOT EXISTS assessment;
CREATE SCHEMA IF NOT EXISTS gamification;
CREATE SCHEMA IF NOT EXISTS certificates;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS ai;
CREATE SCHEMA IF NOT EXISTS operations;

CREATE TABLE platform.organizations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text NOT NULL UNIQUE,
 name text NOT NULL, status text NOT NULL DEFAULT 'active'
 CHECK (status IN ('active','suspended','archived')), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE platform.memberships (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES platform.organizations(id),
 user_id uuid NOT NULL REFERENCES auth.users(id),
 role_key text NOT NULL, status text NOT NULL DEFAULT 'active',
 UNIQUE(organization_id,user_id,role_key)
);
CREATE TABLE platform.identity_links (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES platform.organizations(id),
 source_module text NOT NULL, source_id uuid NOT NULL,
 target_module text NOT NULL, target_id uuid NOT NULL,
 verified_at timestamptz, UNIQUE(source_module,source_id,target_module,target_id)
);
CREATE TABLE platform.module_entitlements (
 organization_id uuid NOT NULL REFERENCES platform.organizations(id),
 module_key text NOT NULL, enabled boolean NOT NULL DEFAULT false,
 PRIMARY KEY(organization_id,module_key)
);
CREATE TABLE platform.domain_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid REFERENCES platform.organizations(id),
 source_module text NOT NULL, aggregate_type text NOT NULL, aggregate_id uuid NOT NULL,
 event_type text NOT NULL, event_version integer NOT NULL DEFAULT 1,
 idempotency_key text NOT NULL UNIQUE, payload jsonb NOT NULL DEFAULT '{}'::jsonb,
 recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE platform.event_deliveries (
 event_id uuid NOT NULL REFERENCES platform.domain_events(id),
 subscriber_key text NOT NULL, attempts integer NOT NULL DEFAULT 0,
 status text NOT NULL DEFAULT 'pending', next_attempt_at timestamptz,
 PRIMARY KEY(event_id,subscriber_key)
);
CREATE TABLE lms.course_modules (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), course_id uuid NOT NULL REFERENCES public.courses(id),
 title text NOT NULL, position integer NOT NULL, UNIQUE(course_id,position)
);
CREATE TABLE lms.lessons (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), module_id uuid NOT NULL REFERENCES lms.course_modules(id),
 slug text NOT NULL, title text NOT NULL, UNIQUE(module_id,slug)
);
CREATE TABLE lms.lesson_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), lesson_id uuid NOT NULL REFERENCES lms.lessons(id),
 version_no integer NOT NULL CHECK(version_no>0), body jsonb NOT NULL DEFAULT '{}'::jsonb,
 published_at timestamptz, UNIQUE(lesson_id,version_no)
);
CREATE TABLE lms.content_assets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), lesson_version_id uuid NOT NULL REFERENCES lms.lesson_versions(id),
 storage_key text NOT NULL, media_type text NOT NULL
);
CREATE TABLE lms.lesson_progress (
 enrollment_id uuid NOT NULL REFERENCES public.enrollments(id),
 lesson_id uuid NOT NULL REFERENCES lms.lessons(id), state text NOT NULL,
 completed_at timestamptz, PRIMARY KEY(enrollment_id,lesson_id)
);
CREATE TABLE lms.submission_links (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), lesson_id uuid NOT NULL REFERENCES lms.lessons(id),
 existing_submission_id uuid NOT NULL REFERENCES public.project_submissions(id),
 UNIQUE(lesson_id,existing_submission_id)
);
CREATE TABLE assessment.question_banks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), course_id uuid REFERENCES public.courses(id),
 title text NOT NULL
);
CREATE TABLE assessment.questions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bank_id uuid NOT NULL REFERENCES assessment.question_banks(id),
 kind text NOT NULL, status text NOT NULL DEFAULT 'draft'
);
CREATE TABLE assessment.question_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), question_id uuid NOT NULL REFERENCES assessment.questions(id),
 version_no integer NOT NULL, prompt jsonb NOT NULL, scoring jsonb NOT NULL DEFAULT '{}'::jsonb,
 UNIQUE(question_id,version_no)
);
CREATE TABLE assessment.assessments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), course_id uuid NOT NULL REFERENCES public.courses(id),
 title text NOT NULL, published_at timestamptz
);
CREATE TABLE assessment.assessment_questions (
 assessment_id uuid NOT NULL REFERENCES assessment.assessments(id),
 question_version_id uuid NOT NULL REFERENCES assessment.question_versions(id),
 position integer NOT NULL, PRIMARY KEY(assessment_id,question_version_id),
 UNIQUE(assessment_id,position)
);
CREATE TABLE assessment.attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), assessment_id uuid NOT NULL REFERENCES assessment.assessments(id),
 student_id uuid NOT NULL REFERENCES public.students(id),
 attempt_number integer NOT NULL CHECK(attempt_number>0),
 submitted_at timestamptz, UNIQUE(assessment_id,student_id,attempt_number)
);
CREATE TABLE assessment.responses (
 attempt_id uuid NOT NULL REFERENCES assessment.attempts(id),
 question_version_id uuid NOT NULL REFERENCES assessment.question_versions(id),
 response jsonb NOT NULL, score numeric, PRIMARY KEY(attempt_id,question_version_id)
);
CREATE TABLE gamification.award_rules (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE,
 points integer NOT NULL, enabled boolean NOT NULL DEFAULT true
);
CREATE TABLE gamification.xp_awards (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), student_id uuid NOT NULL REFERENCES public.students(id),
 award_rule_id uuid NOT NULL REFERENCES gamification.award_rules(id),
 source_event_id uuid NOT NULL UNIQUE, awarded_at timestamptz NOT NULL DEFAULT now(),
 legacy_xp_transaction_id uuid UNIQUE REFERENCES public.xp_transactions(id)
);
CREATE TABLE gamification.badges (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE, title text NOT NULL
);
CREATE TABLE gamification.badge_awards (
 student_id uuid NOT NULL REFERENCES public.students(id),
 badge_id uuid NOT NULL REFERENCES gamification.badges(id),
 awarded_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(student_id,badge_id)
);
CREATE TABLE gamification.streak_state (
 student_id uuid PRIMARY KEY REFERENCES public.students(id), streak_days integer NOT NULL DEFAULT 0,
 last_qualified_date date
);
CREATE TABLE certificates.templates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, template_version integer NOT NULL,
 layout jsonb NOT NULL, UNIQUE(name,template_version)
);
CREATE TABLE certificates.credentials (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), template_id uuid NOT NULL REFERENCES certificates.templates(id),
 student_id uuid NOT NULL REFERENCES public.students(id),
 enrollment_id uuid REFERENCES public.enrollments(id),
 verification_token_hash text NOT NULL UNIQUE, issued_at timestamptz NOT NULL DEFAULT now(),
 revoked_at timestamptz
);
CREATE TABLE certificates.credential_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), credential_id uuid NOT NULL REFERENCES certificates.credentials(id),
 event_type text NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE analytics.metric_definitions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), metric_key text NOT NULL UNIQUE,
 description text NOT NULL, source_module text NOT NULL
);
CREATE TABLE analytics.metric_snapshots (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 metric_id uuid NOT NULL REFERENCES analytics.metric_definitions(id),
 organization_id uuid REFERENCES platform.organizations(id),
 bucket_start timestamptz NOT NULL, metric_value numeric NOT NULL,
 calculated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE analytics.refresh_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), started_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz, status text NOT NULL
);
CREATE TABLE ai.agents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid REFERENCES platform.organizations(id),
 name text NOT NULL, enabled boolean NOT NULL DEFAULT false
);
CREATE TABLE ai.prompt_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), agent_id uuid NOT NULL REFERENCES ai.agents(id),
 version_no integer NOT NULL, prompt_template text NOT NULL, UNIQUE(agent_id,version_no)
);
CREATE TABLE ai.conversations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), agent_id uuid NOT NULL REFERENCES ai.agents(id),
 initiated_by uuid NOT NULL REFERENCES auth.users(id), started_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ai.tool_grants (
 agent_id uuid NOT NULL REFERENCES ai.agents(id), tool_key text NOT NULL,
 requires_approval boolean NOT NULL DEFAULT true, PRIMARY KEY(agent_id,tool_key)
);
CREATE TABLE ai.executions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id uuid NOT NULL REFERENCES ai.conversations(id),
 tool_key text, approved_by uuid REFERENCES auth.users(id),
 status text NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ai.usage_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), execution_id uuid NOT NULL REFERENCES ai.executions(id),
 tokens_in integer NOT NULL DEFAULT 0, tokens_out integer NOT NULL DEFAULT 0,
 estimated_cost numeric NOT NULL DEFAULT 0
);
CREATE TABLE operations.facilities (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid REFERENCES platform.organizations(id),
 legacy_center_id uuid UNIQUE REFERENCES public.delivery_centers(id), name text NOT NULL
);
CREATE TABLE operations.equipment (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), facility_id uuid NOT NULL REFERENCES operations.facilities(id),
 asset_tag text NOT NULL UNIQUE, equipment_type text NOT NULL
);
CREATE TABLE operations.stock_movements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), equipment_id uuid NOT NULL REFERENCES operations.equipment(id),
 quantity_delta integer NOT NULL CHECK(quantity_delta<>0),
 occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE operations.allocations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), equipment_id uuid NOT NULL REFERENCES operations.equipment(id),
 assigned_user_id uuid REFERENCES auth.users(id), allocated_at timestamptz NOT NULL DEFAULT now(),
 returned_at timestamptz
);
CREATE TABLE operations.maintenance_work_orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), equipment_id uuid NOT NULL REFERENCES operations.equipment(id),
 status text NOT NULL DEFAULT 'open', created_at timestamptz NOT NULL DEFAULT now()
);
-- SECURITY HOLD: new exposed schemas must be unexposed and have RLS, grants and behavioral tests
-- before any deployment. This is entity modeling syntax, not a deployable migration.
