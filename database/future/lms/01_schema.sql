-- FUTURE MODULE LMS — BASE CANONICAL DDL
-- FUTURE DESIGN ONLY. Never run in active Release 1 installer.
-- Dependencies documented in database/future/manifest.json.
CREATE SCHEMA IF NOT EXISTS lms;
REVOKE ALL ON SCHEMA lms FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA lms TO service_role;
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

-- DENY BY DEFAULT: no anon/authenticated table grants.
ALTER TABLE lms.course_modules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE lms.course_modules FROM PUBLIC, anon, authenticated;
ALTER TABLE lms.lessons ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE lms.lessons FROM PUBLIC, anon, authenticated;
ALTER TABLE lms.lesson_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE lms.lesson_versions FROM PUBLIC, anon, authenticated;
ALTER TABLE lms.content_assets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE lms.content_assets FROM PUBLIC, anon, authenticated;
ALTER TABLE lms.lesson_progress ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE lms.lesson_progress FROM PUBLIC, anon, authenticated;
ALTER TABLE lms.submission_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE lms.submission_links FROM PUBLIC, anon, authenticated;
