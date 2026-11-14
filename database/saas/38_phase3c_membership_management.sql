-- Phase 3C: service-only atomic SaaS membership role/status management.
-- The caller must authenticate the actor JWT before invoking this privileged RPC.
CREATE OR REPLACE FUNCTION public.saas_manage_membership_v1(
 p_actor_id uuid,p_organization_id uuid,p_membership_id uuid,
 p_role_key text,p_status text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog AS $fn$
DECLARE v_actor_role text; v_old saas.memberships%ROWTYPE;
BEGIN
 IF p_actor_id IS NULL OR p_organization_id IS NULL OR p_membership_id IS NULL
 OR p_role_key IS NULL OR p_status IS NULL
 OR p_role_key NOT IN ('owner','admin','staff','trainer','member')
 OR p_status NOT IN ('active','suspended','removed') THEN
  RAISE EXCEPTION 'Invalid membership change' USING ERRCODE='22023';
 END IF;
 PERFORM 1 FROM saas.organizations WHERE id=p_organization_id AND status='active' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Organization unavailable' USING ERRCODE='42501'; END IF;
 SELECT role_key INTO v_actor_role FROM saas.memberships
 WHERE organization_id=p_organization_id AND user_id=p_actor_id AND status='active';
 IF v_actor_role NOT IN ('owner','admin') OR v_actor_role IS NULL THEN
  RAISE EXCEPTION 'Insufficient organization permission' USING ERRCODE='42501';
 END IF;
 SELECT * INTO v_old FROM saas.memberships
 WHERE id=p_membership_id AND organization_id=p_organization_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Membership not found' USING ERRCODE='42501'; END IF;
 IF v_actor_role='admin' AND
   (v_old.role_key IN ('owner','admin') OR p_role_key IN ('owner','admin')) THEN
  RAISE EXCEPTION 'Owner permission required' USING ERRCODE='42501';
 END IF;
 IF p_actor_id=v_old.user_id AND p_status <> 'active' THEN
  RAISE EXCEPTION 'Cannot revoke own active membership' USING ERRCODE='42501';
 END IF;
 IF v_old.role_key IS DISTINCT FROM p_role_key OR v_old.status IS DISTINCT FROM p_status THEN
  UPDATE saas.memberships SET role_key=p_role_key,status=p_status WHERE id=p_membership_id;
  INSERT INTO saas.audit_events(organization_id,actor_user_id,event_type,object_type,object_id,details)
  VALUES(p_organization_id,p_actor_id,'membership.changed','membership',p_membership_id,
    pg_catalog.jsonb_build_object('old_role',v_old.role_key,'new_role',p_role_key,
      'old_status',v_old.status,'new_status',p_status));
 END IF;
 RETURN true;
END $fn$;
REVOKE ALL ON FUNCTION public.saas_manage_membership_v1(uuid,uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.saas_manage_membership_v1(uuid,uuid,uuid,text,text) TO service_role;
