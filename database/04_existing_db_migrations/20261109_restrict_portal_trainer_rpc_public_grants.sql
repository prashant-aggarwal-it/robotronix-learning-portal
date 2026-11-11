-- Phase A targeted privilege hardening, applied first in Development.
-- Both functions require auth.uid()/admin role; neither is intended for anonymous RPC.
-- PUBLIC grant makes anon execution possible even when anon isn't explicitly granted.
-- Preserve authenticated and service_role execution for existing Portal workflows.

revoke execute on function public.review_trainer_finance_request(uuid,text,text) from public, anon;
revoke execute on function public.update_own_trainer_profile(text,text,text,text,text,text[]) from public, anon;

grant execute on function public.review_trainer_finance_request(uuid,text,text) to authenticated, service_role;
grant execute on function public.update_own_trainer_profile(text,text,text,text,text,text[]) to authenticated, service_role;
