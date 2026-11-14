-- FUTURE MODULE PLATFORM — BASE CANONICAL DDL
-- FUTURE DESIGN ONLY. Never run in active Release 1 installer.
-- Dependencies documented in database/future/manifest.json.
CREATE SCHEMA IF NOT EXISTS platform;
REVOKE ALL ON SCHEMA platform FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA platform TO service_role;
CREATE TABLE platform.organizations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text NOT NULL UNIQUE,
 name text NOT NULL, status text NOT NULL DEFAULT 'active'
 CHECK (status IN ('active','suspended','archived')), created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE platform.memberships (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES platform.organizations(id),
 user_id uuid NOT NULL REFERENCES auth.users(id),
 role_key text NOT NULL, status text NOT NULL DEFAULT 'active',
 UNIQUE(organization_id,user_id,role_key)
);

CREATE TABLE platform.identity_links (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES platform.organizations(id),
 source_module text NOT NULL, source_id uuid NOT NULL,
 target_module text NOT NULL, target_id uuid NOT NULL,
 verified_at timestamptz, UNIQUE(source_module,source_id,target_module,target_id)
);

CREATE TABLE platform.module_entitlements (
 organization_id uuid NOT NULL REFERENCES platform.organizations(id),
 module_key text NOT NULL, enabled boolean NOT NULL DEFAULT false,
 PRIMARY KEY(organization_id,module_key)
);

CREATE TABLE platform.domain_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid REFERENCES platform.organizations(id),
 source_module text NOT NULL, aggregate_type text NOT NULL, aggregate_id uuid NOT NULL,
 event_type text NOT NULL, event_version integer NOT NULL DEFAULT 1,
 idempotency_key text NOT NULL UNIQUE, payload jsonb NOT NULL DEFAULT '{}'::jsonb,
 recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE platform.event_deliveries (
 event_id uuid NOT NULL REFERENCES platform.domain_events(id),
 subscriber_key text NOT NULL, attempts integer NOT NULL DEFAULT 0,
 status text NOT NULL DEFAULT 'pending', next_attempt_at timestamptz,
 PRIMARY KEY(event_id,subscriber_key)
);

-- DENY BY DEFAULT: no anon/authenticated table grants.
ALTER TABLE platform.organizations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE platform.organizations FROM PUBLIC, anon, authenticated;
ALTER TABLE platform.memberships ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE platform.memberships FROM PUBLIC, anon, authenticated;
ALTER TABLE platform.identity_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE platform.identity_links FROM PUBLIC, anon, authenticated;
ALTER TABLE platform.module_entitlements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE platform.module_entitlements FROM PUBLIC, anon, authenticated;
ALTER TABLE platform.domain_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE platform.domain_events FROM PUBLIC, anon, authenticated;
ALTER TABLE platform.event_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE platform.event_deliveries FROM PUBLIC, anon, authenticated;
