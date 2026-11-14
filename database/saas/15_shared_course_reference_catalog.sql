-- Phase 3B: classify existing global course definitions as reusable reference templates.
-- Keeps public.courses and existing organization-owned course links unchanged.
-- Template availability never grants access to a tenant-owned course record.
BEGIN;
CREATE TABLE IF NOT EXISTS saas.academy_course_templates (
 course_id uuid PRIMARY KEY REFERENCES public.courses(id) ON DELETE RESTRICT,
 catalog_key text NOT NULL UNIQUE CHECK (catalog_key ~ '^[A-Z0-9-]{3,80}$'),
 availability text NOT NULL DEFAULT 'available' CHECK (availability IN ('available','retired')),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE saas.academy_course_templates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON saas.academy_course_templates FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON saas.academy_course_templates TO service_role;
-- Only verified seed catalog entries with RTX codes and no tenant ownership
-- may enter the global catalog. Other records remain unclassified.
INSERT INTO saas.academy_course_templates(course_id,catalog_key)
SELECT c.id,c.code FROM public.courses c
WHERE c.code ~ '^RTX-[A-Z0-9-]+$'
 AND NOT EXISTS(SELECT 1 FROM saas.academy_courses a WHERE a.course_id=c.id)
ON CONFLICT (course_id) DO NOTHING;
-- Re-run safety: do not silently make an organization-owned course global.
DO $guard$ BEGIN
 IF EXISTS(SELECT 1 FROM saas.academy_course_templates t
  JOIN saas.academy_courses a ON a.course_id=t.course_id) THEN
  RAISE EXCEPTION 'A global course template also has exclusive tenant ownership';
 END IF;
END $guard$;
COMMIT;
