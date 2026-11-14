-- Phase 3B: limited read model for shared reusable course templates.
-- Privileged service RPC; the caller's bearer and selected organization are validated at API layer
-- and checked again here to prevent arbitrary actor impersonation.
BEGIN;
CREATE OR REPLACE FUNCTION public.saas_academy_available_templates(
 p_actor_id uuid,p_organization_id uuid
) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $fn$
 SELECT CASE WHEN EXISTS(
  SELECT 1 FROM saas.memberships m JOIN saas.organizations o ON o.id=m.organization_id
   JOIN saas.module_entitlements e ON e.organization_id=o.id AND e.module_key='academy'
  WHERE m.user_id=p_actor_id AND m.organization_id=p_organization_id
   AND m.status='active' AND m.role_key IN ('owner','admin') AND o.status='active' AND e.enabled
 ) THEN (
  SELECT coalesce(jsonb_agg(jsonb_build_object(
   'id',c.id,'title',c.title,'slug',c.slug,'code',c.code,'category',c.category,
   'gradeFrom',c.grade_from,'gradeTo',c.grade_to,'totalSessions',c.total_sessions
  ) ORDER BY c.title),'[]'::jsonb)
  FROM saas.academy_course_templates t JOIN public.courses c ON c.id=t.course_id
  WHERE t.availability='available'
 ) ELSE '[]'::jsonb END;
$fn$;
REVOKE ALL ON FUNCTION public.saas_academy_available_templates(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.saas_academy_available_templates(uuid,uuid) TO service_role;
COMMIT;
