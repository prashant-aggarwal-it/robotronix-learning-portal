-- Phase 3G security inventory, read-only. Run on DEV/staging; never alters grants or policies.
-- Privileged functions callable by API roles. Review identity checks before revocation.
SELECT n.nspname AS schema_name, p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
       p.proconfig AS execution_settings
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE p.prosecdef AND n.nspname IN ('public','saas','connect','tasks')
  AND (has_function_privilege('anon',p.oid,'EXECUTE')
       OR has_function_privilege('authenticated',p.oid,'EXECUTE'))
ORDER BY n.nspname,p.proname,arguments;

-- Policy dependencies: functions used by policies, including policies granting anon/public.
SELECT schemaname,tablename,policyname,cmd,roles,permissive,qual,with_check
FROM pg_policies
WHERE schemaname IN ('public','saas','connect','tasks')
  AND (coalesce(qual,'') ~ '(can_read_|current_role|is_admin|is_parent_|is_student_|is_trainer_)'
       OR coalesce(with_check,'') ~ '(can_read_|current_role|is_admin|is_parent_|is_student_|is_trainer_)')
ORDER BY schemaname,tablename,policyname;

-- Possible exposed SECURITY DEFINER functions without search_path safeguards.
SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE p.prosecdef AND n.nspname IN ('public','saas','connect','tasks')
  AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig,ARRAY[]::text[])) opt WHERE opt LIKE 'search_path=%')
ORDER BY n.nspname,p.proname;
