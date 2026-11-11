-- Phase 3: enforce bounded test sending at the database boundary.
-- Per-conversation and per-workspace limits include reserved/unknown attempts.
create or replace function connect.whatsapp_send_test_rate_guard()
returns trigger language plpgsql set search_path='' as $fn$
declare v_conversation_count int;v_workspace_count int;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  new.tenant_id::text||':whatsapp-test-send:'||new.conversation_id::text,0));
 select count(*) into v_conversation_count from connect.whatsapp_send_requests
 where tenant_id=new.tenant_id and conversation_id=new.conversation_id
 and created_at>now()-interval '1 minute';
 if v_conversation_count>=5 then
  raise exception 'Test conversation send rate limit reached' using errcode='22023';
 end if;
 select count(*) into v_workspace_count from connect.whatsapp_send_requests
 where tenant_id=new.tenant_id and created_at>now()-interval '1 hour';
 if v_workspace_count>=100 then
  raise exception 'Test workspace send rate limit reached' using errcode='22023';
 end if;
 return new;
end $fn$;
drop trigger if exists whatsapp_test_send_rate_guard on connect.whatsapp_send_requests;
create trigger whatsapp_test_send_rate_guard
 before insert on connect.whatsapp_send_requests
 for each row execute function connect.whatsapp_send_test_rate_guard();
