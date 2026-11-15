-- Milestone A / Phase 3: authenticated, atomic organization + owner creation.
-- DEV only until deployment approval. Module provisioning belongs to Phase 4.
create or replace function public.saas_create_owned_organization(
 p_name text, p_slug text
) returns jsonb
language plpgsql security definer
set search_path = pg_catalog
as $function$
declare
 v_user uuid := auth.uid();
 v_org uuid;
 v_name text := btrim(coalesce(p_name,''));
 v_slug text := lower(btrim(coalesce(p_slug,'')));
begin
 if v_user is null or current_user not in ('postgres','supabase_admin','service_role') and auth.role() <> 'authenticated' then
  raise exception 'Authentication required' using errcode='42501';
 end if;
 if char_length(v_name) < 2 or char_length(v_name) > 160 then
  raise exception 'Organization name must be 2–160 characters' using errcode='22023';
 end if;
 if char_length(v_slug) < 3 or char_length(v_slug) > 63 or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
  raise exception 'Use a slug of 3–63 lowercase letters, digits or single hyphens' using errcode='22023';
 end if;
 if v_slug in ('admin','api','auth','app','apps','connect','login','signup','tasks','portal','student','parent','trainer','onboarding','workspace','www','support','settings','robotronix') then
  raise exception 'This academy URL is reserved. Choose another.' using errcode='22023';
 end if;
 -- An existing active SaaS owner must use their existing organization rather
 -- than accidentally creating duplicates during OAuth redirects/retries.
 if exists (
   select 1 from saas.memberships m
   where m.user_id=v_user and m.role_key='owner' and m.status='active'
 ) then
  raise exception 'You already own an organization. Sign in to manage it.' using errcode='23514';
 end if;
 insert into saas.organizations(slug,display_name,status)
 values(v_slug,v_name,'active') returning id into v_org;
 insert into saas.memberships(organization_id,user_id,role_key,status)
 values(v_org,v_user,'owner','active');
 return jsonb_build_object('organizationId',v_org,'slug',v_slug,'name',v_name);
exception
 when unique_violation then
  raise exception 'This academy URL is already taken. Choose another.' using errcode='23505';
end
$function$;
revoke all on function public.saas_create_owned_organization(text,text) from public,anon;
grant execute on function public.saas_create_owned_organization(text,text) to authenticated;
