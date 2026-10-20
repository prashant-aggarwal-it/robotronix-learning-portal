-- Expand portal-access state for passwordless Admin-granted accounts.
-- This is an additive DEV migration, not a full schema install.
begin;
alter table public.portal_access_requests
 drop constraint if exists portal_access_requests_status_check;
alter table public.portal_access_requests
 add constraint portal_access_requests_status_check
 check(status in ('invited','provisioned','linked','disabled'));
commit;
