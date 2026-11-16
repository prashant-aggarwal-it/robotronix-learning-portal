-- Connect 2B end-to-end backend QA. All changes rolled back.
-- Uses two existing Development Auth accounts only; creates no permanent fixture.
begin;
select pg_catalog.set_config('qa.owner',(select id::text from auth.users where email is not null order by created_at limit 1),true);
select pg_catalog.set_config('qa.other',(select id::text from auth.users where email is not null and id<>current_setting('qa.owner')::uuid order by created_at limit 1),true);
set local role service_role;
select pg_catalog.set_config('qa.academy1',public.connect_create_workspace(current_setting('qa.owner')::uuid,'qa-connect2b-one','CRM Academy One')::text,true);
select pg_catalog.set_config('qa.academy2',public.connect_create_workspace(current_setting('qa.other')::uuid,'qa-connect2b-two','CRM Academy Two')::text,true);
do $qa$
declare actor uuid:=current_setting('qa.owner')::uuid; other_user uuid:=current_setting('qa.other')::uuid;
 t uuid:=current_setting('qa.academy1')::uuid; other_t uuid:=current_setting('qa.academy2')::uuid;
 parent_id uuid;learner_id uuid;home_id uuid;prog uuid;pipe uuid;first_stage uuid;won_stage uuid;
 opportunity_id uuid;task_id uuid;appointment_id uuid;member_id uuid;viewer_id uuid;
 response jsonb;
begin
 parent_id:=(public.connect_crm_write(actor,t,'create_person','{"name":"Parent Example","role":"guardian"}'))->>'id';
 learner_id:=(public.connect_crm_write(actor,t,'create_person','{"name":"Learner Example","role":"learner"}'))->>'id';
 perform public.connect_crm_write(actor,t,'add_contact_method',jsonb_build_object('personId',parent_id,'kind','email','value','Parent.Example@Example.test','primary',true));
 perform public.connect_crm_write(actor,t,'add_person_role',jsonb_build_object('personId',parent_id,'role','customer'));
 perform public.connect_crm_write(actor,t,'link_people',jsonb_build_object('personId',parent_id,'relatedPersonId',learner_id,'relationship','guardian'));
 home_id:=(public.connect_crm_write(actor,t,'create_household','{"name":"Example Family"}'))->>'id';
 perform public.connect_crm_write(actor,t,'link_household_member',jsonb_build_object('householdId',home_id,'personId',parent_id,'relation','guardian','primary',true));
 perform public.connect_crm_write(actor,t,'link_household_member',jsonb_build_object('householdId',home_id,'personId',learner_id,'relation','learner'));
 prog:=(public.connect_crm_write(actor,t,'create_program','{"name":"Python Training","code":"PY"}'))->>'id';
 pipe:=(public.connect_crm_write(actor,t,'create_pipeline','{"name":"Admissions"}'))->>'id';
 first_stage:=(public.connect_crm_write(actor,t,'add_stage',jsonb_build_object('pipelineId',pipe,'name','New Enquiry','order',1)))->>'id';
 won_stage:=(public.connect_crm_write(actor,t,'add_stage',jsonb_build_object('pipelineId',pipe,'name','Enrolled','order',2,'outcome','won')))->>'id';
 begin
  perform public.connect_crm_write(actor,t,'create_opportunity',jsonb_build_object('pipelineId',pipe,'stageId',won_stage,'title','Direct win','contactId',parent_id));
  raise exception 'Terminal initial stage accepted';
 exception when invalid_parameter_value then null;end;
 opportunity_id:=(public.connect_crm_write(actor,t,'create_opportunity',jsonb_build_object('pipelineId',pipe,'stageId',first_stage,'title','Python Admission','contactId',parent_id)))->>'id';
 perform public.connect_crm_write(actor,t,'link_opportunity_person',jsonb_build_object('opportunityId',opportunity_id,'personId',learner_id,'role','learner'));
 perform public.connect_crm_write(actor,t,'link_opportunity_program',jsonb_build_object('opportunityId',opportunity_id,'programId',prog));
 perform public.connect_crm_write(actor,t,'create_inquiry',jsonb_build_object('personId',parent_id,'opportunityId',opportunity_id,'source','whatsapp','summary','Question about Python training'));
 task_id:=(public.connect_crm_write(actor,t,'create_task',jsonb_build_object('opportunityId',opportunity_id,'title','Call guardian')))->>'id';
 perform public.connect_crm_write(actor,t,'update_task',jsonb_build_object('taskId',task_id,'dueAt','2026-11-08T09:00:00+05:30','title','Call guardian tomorrow'));
 perform public.connect_crm_write(actor,t,'complete_task',jsonb_build_object('taskId',task_id));
 perform public.connect_crm_write(actor,t,'log_activity',jsonb_build_object('opportunityId',opportunity_id,'kind','call','summary','Discussed course options'));
 appointment_id:=(public.connect_crm_write(actor,t,'create_appointment',jsonb_build_object('personId',parent_id,'title','Intro Call','kind','counselling','startsAt','2026-11-09T10:00:00+05:30','endsAt','2026-11-09T10:30:00+05:30')))->>'id';
 perform public.connect_crm_write(actor,t,'reschedule_appointment',jsonb_build_object('appointmentId',appointment_id,'startsAt','2026-11-09T11:00:00+05:30','endsAt','2026-11-09T11:30:00+05:30'));
 perform public.connect_crm_write(actor,t,'finish_appointment',jsonb_build_object('appointmentId',appointment_id,'status','completed'));
 perform public.connect_crm_write(actor,t,'move_opportunity',jsonb_build_object('opportunityId',opportunity_id,'stageId',won_stage,'version',1));
 response:=public.connect_crm_read(actor,t,'opportunities',jsonb_build_object('id',opportunity_id));
 if response->'items'->0->>'outcome'<>'won' then raise exception 'Won stage not shown';end if;
 if jsonb_array_length((public.connect_crm_read(actor,t,'contact_matches','{"search":"parent.example@example.test"}'))->'items')<>1 then raise exception 'Matching contact not found';end if;
 if jsonb_array_length((public.connect_crm_read(actor,t,'activities','{}'))->'items')<>1 then raise exception 'Activities missing';end if;
 if jsonb_array_length((public.connect_crm_read(actor,t,'timeline',jsonb_build_object('id',opportunity_id)))->'items')<>3 then raise exception 'Timeline activity/events missing';end if;
 if jsonb_array_length((public.connect_crm_read(actor,t,'households','{}'))->'items')<>1 then raise exception 'Household listing failed';end if;
 begin
  perform public.connect_crm_read(other_user,t,'people','{}');
  raise exception 'Cross-institute read allowed';
 exception when insufficient_privilege then null;end;
 begin
  perform public.connect_crm_write(other_user,t,'create_person','{"name":"Intruder"}');
  raise exception 'Cross-institute write allowed';
 exception when insufficient_privilege then null;end;
 begin
  perform public.connect_crm_write(other_user,other_t,'link_opportunity_program',jsonb_build_object('opportunityId',opportunity_id,'programId',prog));
  raise exception 'Cross-institute relationship allowed';
 exception when foreign_key_violation then null;end;
 begin
  perform public.connect_crm_write(actor,t,'move_opportunity',jsonb_build_object('opportunityId',opportunity_id,'stageId',first_stage,'version',1));
  raise exception 'Stale stage update allowed';
 exception when serialization_failure then null;end;
 member_id:=(select id from connect.memberships where tenant_id=t and user_id=actor);
 perform public.connect_crm_write(actor,t,'assign_opportunity',jsonb_build_object('opportunityId',opportunity_id,'ownerMemberId',member_id,'version',2));
 insert into connect.memberships(tenant_id,user_id,role,status)
 values(t,other_user,'viewer','active') returning id into viewer_id;
 if jsonb_array_length((public.connect_crm_read(other_user,t,'people','{}'))->'items')<>2 then raise exception 'Viewer read failed';end if;
 begin
  perform public.connect_crm_write(other_user,t,'create_person','{"name":"Viewer Write"}');
  raise exception 'Viewer write allowed';
 exception when insufficient_privilege then null;end;
 begin
  perform public.connect_crm_write(other_user,t,'create_pipeline','{"name":"Viewer Pipeline"}');
  raise exception 'Viewer configured pipeline';
 exception when insufficient_privilege then null;end;
 raise notice 'PASS CRM full lifecycle, viewer restrictions, cross-tenant isolation, validation, optimistic concurrency';
end $qa$;
rollback;