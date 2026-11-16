-- Phase 3B Development QA: rollback-only end-to-end automation tests.
-- Needs two existing Development Supabase Auth users.
begin;
select pg_catalog.set_config('qa.owner',(select id::text from auth.users where email is not null order by created_at limit 1),true);
select pg_catalog.set_config('qa.agent',(select id::text from auth.users where email is not null and id<>current_setting('qa.owner')::uuid order by created_at limit 1),true);
set local role service_role;
select pg_catalog.set_config('qa.tenant',public.connect_create_workspace(current_setting('qa.owner')::uuid,'qa-3b-automation','QA 3B Automation')::text,true);
do $qa$
declare owner_id uuid:=current_setting('qa.owner')::uuid;agent_id uuid:=current_setting('qa.agent')::uuid;t uuid:=current_setting('qa.tenant')::uuid;
 m uuid;p uuid;pipe uuid;st uuid;o uuid;task_id uuid;res jsonb;channel_id uuid;
begin
 insert into connect.memberships(tenant_id,user_id,role,status)
 values(t,agent_id,'counsellor','active') returning id into m;
 res:=public.connect_automation_settings(owner_id,t,
  '{"followupDelayHours":2,"reminderAdvanceMinutes":60}');
 if (res->>'followupDelayHours')::int<>2 then raise exception 'Rule not saved';end if;
 begin
  perform public.connect_automation_settings(agent_id,t,'{"assignmentEnabled":false}');
  raise exception 'Non-admin modified automation policy';
 exception when insufficient_privilege then null;end;
 p:=(public.connect_crm_write(owner_id,t,'create_contact',
  '{"name":"QA Parent","phone":"+919888888888"}'))->>'id';
 pipe:=(public.connect_crm_write(owner_id,t,'bootstrap_pipeline',
  '{"name":"Admissions"}'))->>'id';
 select id into st from connect.pipeline_stages
 where tenant_id=t and pipeline_id=pipe and sort_order=0;
 -- Explicitly test new manual enquiry auto-assignment (not just webhook ingestion).
 res:=public.connect_crm_write(owner_id,t,'capture_lead',
   jsonb_build_object('personId',p,'name','QA Parent','source','phone',
    'pipelineId',pipe,'stageId',st));
 o:=(res->>'opportunityId')::uuid;
 if (select owner_membership_id from connect.opportunities where tenant_id=t and id=o)<>m then
  raise exception 'New enquiry not assigned to counsellor';end if;
 select id into task_id from connect.tasks where tenant_id=t and opportunity_id=o;
 if task_id is null or (select assignee_membership_id from connect.tasks where id=task_id)<>m
 then raise exception 'Initial follow-up not assigned';end if;
 update connect.tasks set due_at=now()+interval '10 minutes' where tenant_id=t and id=task_id;
 res:=public.connect_run_reminders(100);
 if (res->>'created')::int<>1 then raise exception 'Upcoming reminder missing %',res;end if;
 res:=public.connect_run_reminders(100);
 if (res->>'created')::int<>0 then raise exception 'Repeated due reminder';end if;
 if jsonb_array_length(public.connect_staff_inbox(agent_id,t,'list',null))<>1 then
  raise exception 'Counsellor has no reminder';end if;
 if jsonb_array_length(public.connect_staff_inbox(owner_id,t,'list',null))<>0 then
  raise exception 'Reminder leaked to owner';end if;
 update connect.tasks set due_at=now()-interval '2 minutes' where tenant_id=t and id=task_id;
 res:=public.connect_run_reminders(100);
 if (res->>'created')::int<>1 then raise exception 'Overdue alert missing';end if;
 perform public.connect_staff_inbox(agent_id,t,'read',(
   select id from connect.staff_notifications where tenant_id=t
   and member_id=m order by created_at,id limit 1));
 if (select count(*) from connect.staff_notifications where tenant_id=t and read_at is not null)<>1
 then raise exception 'Mark-read not saved';end if;
 -- Turning automation off prevents new initial follow-ups and assignments.
 perform public.connect_automation_settings(owner_id,t,
   '{"assignmentEnabled":false,"initialFollowupEnabled":false,"remindersEnabled":false}');
 res:=public.connect_crm_write(owner_id,t,'create_opportunity',
  jsonb_build_object('title','Manual opportunity','contactId',p,'pipelineId',pipe,'stageId',st));
 if (select owner_membership_id from connect.opportunities where tenant_id=t
    and id=(res->>'id')::uuid) is not null then
  raise exception 'Assignment ignored disabled policy';end if;
 if exists(select 1 from connect.tasks where tenant_id=t
   and opportunity_id=(res->>'id')::uuid) then raise exception 'Follow-up ignored disabled policy';end if;
 if (public.connect_run_reminders(100)->>'created')::int<>0 then
  raise exception 'Reminder ignored disabled policy';end if;
 channel_id:=public.connect_register_channel(owner_id,t,'whatsapp','qa-3b-00001','Test WhatsApp');
 perform public.connect_set_channel_status(owner_id,t,channel_id,'active');
 perform public.connect_ingest_channel('whatsapp','qa-3b-00001','wamid.3b.123',
   'QA Parent',null,'+919888888888','What is the fee?');
 if jsonb_array_length(public.connect_conversation_history(agent_id,t,p,40))<>1 then
  raise exception 'Staff cannot see conversation history';end if;
 begin
  perform public.connect_conversation_history(owner_id,t,gen_random_uuid(),40);
  raise exception 'Unrelated contact was accepted';
 exception when insufficient_privilege then null;end;
 raise notice 'PASS 3B auto-assignment, follow-up, reminder scheduling logic, read state, config off, conversation isolation';
end $qa$;
rollback;