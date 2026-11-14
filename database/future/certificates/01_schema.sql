-- FUTURE MODULE CERTIFICATES — BASE CANONICAL DDL
-- FUTURE DESIGN ONLY. Never run in active Release 1 installer.
-- Dependencies documented in database/future/manifest.json.
CREATE SCHEMA IF NOT EXISTS certificates;
REVOKE ALL ON SCHEMA certificates FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA certificates TO service_role;
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

-- DENY BY DEFAULT: no anon/authenticated table grants.
ALTER TABLE certificates.templates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE certificates.templates FROM PUBLIC, anon, authenticated;
ALTER TABLE certificates.credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE certificates.credentials FROM PUBLIC, anon, authenticated;
ALTER TABLE certificates.credential_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE certificates.credential_events FROM PUBLIC, anon, authenticated;
