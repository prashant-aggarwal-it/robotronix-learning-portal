-- Phase 3B: fail-closed resource ownership checks for the existing Academy schema.
-- Does NOT modify or expose legacy records. Service-only; caller authenticates bearer.
BEGIN;
CREATE OR REPLACE FUNCTION public.saas_academy_resource_owned(
 p_actor_id uuid,p_organization_id uuid,p_kind text,p_resource_id uuid
) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE valid_actor boolean; allowed boolean:=false;
BEGIN
 IF p_actor_id IS NULL OR p_organization_id IS NULL OR p_resource_id IS NULL THEN RETURN false; END IF;
 SELECT EXISTS(
  SELECT 1 FROM saas.memberships m JOIN saas.organizations o ON o.id=m.organization_id
  JOIN saas.module_entitlements e ON e.organization_id=o.id AND e.module_key='academy' AND e.enabled
  WHERE m.organization_id=p_organization_id AND m.user_id=p_actor_id AND m.status='active' AND o.status='active'
 ) INTO valid_actor;
 IF NOT valid_actor THEN RETURN false; END IF;
 IF p_kind='students' THEN
  SELECT EXISTS(SELECT 1 FROM saas.academy_students WHERE student_id=p_resource_id AND organization_id=p_organization_id) INTO allowed;
 ELSIF p_kind='courses' THEN
  SELECT EXISTS(SELECT 1 FROM saas.academy_courses WHERE course_id=p_resource_id AND organization_id=p_organization_id) INTO allowed;
 ELSIF p_kind='trainers' THEN
  SELECT EXISTS(SELECT 1 FROM saas.academy_trainers WHERE trainer_id=p_resource_id AND organization_id=p_organization_id) INTO allowed;
 ELSIF p_kind='enrollments' THEN
  SELECT EXISTS(SELECT 1 FROM saas.academy_enrollments WHERE enrollment_id=p_resource_id AND organization_id=p_organization_id) INTO allowed;
 ELSIF p_kind='student_invoices' THEN
  SELECT EXISTS(SELECT 1 FROM public.student_invoices i
   JOIN saas.academy_students s ON s.student_id=i.student_id AND s.organization_id=p_organization_id
   LEFT JOIN saas.academy_enrollments e ON e.enrollment_id=i.enrollment_id AND e.organization_id=p_organization_id
   WHERE i.id=p_resource_id AND (i.enrollment_id IS NULL OR e.enrollment_id IS NOT NULL)) INTO allowed;
 ELSIF p_kind='trainer_earnings' THEN
  SELECT EXISTS(SELECT 1 FROM public.trainer_earnings a
   JOIN saas.academy_trainers t ON t.trainer_id=a.trainer_id AND t.organization_id=p_organization_id
   WHERE a.id=p_resource_id AND a.schedule_event_id IS NULL) INTO allowed;
 ELSIF p_kind='schedule_events' THEN
  SELECT EXISTS(SELECT 1 FROM public.schedule_events ev
   LEFT JOIN saas.academy_enrollments e ON e.enrollment_id=ev.enrollment_id AND e.organization_id=p_organization_id
   LEFT JOIN saas.academy_students s ON s.student_id=ev.student_id AND s.organization_id=p_organization_id
   LEFT JOIN saas.academy_trainers t ON t.trainer_id=ev.trainer_id AND t.organization_id=p_organization_id
   LEFT JOIN saas.academy_courses c ON c.course_id=ev.course_id AND c.organization_id=p_organization_id
   WHERE ev.id=p_resource_id
    AND (ev.enrollment_id IS NOT NULL OR ev.student_id IS NOT NULL OR ev.trainer_id IS NOT NULL OR ev.course_id IS NOT NULL)
    AND (ev.enrollment_id IS NULL OR e.enrollment_id IS NOT NULL)
    AND (ev.student_id IS NULL OR s.student_id IS NOT NULL)
    AND (ev.trainer_id IS NULL OR t.trainer_id IS NOT NULL)
    AND (ev.course_id IS NULL OR c.course_id IS NOT NULL)
    AND ev.cohort_id IS NULL
  ) INTO allowed;
 ELSIF p_kind='zoom_meetings' THEN
  SELECT EXISTS(SELECT 1 FROM public.zoom_meetings m
   JOIN public.schedule_events ev ON ev.id=m.schedule_event_id
   JOIN saas.academy_enrollments e ON e.enrollment_id=ev.enrollment_id AND e.organization_id=p_organization_id
   WHERE m.id=p_resource_id AND ev.cohort_id IS NULL
   AND (ev.student_id IS NULL OR EXISTS(SELECT 1 FROM saas.academy_students s WHERE s.student_id=ev.student_id AND s.organization_id=p_organization_id))
   AND (ev.course_id IS NULL OR EXISTS(SELECT 1 FROM saas.academy_courses c WHERE c.course_id=ev.course_id AND c.organization_id=p_organization_id))
   AND (ev.trainer_id IS NULL OR EXISTS(SELECT 1 FROM saas.academy_trainers t WHERE t.trainer_id=ev.trainer_id AND t.organization_id=p_organization_id))
  ) INTO allowed;
 ELSIF p_kind='zoom_recordings' THEN
  SELECT EXISTS(SELECT 1 FROM public.zoom_recordings r
   JOIN public.zoom_meetings m ON m.id=r.zoom_meeting_id
   JOIN public.schedule_events ev ON ev.id=m.schedule_event_id
   JOIN saas.academy_enrollments e ON e.enrollment_id=ev.enrollment_id AND e.organization_id=p_organization_id
   WHERE r.id=p_resource_id AND ev.cohort_id IS NULL
    AND (ev.student_id IS NULL OR EXISTS(SELECT 1 FROM saas.academy_students s WHERE s.student_id=ev.student_id AND s.organization_id=p_organization_id))
    AND (ev.course_id IS NULL OR EXISTS(SELECT 1 FROM saas.academy_courses c WHERE c.course_id=ev.course_id AND c.organization_id=p_organization_id))
    AND (ev.trainer_id IS NULL OR EXISTS(SELECT 1 FROM saas.academy_trainers t WHERE t.trainer_id=ev.trainer_id AND t.organization_id=p_organization_id))
  ) INTO allowed;
 ELSE RETURN false;
 END IF;
 RETURN coalesce(allowed,false);
END $fn$;
REVOKE ALL ON FUNCTION public.saas_academy_resource_owned(uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.saas_academy_resource_owned(uuid,uuid,text,uuid) TO service_role;
COMMIT;
