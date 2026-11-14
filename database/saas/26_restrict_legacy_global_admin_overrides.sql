-- Security correction: legacy global profile admin must not bypass SaaS organization role.
-- SaaS accounts require active organization admin role for tenant-wide direct reads.
BEGIN;
DO $guard$ DECLARE rec record; p text;
BEGIN
 FOR rec IN SELECT * FROM (VALUES
 ('students','(saas.can_access_academy_record(''students'',id) OR (saas_org_id=saas.selected_academy_organization()))'),
 ('trainers','(saas.can_access_academy_record(''trainers'',id) OR (saas_org_id=saas.selected_academy_organization()))'),
 ('courses','(saas.can_access_academy_record(''courses'',id) OR (saas_org_id=saas.selected_academy_organization()))'),
 ('enrollments','(saas.can_access_academy_record(''enrollments'',id) OR (saas_org_id=saas.selected_academy_organization()))')
 ) AS x(tbl,scope_expr) LOOP
  p:='NOT saas.has_organization_membership() OR (saas.can_administer_selected_academy() AND '||rec.scope_expr||')';
  EXECUTE format('DROP POLICY IF EXISTS saas_tenant_boundary_select ON public.%I',rec.tbl);
  EXECUTE format('CREATE POLICY saas_tenant_boundary_select ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (%s)',rec.tbl,p);
  EXECUTE format('DROP POLICY IF EXISTS saas_tenant_boundary_update ON public.%I',rec.tbl);
  EXECUTE format('CREATE POLICY saas_tenant_boundary_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)',rec.tbl,p,p);
  EXECUTE format('DROP POLICY IF EXISTS saas_tenant_boundary_delete ON public.%I',rec.tbl);
  EXECUTE format('CREATE POLICY saas_tenant_boundary_delete ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (%s)',rec.tbl,p);
 END LOOP;
END $guard$;
COMMIT;
