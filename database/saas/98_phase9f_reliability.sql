-- Phase 9F: read-only reliability evidence, not a claim about managed backups.
create or replace function public.saas_platform_reliability_v1()
returns jsonb language sql security invoker set search_path='' as $$
select jsonb_build_object(
 'observedAt',now(),
 'database',jsonb_build_object('reachable',true,'sizeBytes',pg_database_size(current_database())),
 'backup',jsonb_build_object('status','unverified','lastVerifiedAt',null,'restoreTestedAt',null,'rpoMinutes',null,'rtoMinutes',null),
 'externalUptime',jsonb_build_object('status','not_configured','uptimePercent',null),
 'storage',jsonb_build_object('status','not_instrumented'),
 'scope','Current database measurement only. Managed backup configuration and restore readiness require provider evidence.'
) $$;
revoke all on function public.saas_platform_reliability_v1() from public,anon,authenticated;
grant execute on function public.saas_platform_reliability_v1() to service_role;