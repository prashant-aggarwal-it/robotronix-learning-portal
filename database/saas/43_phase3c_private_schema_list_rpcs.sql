-- Phase 3C: private-schema member and invitation read APIs.
-- Keep saas schema unexposed; use service-only RPCs with actor authorization.
CREATE OR REPLACE FUNCTION public.saas_list_members_v1(p_actor_id uuid,p_organization_id uuid)
RETURNS TABLE(id uuid,user_id uuid,role_key text,status text,created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $fn$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM saas.memberships m
  JOIN saas.organizations o ON o.id=m.organization_id
  WHERE m.organization_id=p_organization_id AND m.user_id=p_actor_id
    AND m.status='active' AND m.role_key IN ('owner','admin') AND o.status='active'
 ) THEN RAISE EXCEPTION 'Membership list access denied' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT m.id,m.user_id,m.role_key,m.status,m.created_at
 FROM saas.memberships m WHERE m.organization_id=p_organization_id
 ORDER BY m.created_at;
END $fn$;
CREATE OR REPLACE FUNCTION public.saas_list_invitations_v1(p_actor_id uuid,p_organization_id uuid)
RETURNS TABLE(id uuid,email text,role_key text,status text,created_at timestamptz,expires_at timestamptz,accepted_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $fn$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM saas.memberships m
  JOIN saas.organizations o ON o.id=m.organization_id
  WHERE m.organization_id=p_organization_id AND m.user_id=p_actor_id
    AND m.status='active' AND m.role_key IN ('owner','admin') AND o.status='active'
 ) THEN RAISE EXCEPTION 'Invitation list access denied' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT i.id,i.email,i.role_key,i.status,i.created_at,i.expires_at,i.accepted_at
 FROM saas.organization_invitations i
 WHERE i.organization_id=p_organization_id
 ORDER BY i.created_at DESC LIMIT 100;
END $fn$;
REVOKE ALL ON FUNCTION public.saas_list_members_v1(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.saas_list_members_v1(uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.saas_list_invitations_v1(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.saas_list_invitations_v1(uuid,uuid) TO service_role;