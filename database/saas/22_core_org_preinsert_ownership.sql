-- Phase 3B: make legacy INSERT ... RETURNING visible to its authorized organization
-- before AFTER INSERT attaches the canonical ownership bridge.
BEGIN;
DO $columns$ DECLARE tbl text;
BEGIN
 FOREACH tbl IN ARRAY ARRAY['students','trainers','courses','enrollments'] LOOP
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS saas_org_id uuid REFERENCES saas.organizations(id)',tbl);
  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(saas_org_id) WHERE saas_org_id IS NOT NULL','idx_'||tbl||'_saas_org',tbl);
 END LOOP;
END $columns$;

CREATE OR REPLACE FUNCTION saas.guard_core_organization()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE org uuid;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.saas_org_id IS DISTINCT FROM OLD.saas_org_id THEN
   RAISE EXCEPTION 'Organization reassignment is prohibited' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
 END IF;
 IF auth.uid() IS NULL THEN RETURN NEW; END IF; -- service operations manage canonical links
 IF NOT saas.has_organization_membership() THEN
  IF NEW.saas_org_id IS NOT NULL THEN
   RAISE EXCEPTION 'Unverified organization assignment' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
 END IF;
 org:=saas.selected_academy_organization();
 IF org IS NULL OR NOT saas.can_administer_selected_academy() THEN
  RAISE EXCEPTION 'Academy organization not authorized' USING ERRCODE='42501';
 END IF;
 NEW.saas_org_id:=org; -- caller-supplied ID is overwritten after membership checks
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION saas.guard_core_organization() FROM PUBLIC,anon,authenticated;
DO $triggers$ DECLARE tbl text;
BEGIN
 FOREACH tbl IN ARRAY ARRAY['students','trainers','courses','enrollments'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS saas_guard_core_organization ON public.%I',tbl);
  EXECUTE format('CREATE TRIGGER saas_guard_core_organization BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION saas.guard_core_organization()',tbl);
 END LOOP;
END $triggers$;
CREATE OR REPLACE FUNCTION saas.can_access_academy_record(p_kind text,p_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE org uuid:=saas.selected_academy_organization();
BEGIN
 IF org IS NULL OR p_id IS NULL THEN RETURN false; END IF;
 IF p_kind='students' THEN
  RETURN EXISTS(SELECT 1 FROM public.students r WHERE r.id=p_id AND (
   EXISTS(SELECT 1 FROM saas.academy_students l WHERE l.student_id=r.id AND l.organization_id=org)
   OR (r.saas_org_id=org AND NOT EXISTS(SELECT 1 FROM saas.academy_students l WHERE l.student_id=r.id AND l.organization_id<>org))));
 ELSIF p_kind='trainers' THEN
  RETURN EXISTS(SELECT 1 FROM public.trainers r WHERE r.id=p_id AND (
   EXISTS(SELECT 1 FROM saas.academy_trainers l WHERE l.trainer_id=r.id AND l.organization_id=org)
   OR (r.saas_org_id=org AND NOT EXISTS(SELECT 1 FROM saas.academy_trainers l WHERE l.trainer_id=r.id AND l.organization_id<>org))));
 ELSIF p_kind='courses' THEN
  RETURN EXISTS(SELECT 1 FROM public.courses r WHERE r.id=p_id AND (
   EXISTS(SELECT 1 FROM saas.academy_courses l WHERE l.course_id=r.id AND l.organization_id=org)
   OR (r.saas_org_id=org AND NOT EXISTS(SELECT 1 FROM saas.academy_courses l WHERE l.course_id=r.id AND l.organization_id<>org))));
 ELSIF p_kind='enrollments' THEN
  RETURN EXISTS(SELECT 1 FROM public.enrollments r WHERE r.id=p_id AND (
   EXISTS(SELECT 1 FROM saas.academy_enrollments l WHERE l.enrollment_id=r.id AND l.organization_id=org)
   OR (r.saas_org_id=org AND NOT EXISTS(SELECT 1 FROM saas.academy_enrollments l WHERE l.enrollment_id=r.id AND l.organization_id<>org))));
 END IF;
 RETURN false;
END $fn$;
REVOKE ALL ON FUNCTION saas.can_access_academy_record(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION saas.can_access_academy_record(text,uuid) TO authenticated,service_role;
COMMIT;
