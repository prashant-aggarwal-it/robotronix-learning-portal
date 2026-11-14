-- Robotronix Education Suite Release 1: READ-ONLY compatibility preflight
-- Runs SELECTs only; no schema or data changes.
WITH required_tables(schema_name,object_name) AS (
 VALUES ('public','profiles'),('public','students'),('public','parents'),
 ('public','enrollments'),('public','schedule_events'),('public','class_attendance'),
 ('public','student_invoices'),('public','student_fee_payments'),
 ('public','trainer_earnings'),('public','trainer_payouts'),
 ('public','zoom_meetings'),('public','zoom_recordings'),('public','quizzes'),
 ('public','quiz_attempts'),('public','xp_transactions'),
 ('connect','tenants'),('connect','memberships'),('connect','opportunities'),
 ('connect','portal_admission_handoffs'),('connect','messages'),
 ('connect','whatsapp_send_requests'),('tasks','accounts'),('tasks','items'),
 ('tasks','workspace_members'),('tasks','module_links')
)
SELECT schema_name,object_name,
 to_regclass(format('%I.%I',schema_name,object_name)) IS NOT NULL AS exists,
 COALESCE(c.relrowsecurity,false) AS rls_enabled
FROM required_tables r LEFT JOIN pg_class c ON c.oid=to_regclass(format('%I.%I',schema_name,object_name))
ORDER BY 1,2;

WITH required_functions(signature) AS (VALUES
 ('public.current_role()'),
 ('public.is_admin()'),
 ('public.connect_portal_admissions(uuid,uuid,text,jsonb)'),
 ('public.connect_my_workspaces(uuid)'),
 ('public.task_account_get(uuid)'),
 ('public.task_module_link(uuid,text,text,uuid,uuid)'),
 ('public.task_module_links_list(uuid,text,uuid)')
)
SELECT signature,to_regprocedure(signature) IS NOT NULL AS exists FROM required_functions;

SELECT n.nspname schema_name,c.relname table_name,t.tgname trigger_name,
 p.oid::regprocedure::text AS function_signature
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_proc p ON p.oid=t.tgfoid
WHERE NOT t.tgisinternal AND (n.nspname,c.relname) IN (
 ('connect','tasks'),('tasks','items'),('tasks','notifications'),
 ('connect','opportunities'),('public','class_attendance'),
 ('public','enrollments'),('public','trainer_earnings'))
ORDER BY 1,2,3;
