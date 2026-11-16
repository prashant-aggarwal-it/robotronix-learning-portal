-- Run inside a DEV transaction after migration 35; rollback all test fixtures.
do $test$
declare t uuid;a text:='999111222333444';v_contact text:='919999000001';v jsonb;
 v_person uuid;v_count int;v_body text;
begin
 select id into t from connect.tenants where status='active' limit 1;
 if t is null then raise exception 'Need an active DEV tenant';end if;
 insert into connect.channel_accounts(tenant_id,provider,external_account_id,display_name,status)
 values(t,'whatsapp',a,'Rollback-only Coexistence Fixture','active');
 v:=public.connect_sync_whatsapp_app_contact(a,v_contact,'Stage A Fixture','add',now()-interval '2 minutes');
 if not (v->>'applied')::boolean then raise exception 'Contact add failed';end if;
 select count(*) into v_count from connect.people p join connect.contact_methods cm
 on cm.tenant_id=p.tenant_id and cm.person_id=p.id
 where p.tenant_id=t and cm.normalized_value='+'||v_contact;
 if v_count<>1 then raise exception 'CRM contact not created';end if;
 v:=public.connect_sync_whatsapp_app_contact(a,v_contact,'Stale Name','remove',now()-interval '3 minutes');
 if (v->>'applied')::boolean then raise exception 'Stale contact update accepted';end if;
 v:=public.connect_import_whatsapp_history_thread(a,v_contact,jsonb_build_array(
  jsonb_build_object('id','wamid.stage_a_old_1','from',v_contact,
   'timestamp',extract(epoch from now()-interval '2 days')::bigint::text,
   'type','text','text',jsonb_build_object('body','Historical enquiry')),
  jsonb_build_object('id','wamid.stage_a_old_2','from','918595772008','to',v_contact,
   'timestamp',extract(epoch from now()-interval '1 day')::bigint::text,
   'type','text','text',jsonb_build_object('body','Earlier app reply'))));
 if (v->>'imported')::int<>2 then raise exception 'Historical import failed';end if;
 v:=public.connect_import_whatsapp_history_thread(a,v_contact,jsonb_build_array(
  jsonb_build_object('id','wamid.stage_a_old_1','from',v_contact,
   'timestamp',extract(epoch from now()-interval '2 days')::bigint::text,
   'type','text','text',jsonb_build_object('body','Historical enquiry'))));
 if (v->>'imported')::int<>0 then raise exception 'History dedupe failed';end if;
 select count(*) into v_count from connect.inquiries i join connect.contact_methods cm
 on cm.person_id=i.person_id and cm.tenant_id=i.tenant_id
 where i.tenant_id=t and cm.normalized_value='+'||v_contact;
 if v_count<>0 then raise exception 'Historical chat created sales enquiry';end if;
 v:=public.connect_revise_whatsapp_message(a,'wamid.stage_a_old_2','wamid.stage_a_edit_1',
 v_contact,'edit','Updated app reply',now()-interval '1 hour');
 if not (v->>'applied')::boolean then raise exception 'Echo edit failed';end if;
 v:=public.connect_revise_whatsapp_message(a,'wamid.stage_a_old_2','wamid.stage_a_revoke_1',
 v_contact,'revoke','',now());
 if not (v->>'applied')::boolean then raise exception 'Echo revoke failed';end if;
 select m.body into v_body from connect.messages m where m.tenant_id=t and m.external_message_id='wamid.stage_a_old_2';
 if v_body is not null then raise exception 'Revoked content remains visible';end if;
end $test$;
