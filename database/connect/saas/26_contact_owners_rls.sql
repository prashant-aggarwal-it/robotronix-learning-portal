-- DEV Phase 3 defense in depth: private table access is service role only.
alter table connect.contact_owners enable row level security;
create index if not exists idx_connect_contact_owners_assigned_by
 on connect.contact_owners(tenant_id,assigned_by_membership_id);
revoke all on connect.contact_owners from public,anon,authenticated;
