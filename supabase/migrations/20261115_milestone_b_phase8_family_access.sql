-- Milestone B / Phase 8: tenant-scoped family/learner access.
-- Links reference the existing Academy student records; they do not duplicate students.
create table if not exists saas.academy_family_access(
 organization_id uuid not null references saas.organizations(id),
 student_id uuid not null references public.students(id),
 user_id uuid not null references auth.users(id) on delete cascade,
 access_role text not null check(access_role in ('parent','student')),
 created_at timestamptz not null default now(),
 primary key(organization_id,student_id,user_id,access_role)
);
create table if not exists saas.academy_family_invitations(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references saas.organizations(id),
 student_id uuid not null references public.students(id),
 email text not null,
 access_role text not null check(access_role in ('parent','student')),
 token_sha256 text not null unique check(token_sha256 ~ '^[a-f0-9]{64}$'),
 invited_by uuid not null references auth.users(id),
 status text not null default 'pending' check(status in ('pending','accepted','revoked')),
 expires_at timestamptz not null default now()+interval '7 days',
 accepted_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 accepted_at timestamptz
);
create index if not exists academy_family_access_user_idx on saas.academy_family_access(user_id,organization_id);
create index if not exists academy_family_invitation_org_idx on saas.academy_family_invitations(organization_id,status);
alter table saas.academy_family_access enable row level security;
alter table saas.academy_family_invitations enable row level security;
revoke all on saas.academy_family_access,saas.academy_family_invitations from public,anon,authenticated;

create or replace function public.saas_invite_academy_family(
 p_organization_id uuid,p_student_id uuid,p_email text,p_access_role text,p_token_sha256 text
) returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=auth.uid();v_inv uuid;v_email text:=lower(btrim(coalesce(p_email,'')));
begin
 if v_actor is null or auth.role()<>'authenticated' then raise exception 'Sign in required' using errcode='42501';end if;
 if p_access_role not in ('parent','student') or length(v_email)>254
 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
 or p_token_sha256 !~ '^[a-f0-9]{64}$' then raise exception 'Invalid invitation' using errcode='22023';end if;
 if not exists(select 1 from saas.memberships m join saas.organizations o on o.id=m.organization_id
 where m.organization_id=p_organization_id and m.user_id=v_actor and m.status='active'
 and m.role_key in ('owner','admin') and o.status='active')
 or not exists(select 1 from saas.module_entitlements e
 where e.organization_id=p_organization_id and e.module_key='academy' and e.enabled)
 or not exists(select 1 from saas.academy_students s
 where s.organization_id=p_organization_id and s.student_id=p_student_id)
 then raise exception 'Academy enrollment or admin permission unavailable' using errcode='42501';end if;
 insert into saas.academy_family_invitations(organization_id,student_id,email,access_role,token_sha256,invited_by)
 values(p_organization_id,p_student_id,v_email,p_access_role,p_token_sha256,v_actor) returning id into v_inv;
 return v_inv;
end $$;
revoke all on function public.saas_invite_academy_family(uuid,uuid,text,text,text) from public,anon;
grant execute on function public.saas_invite_academy_family(uuid,uuid,text,text,text) to authenticated;

create or replace function public.saas_accept_academy_family_invite(p_token_sha256 text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=auth.uid();v_email text;v_inv saas.academy_family_invitations%rowtype;
begin
 if v_actor is null or auth.role()<>'authenticated' then raise exception 'Sign in required' using errcode='42501';end if;
 select lower(btrim(email)) into v_email from auth.users
 where id=v_actor and email_confirmed_at is not null and deleted_at is null;
 if v_email is null then raise exception 'Verified email required' using errcode='42501';end if;
 select * into v_inv from saas.academy_family_invitations where token_sha256=p_token_sha256 for update;
 if not found or v_inv.email<>v_email or v_inv.status<>'pending' or v_inv.expires_at<=now()
 then raise exception 'Invitation invalid or expired' using errcode='42501';end if;
 if not exists(select 1 from saas.organizations o join saas.module_entitlements e on e.organization_id=o.id
 where o.id=v_inv.organization_id and o.status='active' and e.module_key='academy' and e.enabled)
 or not exists(select 1 from saas.academy_students s
 where s.organization_id=v_inv.organization_id and s.student_id=v_inv.student_id)
 then raise exception 'Academy not available' using errcode='42501';end if;
 if exists(select 1 from saas.memberships m where m.organization_id=v_inv.organization_id and m.user_id=v_actor and m.status<>'active')
 then raise exception 'Membership inactive' using errcode='42501';end if;
 insert into saas.memberships(organization_id,user_id,role_key,status)
 values(v_inv.organization_id,v_actor,'member','active')
 on conflict(organization_id,user_id) do nothing;
 insert into saas.academy_family_access(organization_id,student_id,user_id,access_role)
 values(v_inv.organization_id,v_inv.student_id,v_actor,v_inv.access_role)
 on conflict do nothing;
 update saas.academy_family_invitations set status='accepted',accepted_by=v_actor,accepted_at=now() where id=v_inv.id;
 return jsonb_build_object('organizationId',v_inv.organization_id,'accessRole',v_inv.access_role);
end $$;
revoke all on function public.saas_accept_academy_family_invite(text) from public,anon;
grant execute on function public.saas_accept_academy_family_invite(text) to authenticated;

create or replace function public.saas_my_academy_family()
returns jsonb language sql stable security definer set search_path=pg_catalog as $$
 select coalesce(jsonb_agg(jsonb_build_object(
 'organizationId',o.id,'academy',o.display_name,'slug',o.slug,
 'studentId',s.id,'studentName',s.full_name,'grade',s.grade,'accessRole',a.access_role)
 order by o.display_name,s.full_name),'[]'::jsonb)
 from saas.academy_family_access a
 join saas.organizations o on o.id=a.organization_id and o.status='active'
 join saas.academy_students ast on ast.student_id=a.student_id and ast.organization_id=o.id
 join public.students s on s.id=ast.student_id
 join saas.memberships m on m.user_id=auth.uid() and m.organization_id=o.id and m.status='active'
 join saas.module_entitlements e on e.organization_id=o.id and e.module_key='academy' and e.enabled
 where a.user_id=auth.uid();
$$;
revoke all on function public.saas_my_academy_family() from public,anon;
grant execute on function public.saas_my_academy_family() to authenticated;
