-- Phase 4C safeguard: do not enable modules without their provisioned workspace.
begin;
create or replace function saas.require_module_workspace_v1(p_organization_id uuid,p_module_key text)
returns boolean language plpgsql stable security definer set search_path=pg_catalog as $fn$
begin
 if p_module_key='crm' then
  return exists(select 1 from saas.legacy_tenant_links where organization_id=p_organization_id);
 elsif p_module_key='tasks' then
  return exists(select 1 from saas.workspace_links where organization_id=p_organization_id);
 elsif p_module_key='academy' then
  return true;
 end if;
 return false;
end $fn$;
revoke all on function saas.require_module_workspace_v1(uuid,text) from public,anon,authenticated;
grant execute on function saas.require_module_workspace_v1(uuid,text) to service_role;
-- Trigger runs in the same transaction as entitlement writes, including from privileged RPCs.
create or replace function saas.enforce_module_workspace_v1()
returns trigger language plpgsql security definer set search_path=pg_catalog as $fn$
begin
 if new.enabled and not saas.require_module_workspace_v1(new.organization_id,new.module_key)
 then raise exception 'Provision module workspace before enabling entitlement' using errcode='23514';end if;
 return new;
end $fn$;
drop trigger if exists enforce_module_workspace_4c on saas.module_entitlements;
create trigger enforce_module_workspace_4c before insert or update of enabled,module_key,organization_id
on saas.module_entitlements for each row execute function saas.enforce_module_workspace_v1();
commit;