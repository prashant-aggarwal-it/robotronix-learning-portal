-- Private SaaS membership projection for authenticated server-side callers.
-- Do not expose the saas schema in PostgREST; this function is service-role only.
BEGIN;
CREATE OR REPLACE FUNCTION public.saas_authorized_organizations(p_actor_id uuid)
RETURNS TABLE(organization_id uuid,slug text,display_name text,role_key text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $body$
 SELECT o.id,o.slug,o.display_name,m.role_key
 FROM saas.memberships m
 JOIN saas.organizations o ON o.id=m.organization_id
 WHERE m.user_id=p_actor_id AND m.status='active' AND o.status='active'
 ORDER BY o.display_name,o.id;
$body$;
REVOKE ALL ON FUNCTION public.saas_authorized_organizations(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.saas_authorized_organizations(uuid) TO service_role;
COMMIT;
