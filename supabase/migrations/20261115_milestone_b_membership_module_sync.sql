-- Milestone B: sync only mapped CRM/Tasks memberships for authorized SaaS roles.
-- Family/member identities intentionally receive no automatic CRM/Tasks access.
create or replace function saas.sync_module_membership()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_crm uuid;v_crm_enabled boolean:=false;v_tasks_enabled boolean:=false;
 v_crm_role text;v_tasks_role text;v_workspace record;
begin
 select exists(select 1 from saas.module_entitlements e where e.organization_id=NEW.organization_id
     and e.module_key='crm' and e.enabled),
        exists(select 1 from saas.module_entitlements e where e.organization_id=NEW.organization_id
     and e.module_key='tasks' and e.enabled)
 into v_crm_enabled,v_tasks_enabled;
 if not v_crm_enabled and not v_tasks_enabled then return NEW;end if;
 if v_crm_enabled then
  select l.crm_tenant_id into v_crm from saas.legacy_tenant_links l
  where l.organization_id=NEW.organization_id;
  v_crm_role:=case NEW.role_key
   when 'owner' then 'owner' when 'admin' then 'admin'
   when 'staff' then 'counsellor' else null end;
  if v_crm is not null then
   if NEW.status='active' and v_crm_role is not null then
    insert into connect.memberships(tenant_id,user_id,role,status)
    values(v_crm,NEW.user_id,v_crm_role,'active')
    on conflict(tenant_id,user_id) do update set role=excluded.role,status='active';
   else
    update connect.memberships set status='disabled'
    where tenant_id=v_crm and user_id=NEW.user_id;
   end if;
  end if;
 end if;
 if v_tasks_enabled then
  v_tasks_role:=case NEW.role_key
   when 'owner' then 'owner' when 'admin' then 'admin'
   when 'staff' then 'member' when 'trainer' then 'member'
   else null end;
  if NEW.status='active' and v_tasks_role is not null then
   insert into tasks.accounts(user_id) values(NEW.user_id)
   on conflict(user_id) do nothing;
  end if;
  for v_workspace in select workspace_id from saas.workspace_links
    where organization_id=NEW.organization_id loop
   if NEW.status='active' and v_tasks_role is not null then
    insert into tasks.workspace_members(workspace_id,user_id,role)
    values(v_workspace.workspace_id,NEW.user_id,v_tasks_role)
    on conflict(workspace_id,user_id) do update set role=excluded.role;
   else
    delete from tasks.workspace_members
    where workspace_id=v_workspace.workspace_id and user_id=NEW.user_id;
   end if;
  end loop;
 end if;
 return NEW;
end $$;
drop trigger if exists saas_sync_module_membership on saas.memberships;
create trigger saas_sync_module_membership
 after insert or update of role_key,status on saas.memberships
 for each row execute function saas.sync_module_membership();
