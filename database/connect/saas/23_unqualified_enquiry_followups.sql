-- Initial next action for enquiries without admissions opportunities.
-- Prevent duplicate tasks on repeated WhatsApp messages from the same person.
begin;
create or replace function connect.automate_unqualified_inquiry()
returns trigger language plpgsql security invoker set search_path=''
as $fn$
declare v_policy connect.automation_settings%rowtype;v_assignee uuid;
begin
 if new.person_id is null or new.opportunity_id is not null then return new;end if;
 select * into v_policy from connect.automation_settings where tenant_id=new.tenant_id;
 if not found then
  insert into connect.automation_settings(tenant_id) values(new.tenant_id)
  on conflict(tenant_id) do nothing;
  select * into v_policy from connect.automation_settings where tenant_id=new.tenant_id;
 end if;
 if not v_policy.initial_followup_enabled then return new;end if;
 -- Serialize one-contact task creation across concurrent inbound channel deliveries.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  new.tenant_id::text||':initial-followup:'||new.person_id::text,0));
 if exists(select 1 from connect.tasks t where t.tenant_id=new.tenant_id and t.person_id=new.person_id
  and t.status='open') then return new;end if;
 select m.id into v_assignee from connect.memberships m
 where m.tenant_id=new.tenant_id and m.status='active'
  and m.role in ('counsellor','manager','admin','owner')
 order by case m.role when 'counsellor' then 0 when 'manager' then 1 when 'admin' then 2 else 3 end,
  (select count(*) from connect.tasks t where t.tenant_id=new.tenant_id and t.assignee_membership_id=m.id
   and t.status='open'),m.id limit 1;
 insert into connect.tasks(tenant_id,person_id,assignee_membership_id,title,due_at)
 values(new.tenant_id,new.person_id,v_assignee,'Review and follow up on enquiry',
 now()+pg_catalog.make_interval(hours=>v_policy.followup_delay_hours));
 return new;
end $fn$;
revoke all on function connect.automate_unqualified_inquiry() from public,anon,authenticated;
drop trigger if exists connect_inquiry_initial_followup on connect.inquiries;
create trigger connect_inquiry_initial_followup after insert on connect.inquiries
 for each row execute function connect.automate_unqualified_inquiry();
commit;