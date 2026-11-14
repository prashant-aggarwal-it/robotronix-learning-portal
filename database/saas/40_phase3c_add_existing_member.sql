-- Phase 3C: invite an EXISTING authenticated identity into an organization.
-- This does not create an auth user or send an email invitation.
CREATE OR REPLACE FUNCTION public.saas_add_existing_member_v1(
 p_actor_id uuid,p_organization_id uuid,p_user_id uuid,p_role_key text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE v_actor_role text; v_id uuid;
BEGIN
 IF p_actor_id IS NULL OR p_organization_id IS NULL OR p_user_id IS NULL
   OR p_role_key IS NULL OR p_role_key NOT IN ('owner','admin','staff','trainer','member') THEN
  RAISE EXCEPTION 'Invalid member data' USING ERRCODE='22023';
 END IF;
 PERFORM 1 FROM saas.organizations WHERE id=p_organization_id AND status='active' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Organization unavailable' USING ERRCODE='42501'; END IF;
 SELECT role_key INTO v_actor_role FROM saas.memberships
 WHERE organization_id=p_organization_id AND user_id=p_actor_id AND status='active';
 IF v_actor_role IS NULL OR v_actor_role NOT IN ('owner','admin')
 OR (v_actor_role='admin' AND p_role_key IN ('owner','admin')) THEN
  RAISE EXCEPTION 'Member creation not permitted' USING ERRCODE='42501';
 END IF;
 PERFORM 1 FROM auth.users WHERE id=p_user_id AND deleted_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'User must already have an account' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM saas.memberships WHERE organization_id=p_organization_id AND user_id=p_user_id) THEN
  RAISE EXCEPTION 'Member already exists' USING ERRCODE='23505';
 END IF;
 INSERT INTO saas.memberships(organization_id,user_id,role_key,status)
 VALUES(p_organization_id,p_user_id,p_role_key,'active') RETURNING id INTO v_id;
 INSERT INTO saas.audit_events(organization_id,actor_user_id,event_type,object_type,object_id,details)
 VALUES(p_organization_id,p_actor_id,'membership.created','membership',v_id,
  jsonb_build_object('role',p_role_key,'user_id',p_user_id));
 RETURN v_id;
END $fn$;
REVOKE ALL ON FUNCTION public.saas_add_existing_member_v1(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.saas_add_existing_member_v1(uuid,uuid,uuid,text) TO service_role;
