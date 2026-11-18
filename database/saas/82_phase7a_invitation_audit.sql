-- Phase 7A audit of pending invitations, throttling, secure link rotation and revocation.
begin;
create or replace function public.saas_pending_customer_manage_v1(
 p_actor uuid,p_action text,p_data jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $fn$
declare v saas.pending_customer_invitations%rowtype;v_id uuid;v_org uuid;v_slug text;
begin
 if auth.role()<>'service_role' or not exists(select 1 from saas.platform_administrators where user_id=p_actor and active)
 then raise exception 'Platform Admin required' using errcode='42501';end if;
 if p_action='list' then
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id',id,'owner_email',owner_email,'organization_name',organization_name,
    'organization_slug',organization_slug,'organization_kind',organization_kind,
    'module_keys',module_keys,'status',status,'expires_at',expires_at,
    'created_at',created_at,'accepted_at',accepted_at,'organization_id',organization_id)
    order by created_at desc)
    from (select * from saas.pending_customer_invitations order by created_at desc limit 100) p),'[]'::jsonb);
 elsif p_action='create' then
  v_slug:=p_data->>'slug';
  if exists(select 1 from saas.organizations where slug=v_slug) then
   raise exception 'Organization URL taken' using errcode='23505';end if;
  if (select count(*) from saas.pending_customer_invitations where created_by=p_actor and created_at>now()-interval '1 hour')>=20 then
   raise exception 'Too many invitations. Try later' using errcode='23514';end if;
  insert into saas.pending_customer_invitations(
   created_by,owner_email,owner_name,organization_name,organization_slug,
   organization_kind,module_keys,token_sha256
  )values(p_actor,p_data->>'ownerEmail',p_data->>'ownerName',p_data->>'name',
    v_slug,p_data->>'kind',array(select jsonb_array_elements_text(p_data->'modules')),
    p_data->>'tokenHash') returning * into v;
  insert into saas.platform_admin_audit(actor_user_id,action) values(p_actor,'pending_customer_invitation_created:'||v.id::text);
  return jsonb_build_object('id',v.id,'organization_slug',v.organization_slug,
   'status',v.status,'expires_at',v.expires_at);
 elsif p_action='rotate' then
  v_id:=(p_data->>'id')::uuid;
  update saas.pending_customer_invitations set token_sha256=p_data->>'tokenHash',
   expires_at=now()+interval '7 days',created_at=now()
   where id=v_id and status='pending' and created_at<now()-interval '60 seconds'
   returning * into v;
  if not found then raise exception 'Link not eligible for rotation yet' using errcode='23514';end if;
  insert into saas.platform_admin_audit(actor_user_id,action) values(p_actor,'pending_customer_invitation_rotated:'||v.id::text);
  return jsonb_build_object('id',v.id,'expires_at',v.expires_at);
 elsif p_action='revoke' then
  v_id:=(p_data->>'id')::uuid;
  update saas.pending_customer_invitations set status='revoked'
   where id=v_id and status='pending' returning * into v;
  if not found then raise exception 'Not pending' using errcode='23514';end if;
  insert into saas.platform_admin_audit(actor_user_id,action) values(p_actor,'pending_customer_invitation_revoked:'||v.id::text);
  return jsonb_build_object('id',v.id);
 end if;
 raise exception 'Invalid action' using errcode='22023';
end $fn$;
revoke all on function public.saas_pending_customer_manage_v1(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.saas_pending_customer_manage_v1(uuid,text,jsonb) to service_role;
commit;