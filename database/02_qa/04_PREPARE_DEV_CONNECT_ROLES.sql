-- DEVELOPMENT-ONLY synthetic Connect CRM QA role fixture.
-- Run after 01_PREPARE_DEV_QA_PROFILES.sql. Never run in production.
-- Reuses the existing eight QA Auth identities; does not touch passwords.
-- The QA Portal admin-2 identity also acts as CRM counsellor; the QA
-- Portal trainer-2 identity also acts as CRM viewer for cross-app testing.
-- This deliberately does not synthesize a confirmed admission handoff:
-- confirmation must be exercised through the real Phase C workflow.

BEGIN;

DO $$
BEGIN
  IF (SELECT count(*) FROM connect.tenants) <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one Development Connect workspace';
  END IF;
  IF (SELECT count(*) FROM auth.users
      WHERE lower(email) IN ('qa-admin-2@robotronix.local',
                             'qa-trainer-2@robotronix.local')) <> 2 THEN
    RAISE EXCEPTION 'Required Development QA Auth identities missing';
  END IF;
END $$;

INSERT INTO connect.memberships (tenant_id, user_id, role, status)
SELECT t.id, u.id, v.crm_role, 'active'
FROM connect.tenants t
CROSS JOIN (VALUES
  ('qa-admin-2@robotronix.local', 'counsellor'),
  ('qa-trainer-2@robotronix.local', 'viewer')
) AS v(email, crm_role)
JOIN auth.users u ON lower(u.email) = v.email
ON CONFLICT (tenant_id, user_id) DO UPDATE
  SET role = EXCLUDED.role, status = EXCLUDED.status
  WHERE connect.memberships.role IN ('counsellor', 'viewer');

DO $$
BEGIN
  IF (SELECT count(*) FROM connect.memberships m
      JOIN auth.users u ON u.id = m.user_id
      WHERE m.status = 'active' AND (
        (lower(u.email) = 'qa-admin-2@robotronix.local' AND m.role = 'counsellor') OR
        (lower(u.email) = 'qa-trainer-2@robotronix.local' AND m.role = 'viewer')
      )) <> 2 THEN
    RAISE EXCEPTION 'CRM QA membership verification failed';
  END IF;
END $$;

COMMIT;
