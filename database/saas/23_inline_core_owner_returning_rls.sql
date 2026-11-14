-- Phase 3B: INSERT RETURNING needs an inline owner predicate:
-- stable subqueries cannot necessarily observe the row inserted by the same SQL statement.
BEGIN;
DO $policies$ DECLARE rec record; permitted text;
BEGIN
 FOR rec IN SELECT * FROM (VALUES
 ('students','students'),('trainers','trainers'),('courses','courses'),('enrollments','enrollments')
 ) AS x(tbl,kind) LOOP
  permitted:=format('(saas.can_access_academy_record(%L,id) OR (saas_org_id=saas.selected_academy_organization() AND saas.can_administer_selected_academy()))',rec.kind);
  EXECUTE format('DROP POLICY IF EXISTS saas_tenant_boundary_select ON public.%I',rec.tbl);
  EXECUTE format('DROP POLICY IF EXISTS saas_tenant_boundary_update ON public.%I',rec.tbl);
  EXECUTE format('DROP POLICY IF EXISTS saas_tenant_boundary_delete ON public.%I',rec.tbl);
  EXECUTE format('DROP POLICY IF EXISTS saas_tenant_select ON public.%I',rec.tbl);
  EXECUTE format('CREATE POLICY saas_tenant_boundary_select ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (NOT saas.has_organization_membership() OR %s)',rec.tbl,permitted);
  EXECUTE format('CREATE POLICY saas_tenant_boundary_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT saas.has_organization_membership() OR %s) WITH CHECK (NOT saas.has_organization_membership() OR %s)',rec.tbl,permitted,permitted);
  EXECUTE format('CREATE POLICY saas_tenant_boundary_delete ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT saas.has_organization_membership() OR %s)',rec.tbl,permitted);
  EXECUTE format('CREATE POLICY saas_tenant_select ON public.%I FOR SELECT TO authenticated USING (saas.can_administer_selected_academy() AND %s)',rec.tbl,permitted);
 END LOOP;
END $policies$;
COMMIT;
