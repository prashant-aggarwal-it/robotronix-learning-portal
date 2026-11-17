-- Phase 4D DEV hardening: ensure direct Academy CRUD RPC enforces live subscriptions.
-- Repair pre-existing direct-RPC bypass without replacing unrelated Academy logic.
begin;
do $patch$
declare v_sig text := 'public.saas_academy_v1(uuid,uuid,text,text,uuid,jsonb)';
        v_def text;
        v_anchor text := ' SELECT m.role_key INTO v_role';
begin
 select pg_get_functiondef(to_regprocedure(v_sig)) into v_def;
 if v_def is null then raise exception 'Missing expected Academy RPC: %',v_sig; end if;
 if position('saas_subscription_access_v1' in v_def)>0 then return; end if;
 if position(v_anchor in v_def)=0 then
  raise exception 'Unexpected Academy RPC structure; inspect manually';
 end if;
 v_def:=replace(v_def,v_anchor,
  ' IF NOT public.saas_subscription_access_v1(p_organization_id) THEN'||chr(10)||
  '  RAISE EXCEPTION ''Subscription inactive'' USING ERRCODE=''42501'';'||chr(10)||
  ' END IF;'||chr(10)||v_anchor);
 execute v_def;
 if position('saas_subscription_access_v1' in
  pg_get_functiondef(to_regprocedure(v_sig)))=0 then
  raise exception 'Academy subscription guard not installed';
 end if;
end $patch$;
commit;
