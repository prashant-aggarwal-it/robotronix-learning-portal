-- Phase 7A real DEV transactional acceptance. No test records survive ROLLBACK.
begin;
select set_config('request.jwt.claim.role','service_role',true);
do $qa$
declare admin_id uuid;owner_id uuid;owner_email text;v_slug text:='phase7a-qa-'||substr(md5(random()::text),1,12);
 secret_hash text:=encode(digest('phase7a-qa-'||gen_random_uuid()::text,'sha256'),'hex');
 created jsonb;accepted jsonb;org uuid;row_count integer;rejected boolean;
 h2 text:=encode(digest('phase7a-qa-revoke-'||gen_random_uuid()::text,'sha256'),'hex');
 h3 text:=encode(digest('phase7a-qa-expire-'||gen_random_uuid()::text,'sha256'),'hex');
 extra jsonb;
begin
 select user_id into admin_id from saas.platform_administrators where active order by user_id limit 1;
 select id,lower(email) into owner_id,owner_email from auth.users where email_confirmed_at is not null and
  coalesce(is_anonymous,false)=false and lower(email)<> 'contact@robotronixstemlab.com'
  order by created_at desc limit 1;
 if admin_id is null or owner_id is null then raise exception 'Missing DEV admin and verified test owner';end if;
 created:=public.saas_pending_customer_manage_v1(admin_id,'create',jsonb_build_object(
  'ownerEmail',owner_email,'name','Phase 7A Rollback QA','slug',v_slug,'kind','academy',
  'modules',jsonb_build_array('academy'),'tokenHash',secret_hash));
 if created->>'status'<>'pending' then raise exception 'Pending creation failed';end if;
 select count(*) into row_count from saas.organizations where slug=v_slug;
 if row_count<>0 then raise exception 'Pending customer prematurely activated';end if;
 rejected:=false;
 begin perform public.saas_accept_pending_customer_v1(secret_hash,admin_id);
 exception when insufficient_privilege then rejected:=true;end;
 if not rejected then raise exception 'Wrong email accepted';end if;
 accepted:=public.saas_accept_pending_customer_v1(secret_hash,owner_id);
 org:=(accepted->>'organizationId')::uuid;
 if org is null then raise exception 'No activated organization';end if;
 if not exists(select 1 from saas.memberships where organization_id=org and user_id=owner_id and role_key='owner' and status='active')
 then raise exception 'Owner not active';end if;
 if not exists(select 1 from saas.platform_subscriptions where organization_id=org and plan_code='trial' and status='trial')
 then raise exception 'Missing trial';end if;
 if not exists(select 1 from saas.module_entitlements where organization_id=org and module_key='academy' and enabled)
 then raise exception 'Missing module';end if;
 rejected:=false;
 begin perform public.saas_accept_pending_customer_v1(secret_hash,owner_id);
 exception when insufficient_privilege then rejected:=true;end;
 if not rejected then raise exception 'Replay accepted';end if;
 extra:=public.saas_pending_customer_manage_v1(admin_id,'create',jsonb_build_object(
  'ownerEmail',owner_email,'name','Phase 7A Revoke QA','slug',v_slug||'-rev','kind','academy',
  'modules',jsonb_build_array('academy'),'tokenHash',h2));
 perform public.saas_pending_customer_manage_v1(admin_id,'revoke',jsonb_build_object('id',extra->>'id'));
 rejected:=false;
 begin perform public.saas_accept_pending_customer_v1(h2,owner_id);
 exception when insufficient_privilege then rejected:=true;end;
 if not rejected then raise exception 'Revoked invitation accepted';end if;
 extra:=public.saas_pending_customer_manage_v1(admin_id,'create',jsonb_build_object(
  'ownerEmail',owner_email,'name','Phase 7A Expired QA','slug',v_slug||'-exp','kind','academy',
  'modules',jsonb_build_array('academy'),'tokenHash',h3));
 update saas.pending_customer_invitations set expires_at=now()-interval '1 minute'
 where id=(extra->>'id')::uuid;
 rejected:=false;
 begin perform public.saas_accept_pending_customer_v1(h3,owner_id);
 exception when insufficient_privilege then rejected:=true;end;
 if not rejected then raise exception 'Expired invitation accepted';end if;
 raise notice 'PASS Phase7A pending isolation, wrong email, atomic trial, one-time, revoked and expired invitations; ROLLBACK';
end $qa$;
rollback;