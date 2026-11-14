-- Phase 3B: revoked users must never lose restrictive RLS solely because all
-- active SaaS membership rows have been removed. Permanent marker guards fallback.
BEGIN;
CREATE OR REPLACE FUNCTION saas.has_organization_membership()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $fn$
 SELECT auth.uid() IS NOT NULL AND (
  EXISTS(SELECT 1 FROM saas.memberships WHERE user_id=auth.uid())
  OR EXISTS(SELECT 1 FROM saas.user_membership_history WHERE user_id=auth.uid())
 );
$fn$;
REVOKE ALL ON FUNCTION saas.has_organization_membership() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION saas.has_organization_membership() TO authenticated,service_role;
COMMIT;
