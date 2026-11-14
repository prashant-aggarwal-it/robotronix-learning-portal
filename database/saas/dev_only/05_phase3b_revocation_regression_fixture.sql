-- DEV ONLY: test membership revocation without changing real users.
BEGIN;
CREATE OR REPLACE FUNCTION public.saas_qa_set_synthetic_membership_status(
 p_actor_id uuid,p_organization_id uuid,p_status text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
BEGIN
 IF p_status NOT IN ('active','removed') OR NOT EXISTS (
 SELECT 1 FROM auth.users u JOIN saas.memberships m ON m.user_id=u.id
 JOIN saas.organizations o ON o.id=m.organization_id
 WHERE u.id=p_actor_id AND m.organization_id=p_organization_id
 AND lower(u.email) ~ '^saas-e2e-[a-z0-9-]+@example[.]invalid$'
 AND o.slug ~ '^saas-e2e-[ab]-[a-f0-9]{12}$'
 ) THEN RAISE EXCEPTION 'Synthetic membership revocation refused' USING ERRCODE='42501'; END IF;
 UPDATE saas.memberships SET status=p_status
 WHERE user_id=p_actor_id AND organization_id=p_organization_id;
END $fn$;
REVOKE ALL ON FUNCTION public.saas_qa_set_synthetic_membership_status(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.saas_qa_set_synthetic_membership_status(uuid,uuid,text) TO service_role;
COMMIT;
