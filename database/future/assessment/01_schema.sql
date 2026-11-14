-- FUTURE MODULE ASSESSMENT — BASE CANONICAL DDL
-- FUTURE DESIGN ONLY. Never run in active Release 1 installer.
-- Dependencies documented in database/future/manifest.json.
CREATE SCHEMA IF NOT EXISTS assessment;
REVOKE ALL ON SCHEMA assessment FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA assessment TO service_role;
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

-- DENY BY DEFAULT: no anon/authenticated table grants.
ALTER TABLE assessment.question_banks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE assessment.question_banks FROM PUBLIC, anon, authenticated;
ALTER TABLE assessment.questions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE assessment.questions FROM PUBLIC, anon, authenticated;
ALTER TABLE assessment.question_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE assessment.question_versions FROM PUBLIC, anon, authenticated;
ALTER TABLE assessment.assessments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE assessment.assessments FROM PUBLIC, anon, authenticated;
ALTER TABLE assessment.assessment_questions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE assessment.assessment_questions FROM PUBLIC, anon, authenticated;
ALTER TABLE assessment.attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE assessment.attempts FROM PUBLIC, anon, authenticated;
ALTER TABLE assessment.responses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE assessment.responses FROM PUBLIC, anon, authenticated;
