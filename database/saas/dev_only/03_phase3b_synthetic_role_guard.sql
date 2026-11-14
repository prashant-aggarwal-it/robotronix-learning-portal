-- DEV ONLY: strict synthetic-user role toggle for authenticated RLS regression tests.
BEGIN;
CREATE OR REPLACE FUNCTION public.saas_qa_set_synthetic_role(
 p_actor_id uuid,p_organization_id uuid,p_role text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
BEGIN
 IF p_role NOT IN ('member','admin') OR NOT EXISTS(
 SELECT 1 FROM auth.users u JOIN saas.memberships m ON m.user_id=u.id
 JOIN saas.organizations o ON o.id=m.organization_id
 WHERE u.id=p_actor_id AND lower(u.email) ~ '^saas-e2e-[a-z0-9-]+@example[.]invalid$'
  AND m.organization_id=p_organization_id AND o.slug ~ '^saas-e2e-[ab]-[a-f0-9]{12}$'
 ) THEN RAISE EXCEPTION 'Synthetic role-change guard rejected' USING ERRCODE='42501'; END IF;
 UPDATE saas.memberships SET role_key=p_role
 WHERE user_id=p_actor_id AND organization_id=p_organization_id;
END $fn$;
REVOKE ALL ON FUNCTION public.saas_qa_set_synthetic_role(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.saas_qa_set_synthetic_role(uuid,uuid,text) TO service_role;
COMMIT;
