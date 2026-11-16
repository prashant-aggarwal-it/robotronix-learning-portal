-- Phase 4E: close subscription bypasses in legacy CRM/Academy integration RPCs.
begin;
do $patch$
declare v_name text;v_def text;v_sig text;
begin
 foreach v_name in array array['saas_crm_portal_access_v1','saas_crm_portal_install_v1'] loop
  v_sig:=case when v_name='saas_crm_portal_access_v1' then 'public.saas_crm_portal_access_v1(uuid,uuid)' else 'public.saas_crm_portal_install_v1(uuid,uuid,text)' end;
  select pg_get_functiondef(v_sig::regprocedure) into v_def;
  if position('IF v_org IS NOT NULL THEN' in v_def)>0 then
   v_def:=replace(v_def,'IF v_org IS NOT NULL THEN',
    'IF v_org IS NOT NULL THEN'||chr(10)||
    '  IF NOT public.saas_subscription_access_v1(v_org) THEN RAISE EXCEPTION ''Subscription inactive'' USING ERRCODE=''42501'';END IF;');
  elsif position('IF v_org IS NULL THEN' in v_def)>0 then
   v_def:=replace(v_def,'IF v_org IS NULL THEN',
    'IF v_org IS NOT NULL AND NOT public.saas_subscription_access_v1(v_org) THEN RETURN false;END IF;'||chr(10)||' IF v_org IS NULL THEN');
  else
   raise exception 'Unexpected CRM function %',v_name;
  end if;
  execute v_def;
 end loop;
 select pg_get_functiondef('public.saas_my_academy_family()'::regprocedure) into v_def;
 if position('where a.user_id=auth.uid();' in v_def)=0 then raise exception 'Family function changed; inspect manually';end if;
 v_def:=replace(v_def,'where a.user_id=auth.uid();',
  'where a.user_id=auth.uid() and public.saas_subscription_access_v1(o.id);');
 execute v_def;
end $patch$;
commit;