-- Final Overview closure: a dedicated unfiltered preview of three recent active-first organizations.
-- Service-only; browser clients never query private SaaS tables directly.
create or replace function public.saas_platform_customer_preview_v1(p_actor_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path=''
as $$
declare v_result jsonb;
begin
 if p_actor_id is null or not exists(
   select 1 from saas.platform_administrators a where a.user_id=p_actor_id and a.active
 ) then
  raise exception 'Platform administrator required' using errcode='42501';
 end if;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.is_active desc,t.created_at desc,t.id), '[]'::jsonb)
 into v_result
 from (
  select id,slug,display_name,status,created_at,(status='active') as is_active
  from saas.organizations
  order by (status='active') desc,created_at desc,id
  limit 3
 ) t;
 return v_result;
end $$;
revoke all on function public.saas_platform_customer_preview_v1(uuid) from public,anon,authenticated;
grant execute on function public.saas_platform_customer_preview_v1(uuid) to service_role;
