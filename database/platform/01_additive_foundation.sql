-- Phase 2.4 additive Platform foundation. DO NOT run against DEV until approval.
-- Requires Supabase auth schema. Installs no Portal, CRM or Tasks objects.
BEGIN;
CREATE SCHEMA IF NOT EXISTS platform;
REVOKE ALL ON SCHEMA platform FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA platform TO service_role;

CREATE TABLE IF NOT EXISTS platform.organizations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
 slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','archived')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS platform.organization_memberships (
 organization_id uuid NOT NULL REFERENCES platform.organizations(id) ON DELETE RESTRICT,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 role text NOT NULL CHECK (role IN ('owner','admin','manager','member','viewer')),
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('invited','active','suspended','removed')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (organization_id,user_id)
);
CREATE INDEX IF NOT EXISTS platform_memberships_user_status_idx
 ON platform.organization_memberships(user_id,status);
CREATE TABLE IF NOT EXISTS platform.product_entitlements (
 organization_id uuid NOT NULL REFERENCES platform.organizations(id) ON DELETE RESTRICT,
 product_id text NOT NULL CHECK (product_id IN ('portal','crm','tasks')),
 status text NOT NULL DEFAULT 'disabled' CHECK (status IN ('enabled','disabled','suspended')),
 starts_at timestamptz,
 ends_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (organization_id,product_id),
 CONSTRAINT platform_entitlement_dates CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at>starts_at)
);

ALTER TABLE platform.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.product_entitlements ENABLE ROW LEVEL SECURITY;
-- No policies for anon/authenticated: deny by default. Do not add user-facing
-- policies until membership decisions can be securely tested across modules.
REVOKE ALL ON ALL TABLES IN SCHEMA platform FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA platform TO service_role;
COMMIT;
