CREATE OR REPLACE FUNCTION public.saas_authorized_module_entitlements(p_actor_id uuid,p_organization_id uuid)
RETURNS TABLE(module_key text,enabled boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $function$
 SELECT e.module_key,e.enabled
 FROM saas.module_entitlements e
 JOIN saas.organizations o ON o.id=e.organization_id
 WHERE e.organization_id=p_organization_id AND o.status='active'
 AND EXISTS(
   SELECT 1 FROM saas.memberships m
   WHERE m.organization_id=e.organization_id AND m.user_id=p_actor_id AND m.status='active'
 );
$function$;
REVOKE ALL ON FUNCTION public.saas_authorized_module_entitlements(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.saas_authorized_module_entitlements(uuid,uuid) TO service_role;