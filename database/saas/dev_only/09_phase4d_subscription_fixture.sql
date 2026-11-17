-- DEV-ONLY Phase 4D authenticated subscription-expiry fixture; NEVER add to production installers.
begin;
create or replace function public.saas_qa_phase4d_subscription_window(
 p_organization_id uuid,p_action text,p_started_at timestamptz default null,p_ends_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $fn$
declare v_sub saas.platform_subscriptions%rowtype;v_slug text;
begin
 if auth.role()<>'service_role' then
  raise exception 'DEV fixture service role required' using errcode='42501';
 end if;
 select slug into v_slug from saas.organizations where id=p_organization_id for update;
 if v_slug !~ '^saas-e2e-[ab]-[a-f0-9]{12}$' then
  raise exception 'Only synthetic E2E school A or B permitted' using errcode='42501';
 end if;
 select * into v_sub from saas.platform_subscriptions where organization_id=p_organization_id
 order by started_at desc,id desc limit 1 for update;
 if v_sub.id is null or v_sub.plan_code<>'qa_trial' or v_sub.status<>'trial' then
  raise exception 'Non-synthetic subscription fixture denied' using errcode='42501';
 end if;
 if p_action='expire' then
  update saas.platform_subscriptions set started_at=now()-interval '2 minutes',
   ends_at=now()-interval '1 minute' where id=v_sub.id;
 elsif p_action='restore' then
  if p_started_at is null or p_ends_at is null or p_ends_at<=p_started_at
   or p_ends_at<=now() then
   raise exception 'Invalid subscription restoration window' using errcode='22023';
  end if;
  update saas.platform_subscriptions set started_at=p_started_at,ends_at=p_ends_at
  where id=v_sub.id;
 else
  raise exception 'Unsupported fixture action' using errcode='22023';
 end if;
 return jsonb_build_object('id',v_sub.id,'originalStart',v_sub.started_at,
  'originalEnd',v_sub.ends_at,'action',p_action);
end $fn$;
revoke all on function public.saas_qa_phase4d_subscription_window(uuid,text,timestamptz,timestamptz)
 from public,anon,authenticated;
grant execute on function public.saas_qa_phase4d_subscription_window(uuid,text,timestamptz,timestamptz)
 to service_role;
commit;
