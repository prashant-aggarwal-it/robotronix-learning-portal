-- Phase 3C: SaaS invitations; token secrets are never stored.
CREATE TABLE IF NOT EXISTS saas.organization_invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES saas.organizations(id),
 email text NOT NULL,
 role_key text NOT NULL CHECK(role_key IN ('owner','admin','staff','trainer','member')),
 token_sha256 text NOT NULL UNIQUE CHECK(token_sha256 ~ '^[a-f0-9]{64}$'),
 invited_by uuid NOT NULL REFERENCES auth.users(id),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','revoked')),
 expires_at timestamptz NOT NULL DEFAULT(now()+interval '7 days'),
 accepted_by uuid REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 accepted_at timestamptz
);
ALTER TABLE saas.organization_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON saas.organization_invitations FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON saas.organization_invitations TO service_role;
CREATE INDEX IF NOT EXISTS saas_invitations_org_pending ON saas.organization_invitations(organization_id,status,expires_at);

CREATE OR REPLACE FUNCTION public.saas_create_invitation_v1(
 p_actor_id uuid,p_organization_id uuid,p_email text,p_role_key text,p_token_sha256 text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE v_role text; v_id uuid;
BEGIN
 IF p_actor_id IS NULL OR p_organization_id IS NULL OR p_email IS NULL OR p_role_key IS NULL
 OR p_token_sha256 IS NULL OR p_token_sha256 !~ '^[a-f0-9]{64}$'
 OR length(p_email)>254 OR p_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
 OR p_role_key NOT IN ('owner','admin','staff','trainer','member') THEN
  RAISE EXCEPTION 'Invalid invitation' USING ERRCODE='22023';
 END IF;
 PERFORM 1 FROM saas.organizations WHERE id=p_organization_id AND status='active' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Organization unavailable' USING ERRCODE='42501'; END IF;
 SELECT role_key INTO v_role FROM saas.memberships WHERE organization_id=p_organization_id AND user_id=p_actor_id AND status='active';
 IF v_role IS NULL OR v_role NOT IN ('owner','admin')
 OR (v_role='admin' AND p_role_key IN ('owner','admin')) THEN
  RAISE EXCEPTION 'Invitation not authorized' USING ERRCODE='42501';
 END IF;
 INSERT INTO saas.organization_invitations(organization_id,email,role_key,token_sha256,invited_by)
 VALUES(p_organization_id,lower(trim(p_email)),p_role_key,p_token_sha256,p_actor_id) RETURNING id INTO v_id;
 INSERT INTO saas.audit_events(organization_id,actor_user_id,event_type,object_type,object_id,details)
 VALUES(p_organization_id,p_actor_id,'invitation.created','organization_invitation',v_id,
  jsonb_build_object('role',p_role_key));
 RETURN v_id;
END $fn$;

CREATE OR REPLACE FUNCTION public.saas_accept_invitation_v1(
 p_actor_id uuid,p_token_sha256 text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE v_inv saas.organization_invitations%ROWTYPE; v_email text; v_org uuid;
BEGIN
 IF p_actor_id IS NULL OR p_token_sha256 IS NULL OR p_token_sha256 !~ '^[a-f0-9]{64}$' THEN
  RAISE EXCEPTION 'Invalid invitation token' USING ERRCODE='22023';
 END IF;
 SELECT lower(trim(email)) INTO v_email FROM auth.users
 WHERE id=p_actor_id AND email_confirmed_at IS NOT NULL AND deleted_at IS NULL;
 IF v_email IS NULL THEN RAISE EXCEPTION 'Verified email required' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_inv FROM saas.organization_invitations WHERE token_sha256=p_token_sha256 FOR UPDATE;
 IF NOT FOUND OR v_inv.status<>'pending' OR v_inv.expires_at<=now() OR v_inv.email<>v_email THEN
  RAISE EXCEPTION 'Invitation invalid or expired' USING ERRCODE='42501';
 END IF;
 PERFORM 1 FROM saas.organizations WHERE id=v_inv.organization_id AND status='active' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Organization unavailable' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM saas.memberships WHERE organization_id=v_inv.organization_id AND user_id=p_actor_id) THEN
  RAISE EXCEPTION 'Existing membership requires administrator' USING ERRCODE='23505';
 END IF;
 INSERT INTO saas.memberships(organization_id,user_id,role_key,status)
 VALUES(v_inv.organization_id,p_actor_id,v_inv.role_key,'active');
 UPDATE saas.organization_invitations SET status='accepted',accepted_by=p_actor_id,accepted_at=now() WHERE id=v_inv.id;
 INSERT INTO saas.audit_events(organization_id,actor_user_id,event_type,object_type,object_id,details)
 VALUES(v_inv.organization_id,p_actor_id,'invitation.accepted','organization_invitation',v_inv.id,
 jsonb_build_object('role',v_inv.role_key));
 RETURN v_inv.organization_id;
END $fn$;
REVOKE ALL ON FUNCTION public.saas_create_invitation_v1(uuid,uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.saas_create_invitation_v1(uuid,uuid,text,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.saas_accept_invitation_v1(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.saas_accept_invitation_v1(uuid,text) TO service_role;
