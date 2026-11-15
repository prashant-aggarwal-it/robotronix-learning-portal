-- Phase 11: rollback-only two-academy certification. Run on DEV, never PROD.
begin;
do $qa$
declare
  actor_a uuid:='3d0254db-7829-4e4d-9815-aed303b9e3d0';
  actor_b uuid:='7cf1882d-4e36-4205-b731-a94769e4655f';
  parent_a uuid:='d18c3afd-e663-4a5a-8c55-3af928d18d54';
  org_a uuid; org_b uuid; student_a uuid; student_b uuid;
  rejected boolean; family jsonb; links jsonb;
begin
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claim.sub',actor_a::text,true);
  org_a:=(public.saas_create_owned_organization('Milestone C Isolated A','milestone-c-test-a')->>'organizationId')::uuid;
  perform public.saas_provision_owned_modules(array['academy','crm','tasks']);
  perform set_config('request.jwt.claim.sub',actor_b::text,true);
  org_b:=(public.saas_create_owned_organization('Milestone C Isolated B','milestone-c-test-b')->>'organizationId')::uuid;
  perform public.saas_provision_owned_modules(array['academy']);

  perform set_config('request.jwt.claim.sub',actor_a::text,true);
  rejected:=false;
  begin perform public.saas_admin_academy_overview(org_b);
  exception when insufficient_privilege then rejected:=true; end;
  if not rejected then raise exception 'A read B academy overview';end if;

  rejected:=false;
  begin perform public.saas_resolve_module_links(actor_a,org_b);
  exception when insufficient_privilege then rejected:=true; end;
  if not rejected then raise exception 'A resolved B modules';end if;

  perform set_config('request.jwt.claim.sub',actor_b::text,true);
  rejected:=false;
  begin perform public.saas_invite_academy_family(org_a,gen_random_uuid(),'test@example.invalid','parent',repeat('b',64));
  exception when insufficient_privilege then rejected:=true;end;
  if not rejected then raise exception 'B could invite A family';end if;

  -- Synthetic students live only inside this transaction.
  perform set_config('request.jwt.claim.sub','',true);
  insert into public.students(full_name,grade,saas_org_id)
    values('Milestone C Student A','5',org_a) returning id into student_a;
  insert into public.students(full_name,grade,saas_org_id)
    values('Milestone C Student B','6',org_b) returning id into student_b;
  insert into saas.academy_students(organization_id,student_id)
    values(org_a,student_a),(org_b,student_b);
  perform set_config('request.jwt.claim.sub',actor_a::text,true);
  perform public.saas_invite_academy_family(org_a,student_a,'saas-e2e-6a6df0cc54-invited@example.invalid','parent',repeat('a',64));
  perform set_config('request.jwt.claim.sub',actor_b::text,true);
  rejected:=false;
  begin perform public.saas_accept_academy_family_invite(repeat('a',64));
  exception when insufficient_privilege then rejected:=true; end;
  if not rejected then raise exception 'Wrong email accepted family invite';end if;
  perform set_config('request.jwt.claim.sub',parent_a::text,true);
  perform public.saas_accept_academy_family_invite(repeat('a',64));
  perform set_config('request.jwt.claim.sub',actor_b::text,true);
  -- This user owns B, and must not see A's family data.
  family:=public.saas_my_academy_family();
  if exists(select 1 from jsonb_array_elements(family) f where f->>'organizationId'=org_a::text)
    then raise exception 'Cross-academy family data leaked';end if;

  perform set_config('request.jwt.claim.sub',actor_a::text,true);
  links:=public.saas_resolve_module_links(actor_a,org_a);
  if links #>> '{crm,status}'<>'ready' or links #>> '{tasks,status}'<>'ready'
    then raise exception 'A module links not ready: %',links;end if;
  perform set_config('request.jwt.claim.sub',actor_b::text,true);
  links:=public.saas_resolve_module_links(actor_b,org_b);
  if links #>> '{crm,status}'<>'disabled' or links #>> '{tasks,status}'<>'disabled'
    then raise exception 'B unexpectedly provisioned optional module';end if;
  raise notice 'Phase 11 two academy: PASS';
end $qa$;
select 'Phase 11 DEV two-academy isolation passed (rollback)' as result;
rollback;
