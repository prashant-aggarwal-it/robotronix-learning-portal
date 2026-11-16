-- Phase 4F: deny expired subscriptions at direct Academy and module-link RPCs.
begin;
do $patch$
declare v_name text;v_sig text;v_def text;v_anchor text;v_inject text;
begin
 foreach v_name in array array[
 'saas_academy_v1','saas_academy_resource_owned',
 'saas_admin_academy_overview','saas_my_academy_trainer','saas_resolve_module_links'
 ] loop
  v_sig:=case v_name
   when 'saas_academy_v1' then 'public.saas_academy_v1(uuid,uuid,text,text,uuid,jsonb)'
   when 'saas_academy_resource_owned' then 'public.saas_academy_resource_owned(uuid,uuid,text,uuid)'
   when 'saas_admin_academy_overview' then 'public.saas_admin_academy_overview(uuid)'
   when 'saas_my_academy_trainer' then 'public.saas_my_academy_trainer(uuid)'
   else 'public.saas_resolve_module_links(uuid,uuid)' end;
  select pg_get_functiondef(v_sig::regprocedure) into v_def;
  if position('saas_subscription_access_v1' in v_def)>0 then continue;end if;
  v_anchor:=case v_name
   when 'saas_academy_v1' then 'BEGIN'
   when 'saas_academy_resource_owned' then 'BEGIN'
   when 'saas_admin_academy_overview' then 'begin'
   when 'saas_my_academy_trainer' then 'begin'
   else 'BEGIN' end;
  if position(v_anchor in v_def)=0 then raise exception 'Function body marker missing: %',v_name;end if;
  v_inject:=case when v_name='saas_academy_resource_owned'
   then ' IF NOT public.saas_subscription_access_v1(p_organization_id) THEN RETURN false; END IF;'
   else ' IF NOT public.saas_subscription_access_v1(p_organization_id) THEN RAISE EXCEPTION ''Subscription inactive'' USING ERRCODE=''42501''; END IF;' end;
  v_def:=overlay(v_def placing v_anchor||chr(10)||v_inject from position(v_anchor in v_def) for length(v_anchor));
  execute v_def;
 end loop;
end $patch$;
commit;