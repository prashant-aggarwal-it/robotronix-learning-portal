-- Phase 4A: prevent the legacy two-step signup RPC from bypassing trial provisioning.
-- Existing tenant memberships and the legacy module setup RPC are preserved.
begin;
revoke execute on function public.saas_create_owned_organization(text,text) from authenticated;
-- Defensive: ensure legacy creation is not granted to PUBLIC.
revoke all on function public.saas_create_owned_organization(text,text) from public,anon;
commit;