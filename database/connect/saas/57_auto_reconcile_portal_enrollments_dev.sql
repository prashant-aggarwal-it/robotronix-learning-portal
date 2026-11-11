-- Automatic once-only confirmation after Portal has truly activated enrolment.
-- Rechecks verified guardian binding, consent, active onboarding and active enrolment.
create or replace function public.connect_reconcile_portal_enrollments(p_batch_size int default 100)
returns jsonb language plpgsql security invoker set search_path='' as $fn$
declare v record;v_count int:=0;v_stage uuid;v_current uuid;
begin
 for v in select h.id,h.tenant_id,h.opportunity_id,h.onboarding_submission_id,
    ob.activated_student_id,ob.activated_enrollment_id
   from connect.portal_admission_handoffs h
   join connect.portal_demo_integrations i on i.tenant_id=h.tenant_id and i.status='active'
   join public.onboarding_submissions ob on ob.id=h.onboarding_submission_id and ob.status='active'
    and ob.data_consent=true and ob.activated_student_id is not null and ob.activated_enrollment_id is not null
   join public.enrollments en on en.id=ob.activated_enrollment_id and en.student_id=ob.activated_student_id and en.status='active'
   where h.status='onboarding_pending' and h.verified_at is not null
   order by h.created_at for update of h skip locked limit least(greatest(p_batch_size,1),500)
 loop
  select o.stage_id into v_current from connect.opportunities o where o.id=v.opportunity_id and o.tenant_id=v.tenant_id for update;
  select s.id into v_stage from connect.pipeline_stages s join connect.opportunities o on o.tenant_id=s.tenant_id and o.pipeline_id=s.pipeline_id
    where o.id=v.opportunity_id and o.tenant_id=v.tenant_id and s.outcome='won' order by s.sort_order limit 1;
  if v_stage is null then continue;end if;
  update connect.portal_admission_handoffs set status='enrollment_confirmed',portal_enrollment_id=v.activated_enrollment_id,
   portal_student_id=v.activated_student_id,confirmed_at=now(),updated_at=now() where id=v.id;
  if v_current is distinct from v_stage then
   update connect.opportunities set stage_id=v_stage,closed_at=now(),version=version+1,updated_at=now()
    where tenant_id=v.tenant_id and id=v.opportunity_id;
   insert into connect.stage_events(tenant_id,opportunity_id,pipeline_id,from_stage_id,to_stage_id,note)
    select v.tenant_id,v.opportunity_id,o.pipeline_id,v_current,v_stage,'Portal enrollment confirmed automatically'
    from connect.opportunities o where o.tenant_id=v.tenant_id and o.id=v.opportunity_id;
  end if;
  v_count:=v_count+1;
 end loop;
 return jsonb_build_object('confirmed',v_count);
end $fn$;
revoke all on function public.connect_reconcile_portal_enrollments(int) from public,anon,authenticated;
grant execute on function public.connect_reconcile_portal_enrollments(int) to service_role;

-- Development only; production scheduling remains an explicit deployment decision.
select cron.schedule('robotronix-connect-inapp-reminders','*/5 * * * *',
 'select public.connect_run_reminders(500),public.connect_process_portal_demo_followups(100),public.connect_reconcile_portal_enrollments(100);');
