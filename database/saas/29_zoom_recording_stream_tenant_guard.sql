-- Phase 3B: server-only signed Zoom recording playback guard for SaaS users.
-- Returns NULL for legacy users without SaaS memberships; false for unauthorized SaaS users.
BEGIN;
CREATE OR REPLACE FUNCTION public.saas_academy_recording_scope(
 p_actor_id uuid,p_recording_id uuid
) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE actor_role text; actor_active boolean;
BEGIN
 IF p_actor_id IS NULL OR p_recording_id IS NULL THEN RETURN false; END IF;
 IF NOT EXISTS(SELECT 1 FROM saas.memberships WHERE user_id=p_actor_id) THEN
  IF EXISTS(SELECT 1 FROM saas.user_membership_history WHERE user_id=p_actor_id) THEN RETURN false; END IF;
  RETURN NULL;
 END IF;
 SELECT role,active INTO actor_role,actor_active FROM public.profiles WHERE id=p_actor_id;
 IF actor_active IS DISTINCT FROM TRUE THEN RETURN false; END IF;
 RETURN EXISTS(
  SELECT 1 FROM public.zoom_recordings z
  JOIN public.zoom_meetings m ON m.id=z.zoom_meeting_id AND m.purpose='class'
  JOIN public.schedule_events ev ON ev.id=m.schedule_event_id
  JOIN saas.academy_trainers tlink ON tlink.trainer_id=ev.trainer_id
  JOIN saas.organizations org ON org.id=tlink.organization_id AND org.status='active'
  JOIN saas.memberships mem ON mem.organization_id=org.id AND mem.user_id=p_actor_id AND mem.status='active'
  JOIN saas.module_entitlements ent ON ent.organization_id=org.id AND ent.module_key='academy' AND ent.enabled
  WHERE z.id=p_recording_id
   AND (ev.course_id IS NULL OR EXISTS(SELECT 1 FROM saas.academy_courses c
    WHERE c.course_id=ev.course_id AND c.organization_id=org.id))
   AND (ev.student_id IS NULL OR EXISTS(SELECT 1 FROM saas.academy_students st
    WHERE st.student_id=ev.student_id AND st.organization_id=org.id))
   AND (ev.enrollment_id IS NULL OR EXISTS(SELECT 1 FROM saas.academy_enrollments enr
    WHERE enr.enrollment_id=ev.enrollment_id AND enr.organization_id=org.id))
   AND (ev.cohort_id IS NULL OR EXISTS(SELECT 1 FROM public.cohorts c
    JOIN saas.academy_courses cl ON cl.course_id=c.course_id AND cl.organization_id=org.id
    WHERE c.id=ev.cohort_id AND (c.trainer_id IS NULL OR c.trainer_id=ev.trainer_id)))
   AND (
    (mem.role_key IN ('owner','admin') AND actor_role='admin')
    OR (actor_role='trainer' AND EXISTS(SELECT 1 FROM public.trainers tr
     WHERE tr.id=ev.trainer_id AND tr.profile_id=p_actor_id))
    OR (actor_role IN ('parent','student') AND EXISTS(
     SELECT 1 FROM public.students s JOIN saas.academy_students st
      ON st.student_id=s.id AND st.organization_id=org.id
     WHERE (
       (ev.student_id=s.id)
       OR EXISTS(SELECT 1 FROM public.enrollments e
        JOIN saas.academy_enrollments el ON el.enrollment_id=e.id AND el.organization_id=org.id
        WHERE e.student_id=s.id AND (e.id=ev.enrollment_id OR (ev.cohort_id IS NOT NULL AND e.cohort_id=ev.cohort_id)))
     ) AND (
      (actor_role='student' AND s.profile_id=p_actor_id)
      OR (actor_role='parent' AND EXISTS(SELECT 1 FROM public.parent_students ps
       JOIN public.parents p ON p.id=ps.parent_id
       WHERE ps.student_id=s.id AND p.profile_id=p_actor_id))
     )
    ))
   )
 );
END $fn$;
REVOKE ALL ON FUNCTION public.saas_academy_recording_scope(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.saas_academy_recording_scope(uuid,uuid) TO service_role;
COMMIT;
