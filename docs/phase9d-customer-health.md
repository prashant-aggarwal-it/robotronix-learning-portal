# Phase 9D — Customer, Subscription & Integration Health

- Added complete SQL aggregate counts across customers, trial and past-due subscriptions, pending and expired customer activations, invitation delivery failures and academy email connection states.
- The restricted invoker RPC `public.saas_platform_customer_health_v1` is callable by `service_role` only, with an authenticated platform administrator gate in the Next.js API.
- System Health now includes a Customer & Integrations tab and summary navigation.
- Integration coverage for Zoom and payments is explicitly not instrumented; email providers show connection metadata only, not live connectivity.
- Counts are full aggregates (not bounded list counts) and do not expose recipient emails, credentials or notification content.
- Applied only to DEV Supabase; production, Netlify and main branch untouched.
- Remaining release gates: authenticated browser UI verification, negative non-admin access, real integration probes in later scope.
