-- Phase 3B — Restrictive tenant enforcement over existing Academy direct-PostgREST paths.
-- Explicit opt-in only for users participating in SaaS. Legacy standalone users retain old RLS.
-- Caller-controlled x-organization-id cannot authorize anything without membership + entitlement.
BEGIN;
CREATE OR REPLACE FUNCTION saas.has_organization_membership()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $fn$
 SELECT auth.uid() IS NOT NULL AND EXISTS (
 SELECT 1 FROM saas.memberships WHERE user_id=auth.uid()
 );
$fn$;
CREATE OR REPLACE FUNCTION saas.selected_academy_organization()
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE raw_headers text; selected text; actor uuid:=auth.uid(); org uuid;
BEGIN
 IF actor IS NULL THEN RETURN NULL; END IF;
 raw_headers:=current_setting('request.headers',true);
 IF raw_headers IS NULL OR raw_headers='' THEN RETURN NULL; END IF;
 BEGIN selected:=(raw_headers::jsonb)->>'x-organization-id';
 EXCEPTION WHEN invalid_text_representation THEN RETURN NULL; END;
 IF selected IS NULL OR selected !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RETURN NULL; END IF;
 org:=selected::uuid;
 IF NOT EXISTS (
 SELECT 1 FROM saas.memberships m JOIN saas.organizations o ON o.id=m.organization_id
 JOIN saas.module_entitlements e ON e.organization_id=o.id AND e.module_key='academy' AND e.enabled
 WHERE m.user_id=actor AND m.organization_id=org AND m.status='active' AND o.status='active'
 ) THEN RETURN NULL; END IF;
 RETURN org;
END $fn$;
CREATE OR REPLACE FUNCTION saas.can_access_academy_record(p_kind text,p_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE org uuid:=saas.selected_academy_organization();
BEGIN
 IF org IS NULL OR p_id IS NULL THEN RETURN false; END IF;
 IF p_kind='students' THEN RETURN EXISTS(SELECT 1 FROM saas.academy_students WHERE student_id=p_id AND organization_id=org);
 ELSIF p_kind='trainers' THEN RETURN EXISTS(SELECT 1 FROM saas.academy_trainers WHERE trainer_id=p_id AND organization_id=org);
 ELSIF p_kind='courses' THEN RETURN EXISTS(SELECT 1 FROM saas.academy_courses WHERE course_id=p_id AND organization_id=org);
 ELSIF p_kind='enrollments' THEN RETURN EXISTS(SELECT 1 FROM saas.academy_enrollments WHERE enrollment_id=p_id AND organization_id=org);
 END IF;
 RETURN false;
END $fn$;
REVOKE ALL ON FUNCTION saas.has_organization_membership() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION saas.selected_academy_organization() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION saas.can_access_academy_record(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION saas.has_organization_membership(),saas.selected_academy_organization(),saas.can_access_academy_record(text,uuid) TO authenticated,service_role;
-- A RESTRICTIVE policy intersects legacy permissive policies and prevents an admin profile
-- from overriding SaaS tenant boundaries through an old browser query.
DO $policies$ DECLARE rec record;
BEGIN
 FOR rec IN SELECT * FROM (VALUES
  ('students','id','students'),('trainers','id','trainers'),
  ('courses','id','courses'),('enrollments','id','enrollments')
 ) AS x(tbl,key_col,kind) LOOP
  EXECUTE format('DROP POLICY IF EXISTS saas_tenant_boundary ON public.%I',rec.tbl);
  EXECUTE format('CREATE POLICY saas_tenant_boundary ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (NOT saas.has_organization_membership() OR saas.can_access_academy_record(%L,%I)) WITH CHECK (NOT saas.has_organization_membership() OR saas.can_access_academy_record(%L,%I))',
   rec.tbl,rec.kind,rec.key_col,rec.kind,rec.key_col);
  EXECUTE format('DROP POLICY IF EXISTS saas_tenant_select ON public.%I',rec.tbl);
  EXECUTE format('CREATE POLICY saas_tenant_select ON public.%I FOR SELECT TO authenticated USING (saas.has_organization_membership() AND saas.can_access_academy_record(%L,%I))',
   rec.tbl,rec.kind,rec.key_col);
 END LOOP;
END $policies$;
COMMIT;
