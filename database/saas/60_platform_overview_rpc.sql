begin;
create or replace function public.saas_platform_overview_v1(p_actor_id uuid,p_limit integer default 20,p_offset integer default 0,p_search text default '')
returns jsonb language plpgsql stable security definer set search_path=pg_catalog
as $fn$
declare v_result jsonb;
begin
 if p_actor_id is null or not exists(select 1 from saas.platform_administrators a where a.user_id=p_actor_id and a.active) then
  raise exception 'Platform administrator required' using errcode='42501';
 end if;
 if p_limit<1 or p_limit>100 or p_offset<0 or length(coalesce(p_search,''))>80 then
  raise exception 'Invalid pagination or search' using errcode='22023';
 end if;
 select jsonb_build_object(
  'metrics',jsonb_build_object(
   'organizations',(select count(*) from saas.organizations),
   'trials',(select count(*) from saas.platform_subscriptions where status='trial'),
   'activeSubscriptions',(select count(*) from saas.platform_subscriptions where status='active')),
  'total',(select count(*) from saas.organizations where p_search='' or position(lower(p_search) in lower(display_name))>0),
  'organizations',coalesce((select jsonb_agg(to_jsonb(x)) from (
    select id,slug,display_name,status,created_at from saas.organizations
    where p_search='' or position(lower(p_search) in lower(display_name))>0
    order by created_at desc,id limit p_limit offset p_offset
  ) x),'[]'::jsonb)
 ) into v_result;
 return v_result;
end $fn$;
revoke all on function public.saas_platform_overview_v1(uuid,integer,integer,text) from public,anon,authenticated;
grant execute on function public.saas_platform_overview_v1(uuid,integer,integer,text) to service_role;
commit;