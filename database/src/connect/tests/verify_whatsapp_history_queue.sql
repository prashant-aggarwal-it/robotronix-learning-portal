-- Rollback-only DEV integration checks for the durable history queue.
do $test$
declare t uuid;v jsonb;j jsonb;v_id uuid;v_token uuid;v_id2 uuid;
begin
 select id into t from connect.tenants where status='active' limit 1;
 if t is null then raise exception 'Active DEV tenant missing';end if;
 insert into connect.channel_accounts(tenant_id,provider,external_account_id,display_name,status)
 values(t,'whatsapp','999222333444555','History queue rollback test','active');
 v:=public.connect_queue_whatsapp_history('999222333444555',repeat('a',64),
  '{"metadata":{"phase":1},"threads":[{"id":"919999000002","messages":[]}]}'::jsonb);
 if not (v->>'queued')::boolean then raise exception 'First history queue insert failed';end if;
 v_id:=(v->>'jobId')::uuid;
 v:=public.connect_queue_whatsapp_history('999222333444555',repeat('a',64),
  '{"metadata":{"phase":1},"threads":[{"id":"919999000002","messages":[]}]}'::jsonb);
 if (v->>'queued')::boolean or (v->>'jobId')::uuid<>v_id then raise exception 'History deduplication failed';end if;
 v:=public.connect_claim_whatsapp_history_jobs(1);
 j:=v->0;
 if (j->>'id')::uuid<>v_id then raise exception 'Queue claim failed';end if;
 v_token:=(j->>'leaseToken')::uuid;
 if public.connect_advance_whatsapp_history_job(v_id,gen_random_uuid(),1,0,0,true) then
  raise exception 'Forged lease token accepted';end if;
 if not public.connect_advance_whatsapp_history_job(v_id,v_token,1,0,0,true) then
  raise exception 'Queue completion failed';end if;
 if (select state from connect.whatsapp_history_jobs where id=v_id)<>'completed' then
  raise exception 'Queue completion state mismatch';end if;
 v:=public.connect_queue_whatsapp_history('999222333444555',repeat('b',64),'{"threads":[]}'::jsonb);
 v_id2:=(v->>'jobId')::uuid;
 v:=public.connect_claim_whatsapp_history_jobs(1);j:=v->0;
 if (j->>'id')::uuid<>v_id2 then raise exception 'Second queue claim failed';end if;
 if not public.connect_fail_whatsapp_history_job(v_id2,(j->>'leaseToken')::uuid,'HISTORY_IMPORT_FAILED') then
  raise exception 'Queue retry recording failed';end if;
 if (select state from connect.whatsapp_history_jobs where id=v_id2)<>'retry' then
  raise exception 'Queue retry state mismatch';end if;
end $test$;
