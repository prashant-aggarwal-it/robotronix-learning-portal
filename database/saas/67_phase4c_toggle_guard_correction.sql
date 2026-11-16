-- The onboarding transaction creates entitlements before workspace links.
-- Therefore enforcement must occur on the admin module-toggle operation, not via an insert trigger.
begin;
drop trigger if exists enforce_module_workspace_4c on saas.module_entitlements;
do $guard$
declare v_def text;
begin
 select pg_get_functiondef('public.saas_platform_subscription_manage_v1(uuid,uuid,text,text,timestamptz,text,boolean)'::regprocedure) into v_def;
 if position('if p_module_key not in' in lower(v_def))=0 then
  raise exception 'Unexpected subscription management function; review guard patch';
 end if;
 v_def:=replace(v_def,
  'insert into saas.module_entitlements(organization_id,module_key,enabled)',
  'if p_enabled and not saas.require_module_workspace_v1(p_organization_id,p_module_key) then raise exception ''Provision module workspace before enabling entitlement'' using errcode=''23514'';end if;'||chr(10)||'  insert into saas.module_entitlements(organization_id,module_key,enabled)');
 if position('Provision module workspace before enabling entitlement' in v_def)=0 then
  raise exception 'Guard patch failed';
 end if;
 execute v_def;
end $guard$;
commit;