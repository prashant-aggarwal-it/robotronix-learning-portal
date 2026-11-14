CREATE OR REPLACE FUNCTION public.saas_revoke_invitation_v1(p_actor_id uuid,p_organization_id uuid,p_invitation_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE v_role text; v_inv saas.organization_invitations%ROWTYPE;
BEGIN
 IF p_actor_id IS NULL OR p_organization_id IS NULL OR p_invitation_id IS NULL
 THEN RAISE EXCEPTION 'Invalid invitation' USING ERRCODE='22023'; END IF;
 SELECT role_key INTO v_role FROM saas.memberships
 WHERE organization_id=p_organization_id AND user_id=p_actor_id AND status='active';
 IF v_role IS NULL OR v_role NOT IN ('owner','admin') THEN
  RAISE EXCEPTION 'Invitation access denied' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_inv FROM saas.organization_invitations
 WHERE id=p_invitation_id AND organization_id=p_organization_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invitation not found' USING ERRCODE='42501'; END IF;
 IF v_role='admin' AND v_inv.role_key IN ('owner','admin') THEN
  RAISE EXCEPTION 'Owner required' USING ERRCODE='42501'; END IF;
 IF v_inv.status<>'pending' THEN RETURN false; END IF;
 UPDATE saas.organization_invitations SET status='revoked' WHERE id=v_inv.id;
 INSERT INTO saas.audit_events(organization_id,actor_user_id,event_type,object_type,object_id,details)
 VALUES(p_organization_id,p_actor_id,'invitation.revoked','organization_invitation',v_inv.id,
 jsonb_build_object('role',v_inv.role_key));
 RETURN true;
END $fn$;
REVOKE ALL ON FUNCTION public.saas_revoke_invitation_v1(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.saas_revoke_invitation_v1(uuid,uuid,uuid) TO service_role;