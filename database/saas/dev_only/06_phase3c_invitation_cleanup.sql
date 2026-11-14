-- DEV-ONLY: scoped cleanup for ephemeral Phase 3C E2E invitation/audit records.
-- Never include in production upgrade packages.
CREATE OR REPLACE FUNCTION public.saas_qa_phase3c_cleanup(p_school_a uuid,p_school_b uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE ids uuid[]:=ARRAY[p_school_a,p_school_b];
BEGIN
 IF p_school_a IS NULL OR p_school_b IS NULL OR p_school_a=p_school_b
 OR (SELECT count(*) FROM saas.organizations
     WHERE id=ANY(ids) AND slug ~ '^saas-e2e-[ab]-[a-f0-9]{12}$')<>2 THEN
  RAISE EXCEPTION 'Unsafe synthetic invitation cleanup identifiers' USING ERRCODE='42501';
 END IF;
 IF EXISTS(
  SELECT 1 FROM saas.organization_invitations i
  WHERE i.organization_id=ANY(ids)
  AND i.email !~ '^([a-z0-9-]+@example[.]invalid|unclaimed-saas-e2e-[a-z0-9-]+@example[.]invalid)$'
 ) THEN
  RAISE EXCEPTION 'Refusing cleanup: non-synthetic invitation exists' USING ERRCODE='42501';
 END IF;
 DELETE FROM saas.organization_invitations WHERE organization_id=ANY(ids);
 DELETE FROM saas.audit_events WHERE organization_id=ANY(ids);
 RETURN true;
END $fn$;
REVOKE ALL ON FUNCTION public.saas_qa_phase3c_cleanup(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.saas_qa_phase3c_cleanup(uuid,uuid) TO service_role;
