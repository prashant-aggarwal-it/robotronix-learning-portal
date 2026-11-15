-- The canonical DB already provides saas_list_members_v1 with its established result shape.
-- Preserve its interface and ensure only service operations can execute it.
revoke all on function public.saas_list_members_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.saas_list_members_v1(uuid,uuid) to service_role;
