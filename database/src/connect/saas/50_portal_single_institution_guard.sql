-- The current Learning Portal has one institutional data boundary.
-- Until it exposes a verifiable institute ID, do not connect two unrelated CRM tenants
-- to the same trainer/student database. Replace this guard when per-institution isolation ships.
create unique index if not exists connect_portal_single_active_integration
 on connect.portal_demo_integrations(status) where status='active';
