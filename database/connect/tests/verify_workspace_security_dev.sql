-- Development-only transactional QA. Requires at least two existing confirmed Supabase Auth users.
-- The entire script is rolled back; no workspace or invitation is retained.
begin;
do $preflight$
begin
 if (select count(*) from auth.users where email is not null) < 2 then
  raise exception 'At least two test Auth users are required';
 end if;
end $preflight$;
select pg_catalog.set_config('connect.qa_owner',(select id::text from auth.users where email is not null order by created_at limit 1),true);
select pg_catalog.set_config('connect.qa_invitee',(select id::text from auth.users where email is not null and id<>current_setting('connect.qa_owner')::uuid order by created_at limit 1),true);
select pg_catalog.set_config('connect.qa_email',(select lower(email) from auth.users where id=current_setting('connect.qa_invitee')::uuid),true);
set local role service_role;
select pg_catalog.set_config('connect.qa_tenant',
 public.connect_create_workspace(current_setting('connect.qa_owner')::uuid,'qa-connect-membership','QA Connect Membership')::text,true);
select public.connect_create_invitation(
 current_setting('connect.qa_owner')::uuid,current_setting('connect.qa_tenant')::uuid,
 current_setting('connect.qa_email'),'counsellor',repeat('a',64));
do $assert$
declare t uuid:=current_setting('connect.qa_tenant')::uuid;
 a uuid:=current_setting('connect.qa_owner')::uuid;
 b uuid:=current_setting('connect.qa_invitee')::uuid;
 member_id uuid;
begin
 if (select count(*) from public.connect_my_workspaces(a) where tenant_id=t)<>1 then
  raise exception 'Owner cannot access workspace';end if;
 if (select count(*) from public.connect_my_workspaces(b) where tenant_id=t)<>0 then
  raise exception 'Nonmember can see workspace';end if;
 begin
  perform * from public.connect_workspace_members(b,t);
  raise exception 'Nonmember enumerated members';
 exception when insufficient_privilege then null;end;
 begin
  perform public.connect_accept_invitation(b,'invalid@example.test',repeat('a',64));
  raise exception 'Mismatched invite email accepted';
 exception when insufficient_privilege then null;end;
 if public.connect_accept_invitation(b,current_setting('connect.qa_email'),repeat('a',64))<>t then
  raise exception 'Valid invitation rejected';end if;
 begin
  perform public.connect_accept_invitation(b,current_setting('connect.qa_email'),repeat('a',64));
  raise exception 'Invitation reused';
 exception when insufficient_privilege then null;end;
 select id into member_id from connect.memberships where tenant_id=t and user_id=b;
 begin
  perform public.connect_update_member(b,t,member_id,'owner','active');
  raise exception 'Counsellor self-promotion allowed';
 exception when insufficient_privilege then null;end;
 perform public.connect_update_member(a,t,member_id,'manager','active');
 perform public.connect_update_member(a,t,member_id,'manager','disabled');
 if exists(select 1 from public.connect_my_workspaces(b) where tenant_id=t) then
  raise exception 'Disabled membership still active';end if;
 select id into member_id from connect.memberships where tenant_id=t and user_id=a;
 begin
  perform public.connect_update_member(a,t,member_id,'viewer','active');
  raise exception 'Last owner downgraded';
 exception when insufficient_privilege then null;end;
end $assert$;
rollback;
