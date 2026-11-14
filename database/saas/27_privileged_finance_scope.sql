-- Phase 3B: verified service-only finance record scope for privileged invoice routes.
BEGIN;
CREATE OR REPLACE FUNCTION public.saas_academy_finance_scope(
 p_actor_id uuid,p_organization_id uuid
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE packages jsonb;invoices jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM saas.memberships m JOIN saas.organizations o ON o.id=m.organization_id
 JOIN saas.module_entitlements e ON e.organization_id=o.id AND e.module_key='academy' AND e.enabled
 WHERE m.organization_id=p_organization_id AND m.user_id=p_actor_id
 AND m.status='active' AND m.role_key IN ('owner','admin') AND o.status='active')
 THEN RAISE EXCEPTION 'Academy finance organization access denied' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(p.id),'[]'::jsonb) INTO packages
 FROM public.student_fee_packages p
 JOIN saas.academy_enrollments e ON e.enrollment_id=p.enrollment_id AND e.organization_id=p_organization_id;
 SELECT coalesce(jsonb_agg(i.id),'[]'::jsonb) INTO invoices
 FROM public.student_invoices i
 WHERE (i.enrollment_id IS NOT NULL OR i.student_id IS NOT NULL OR i.fee_package_id IS NOT NULL)
 AND (i.enrollment_id IS NULL OR EXISTS(SELECT 1 FROM saas.academy_enrollments e WHERE e.enrollment_id=i.enrollment_id AND e.organization_id=p_organization_id))
 AND (i.student_id IS NULL OR EXISTS(SELECT 1 FROM saas.academy_students s WHERE s.student_id=i.student_id AND s.organization_id=p_organization_id))
 AND (i.fee_package_id IS NULL OR EXISTS(SELECT 1 FROM public.student_fee_packages p JOIN saas.academy_enrollments e ON e.enrollment_id=p.enrollment_id AND e.organization_id=p_organization_id WHERE p.id=i.fee_package_id));
 RETURN jsonb_build_object('packageIds',packages,'invoiceIds',invoices);
END $fn$;
REVOKE ALL ON FUNCTION public.saas_academy_finance_scope(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.saas_academy_finance_scope(uuid,uuid) TO service_role;
COMMIT;
