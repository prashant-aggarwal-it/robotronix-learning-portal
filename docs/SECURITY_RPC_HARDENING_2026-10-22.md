# Production RPC privilege correction — 22 October 2026

The consolidated `database/01_install/01_CREATE_SCHEMA.sql` includes these
privileges for all **new installations**. Existing deployments created before
this change require the following one-time permissions correction in Supabase
SQL Editor. It modifies privileges only; no application rows are touched.

```sql
begin;

revoke execute on function public.next_robotronix_invoice_number(date)
  from public, anon, authenticated;
revoke execute on function public.refresh_enrollment_progress(uuid)
  from public, anon, authenticated;
grant execute on function public.next_robotronix_invoice_number(date)
  to service_role;

do $$
begin
  if has_function_privilege('anon', 'public.next_robotronix_invoice_number(date)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.next_robotronix_invoice_number(date)', 'EXECUTE')
    or has_function_privilege('anon', 'public.refresh_enrollment_progress(uuid)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.refresh_enrollment_progress(uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.next_robotronix_invoice_number(date)', 'EXECUTE')
  then raise exception 'Privileged RPC permission hardening failed'; end if;
end $$;

commit;
```

Verify with this read-only query (anonymous/authenticated values must be `false`):

```sql
select p.proname,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon_can_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as user_can_execute,
 has_function_privilege('service_role',p.oid,'EXECUTE') as service_can_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
 and p.proname in ('next_robotronix_invoice_number','refresh_enrollment_progress')
order by p.proname;
```

After applying to production, test server-side Admin invoice creation and
attendance-driven enrollment progress updates. `refresh_enrollment_progress`
continues to be called by database triggers; invoice allocation continues via
the server's service-role client. Do **not** invoke either mutating RPC as a
security test on production merely to confirm denial: inspect privileges first.
