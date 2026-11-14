-- DEV ONLY: attach test-only Parent/Student/Trainer users to synthetic organizations.
BEGIN;
CREATE OR REPLACE FUNCTION public.saas_qa_add_synthetic_member(
 p_actor_id uuid,p_organization_id uuid,p_role_key text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
BEGIN
 IF p_role_key NOT IN ('member','trainer') OR NOT EXISTS (
 SELECT 1 FROM auth.users u CROSS JOIN saas.organizations o
 WHERE u.id=p_actor_id AND o.id=p_organization_id
 AND lower(u.email) ~ '^saas-e2e-[a-z0-9-]+@example[.]invalid$'
 AND o.slug ~ '^saas-e2e-[ab]-[a-f0-9]{12}$'
 ) THEN RAISE EXCEPTION 'Only synthetic role fixtures permitted' USING ERRCODE='42501'; END IF;
 INSERT INTO saas.memberships(organization_id,user_id,role_key)
 VALUES(p_organization_id,p_actor_id,p_role_key)
 ON CONFLICT (organization_id,user_id) DO NOTHING;
END $fn$;
REVOKE ALL ON FUNCTION public.saas_qa_add_synthetic_member(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.saas_qa_add_synthetic_member(uuid,uuid,text) TO service_role;
COMMIT;
