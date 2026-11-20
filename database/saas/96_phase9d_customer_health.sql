-- Phase 9D: exact aggregate health counts, service-only.
create or replace function public.saas_platform_customer_health_v1()
returns jsonb language sql security invoker set search_path='' as $$
select jsonb_build_object(
 'observedAt',now(),
 'customers',(select jsonb_build_object('total',count(*),'active',count(*) filter(where status='active'),'suspended',count(*) filter(where status='suspended')) from saas.organizations),
 'subscriptions',(select jsonb_build_object('pastDue',count(*) filter(where status='past_due'),
  'expiringTrials',count(*) filter(where status='trial' and ends_at between now() and now()+interval '7 days'),
  'expiredTrials',count(*) filter(where status='trial' and ends_at<now())) from saas.platform_subscriptions),
 'invitations',(select jsonb_build_object('pending',count(*) filter(where status='pending' and expires_at>=now()),
  'expired',count(*) filter(where status='pending' and expires_at<now())) from saas.pending_customer_invitations),
 'deliveries',(select jsonb_build_object('failed',count(*) filter(where status='failed'),
  'queued',count(*) filter(where status='queued')) from saas.customer_invitation_deliveries),
 'emailConnections',(select jsonb_build_object('connected',count(*) filter(where status='connected'),
  'attention',count(*) filter(where status<>'connected'),
  'total',count(*)) from saas.academy_email_connections),
 'integrationCoverage',jsonb_build_object('zoom','not_instrumented','payments','not_instrumented','smtp','connection_records_only','google','connection_records_only','microsoft','connection_records_only')
) $$;
revoke all on function public.saas_platform_customer_health_v1() from public,anon,authenticated;
grant execute on function public.saas_platform_customer_health_v1() to service_role;