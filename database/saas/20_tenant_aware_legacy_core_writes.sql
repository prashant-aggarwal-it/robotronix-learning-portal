-- Phase 3B: automatic ownership for authorized legacy-browser core Academy inserts.
-- RLS INSERT checks a verified selected organization; AFTER INSERT makes the ownership link.
-- Trigger failure rolls back the original insert. Server-role APIs can still link explicitly.
BEGIN;
CREATE OR REPLACE FUNCTION saas.attach_new_academy_ownership()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE org uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT saas.has_organization_membership() THEN RETURN NEW; END IF;
 org:=saas.selected_academy_organization();
 IF org IS NULL OR NOT saas.can_administer_selected_academy() THEN
  RAISE EXCEPTION 'Academy organization not authorized' USING ERRCODE='42501';
 END IF;
 IF TG_TABLE_NAME='students' THEN
  INSERT INTO saas.academy_students(student_id,organization_id) VALUES(NEW.id,org);
 ELSIF TG_TABLE_NAME='trainers' THEN
  INSERT INTO saas.academy_trainers(trainer_id,organization_id) VALUES(NEW.id,org);
 ELSIF TG_TABLE_NAME='courses' THEN
  INSERT INTO saas.academy_courses(course_id,organization_id) VALUES(NEW.id,org);
 ELSIF TG_TABLE_NAME='enrollments' THEN
  IF NEW.cohort_id IS NOT NULL OR NOT saas.enrollment_parties_match(org,NEW.student_id,NEW.course_id,NEW.trainer_id) THEN
   RAISE EXCEPTION 'Cross-organization enrollment relationship denied' USING ERRCODE='42501';
  END IF;
  INSERT INTO saas.academy_enrollments(enrollment_id,organization_id) VALUES(NEW.id,org);
 ELSE
  RAISE EXCEPTION 'Unsupported Academy ownership trigger' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $fn$;
CREATE OR REPLACE FUNCTION saas.validate_academy_enrollment_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE org uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT saas.has_organization_membership() THEN RETURN NEW; END IF;
 org:=saas.selected_academy_organization();
 IF org IS NULL OR NOT EXISTS(
  SELECT 1 FROM saas.academy_enrollments
  WHERE enrollment_id=OLD.id AND organization_id=org
 ) OR NEW.cohort_id IS NOT NULL
 OR NOT saas.enrollment_parties_match(org,NEW.student_id,NEW.course_id,NEW.trainer_id) THEN
  RAISE EXCEPTION 'Cross-organization enrollment update denied' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION saas.attach_new_academy_ownership(),saas.validate_academy_enrollment_update() FROM PUBLIC,anon,authenticated;
DO $triggers$ DECLARE tbl text;
BEGIN
 FOREACH tbl IN ARRAY ARRAY['students','trainers','courses','enrollments'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS saas_attach_new_academy_ownership ON public.%I',tbl);
  EXECUTE format('CREATE TRIGGER saas_attach_new_academy_ownership AFTER INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION saas.attach_new_academy_ownership()',tbl);
 END LOOP;
END $triggers$;
DROP TRIGGER IF EXISTS saas_validate_enrollment_update ON public.enrollments;
CREATE TRIGGER saas_validate_enrollment_update BEFORE UPDATE ON public.enrollments
FOR EACH ROW EXECUTE FUNCTION saas.validate_academy_enrollment_update();

DO $policies$ DECLARE rec record; pred text;
BEGIN
 FOR rec IN SELECT * FROM (VALUES
  ('students','students'),('trainers','trainers'),
  ('courses','courses'),('enrollments','enrollments')
 ) AS x(tbl,kind) LOOP
  pred:=format('NOT saas.has_organization_membership() OR saas.can_access_academy_record(%L,id)',rec.kind);
  EXECUTE format('DROP POLICY IF EXISTS saas_tenant_boundary ON public.%I',rec.tbl);
  EXECUTE format('DROP POLICY IF EXISTS saas_tenant_boundary_select ON public.%I',rec.tbl);
  EXECUTE format('DROP POLICY IF EXISTS saas_tenant_boundary_update ON public.%I',rec.tbl);
  EXECUTE format('DROP POLICY IF EXISTS saas_tenant_boundary_delete ON public.%I',rec.tbl);
  EXECUTE format('DROP POLICY IF EXISTS saas_tenant_boundary_insert ON public.%I',rec.tbl);
  EXECUTE format('DROP POLICY IF EXISTS saas_tenant_insert ON public.%I',rec.tbl);
  EXECUTE format('CREATE POLICY saas_tenant_boundary_select ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (%s)',rec.tbl,pred);
  EXECUTE format('CREATE POLICY saas_tenant_boundary_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)',rec.tbl,pred,pred);
  EXECUTE format('CREATE POLICY saas_tenant_boundary_delete ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (%s)',rec.tbl,pred);
  EXECUTE format('CREATE POLICY saas_tenant_boundary_insert ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT saas.has_organization_membership() OR saas.can_administer_selected_academy())',rec.tbl);
  EXECUTE format('CREATE POLICY saas_tenant_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (saas.can_administer_selected_academy())',rec.tbl);
 END LOOP;
END $policies$;
COMMIT;
