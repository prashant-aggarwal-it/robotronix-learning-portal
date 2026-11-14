-- Read-only DEV certification reset safety inventory.
-- Never run destructive reset on the basis of this report alone.
-- Target: DEV uzzuquxeeqonxeqcuohh. No PROD writes.
SELECT current_database() AS database_name,
       current_user AS executing_role,
       (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
         WHERE c.relkind IN ('r','p') AND n.nspname='public') AS public_tables,
       (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
         WHERE c.relkind IN ('r','p') AND n.nspname='connect') AS crm_tables,
       (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
         WHERE c.relkind IN ('r','p') AND n.nspname='tasks') AS tasks_tables,
       (SELECT count(*) FROM auth.users) AS auth_users,
       to_regclass('cron.job') IS NOT NULL AS pg_cron_jobs_table_present,
       (SELECT coalesce(jsonb_agg(jsonb_build_object('extension',e.extname,'schema',n.nspname)),'[]'::jsonb)
        FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace
        WHERE n.nspname IN ('public','tasks','connect')) AS extensions_inside_reset_scope,
       (SELECT count(*) FROM pg_trigger WHERE tgrelid='auth.users'::regclass AND NOT tgisinternal) AS custom_auth_user_triggers;
