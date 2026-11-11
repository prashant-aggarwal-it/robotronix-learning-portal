-- READ-ONLY verification to run AFTER explicit approval and installation of the pending RPC.
-- This script does not create or modify data.
select p.proname,p.prosecdef as security_definer,
       has_function_privilege('service_role',p.oid,'EXECUTE') as service_can_execute,
       has_function_privilege('anon',p.oid,'EXECUTE') as anon_can_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_can_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='connect_contact_timeline';
-- Expect exactly 1 function with service_can_execute=true, anon_can_execute=false,
-- authenticated_can_execute=false, security_definer=false.
-- End-to-end manual test in DEV: owner -> own contact (200), other tenant (403),
-- absent contact (403), paging with repeated timestamp, contact switch, viewer read-only.
