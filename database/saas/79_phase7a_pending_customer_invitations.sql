-- Phase 7A: pending customers are not organizations and confer no access.
begin;
create table if not exists saas.pending_customer_invitations (
 id uuid primary key default gen_random_uuid(),
 created_by uuid not null references auth.users(id),
 owner_email text not null,
 owner_name text,
 organization_name text not null,
 organization_slug text not null,
 organization_kind text not null,
 module_keys text[] not null,
 token_sha256 text not null unique,
 request_key uuid not null unique default gen_random_uuid(),
 status text not null default 'pending' check(status in ('pending','accepted','revoked')),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default(now()+interval '7 days'),
 accepted_at timestamptz,
 organization_id uuid references saas.organizations(id),
 check(owner_email=lower(btrim(owner_email))),
 check(organization_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 check(length(token_sha256)=64)
);
create unique index if not exists pending_customer_slug_active_idx
 on saas.pending_customer_invitations(organization_slug) where status='pending';
create index if not exists pending_customer_owner_idx on saas.pending_customer_invitations(owner_email,status);
alter table saas.pending_customer_invitations enable row level security;
revoke all on saas.pending_customer_invitations from public,anon,authenticated;
grant select,insert,update on saas.pending_customer_invitations to service_role;
create or replace function public.saas_accept_pending_customer_v1(
 p_token_sha256 text,p_actor uuid
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $fn$
declare rec saas.pending_customer_invitations%rowtype;u auth.users%rowtype;result jsonb;
begin
 if auth.role()<>'service_role' then raise exception 'Service only' using errcode='42501';end if;
 if p_token_sha256 is null or length(p_token_sha256)<>64 then
  raise exception 'Invalid invitation' using errcode='22023';end if;
 select * into rec from saas.pending_customer_invitations where token_sha256=p_token_sha256 for update;
 if not found or rec.status<>'pending' or rec.expires_at<=now() then
  raise exception 'Invitation unavailable' using errcode='42501';end if;
 select * into u from auth.users where id=p_actor;
 if not found or u.email_confirmed_at is null or coalesce(u.is_anonymous,false) or
 lower(btrim(u.email))<>rec.owner_email then
  raise exception 'Verified invited email required' using errcode='42501';end if;
 -- Reuse the canonical transactional org/trial/module/CRM/Tasks provisioning RPC.
 result:=public.saas_onboard_organization_v1(
 rec.created_by,p_actor,rec.organization_name,rec.organization_slug,
 rec.organization_kind,rec.module_keys,rec.request_key,true);
 update saas.pending_customer_invitations set status='accepted',accepted_at=now(),
 organization_id=(result->>'organizationId')::uuid where id=rec.id;
 return result;
end $fn$;
revoke all on function public.saas_accept_pending_customer_v1(text,uuid) from public,anon,authenticated;
grant execute on function public.saas_accept_pending_customer_v1(text,uuid) to service_role;
commit;