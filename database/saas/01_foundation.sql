-- Robotronix SaaS foundation v1: additive, private, backward compatible.
-- No changes to existing public/connect/tasks tables, functions or policies.
BEGIN;
DO $guard$ BEGIN IF to_regnamespace('saas') IS NOT NULL THEN RAISE EXCEPTION 'saas already installed'; END IF; END $guard$;
CREATE SCHEMA saas;
REVOKE ALL ON SCHEMA saas FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA saas TO service_role, authenticated;
CREATE TABLE saas.organizations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{2,62}$'),
 display_name text NOT NULL CHECK (length(trim(display_name)) BETWEEN 1 AND 160),
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','archived')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE saas.memberships (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES saas.organizations(id),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 role_key text NOT NULL CHECK (role_key IN ('owner','admin','staff','trainer','member')),
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('invited','active','suspended','removed')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,user_id)
);
CREATE INDEX memberships_by_user ON saas.memberships(user_id,organization_id) WHERE status='active';
CREATE TABLE saas.legacy_tenant_links (
 organization_id uuid NOT NULL REFERENCES saas.organizations(id),
 crm_tenant_id uuid NOT NULL UNIQUE REFERENCES connect.tenants(id),
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(organization_id)
);
CREATE TABLE saas.workspace_links (
 workspace_id uuid PRIMARY KEY REFERENCES tasks.workspaces(id),
 organization_id uuid NOT NULL REFERENCES saas.organizations(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE saas.module_entitlements (
 organization_id uuid NOT NULL REFERENCES saas.organizations(id),
 module_key text NOT NULL CHECK (module_key ~ '^[a-z][a-z0-9_]{1,39}$'),
 enabled boolean NOT NULL DEFAULT false, PRIMARY KEY(organization_id,module_key)
);
CREATE TABLE saas.organization_settings (
 organization_id uuid NOT NULL REFERENCES saas.organizations(id),
 setting_key text NOT NULL CHECK (setting_key ~ '^[a-z][a-z0-9_]{1,63}$'),
 setting_value jsonb NOT NULL, PRIMARY KEY(organization_id,setting_key)
);
CREATE TABLE saas.platform_subscriptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES saas.organizations(id),
 plan_code text NOT NULL,
 status text NOT NULL CHECK(status IN ('trial','active','past_due','suspended','cancelled')),
 started_at timestamptz NOT NULL DEFAULT now(), ends_at timestamptz,
 provider_reference text UNIQUE, CHECK (ends_at IS NULL OR ends_at>started_at)
);
CREATE TABLE saas.audit_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid REFERENCES saas.organizations(id),
 actor_user_id uuid REFERENCES auth.users(id), event_type text NOT NULL,
 object_type text NOT NULL, object_id uuid, details jsonb NOT NULL DEFAULT '{}'::jsonb,
 happened_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_org_time ON saas.audit_events(organization_id,happened_at DESC);
CREATE TABLE saas.feature_flags (
 organization_id uuid NOT NULL REFERENCES saas.organizations(id),
 flag_key text NOT NULL, enabled boolean NOT NULL DEFAULT false,
 PRIMARY KEY(organization_id,flag_key)
);
-- New internal tables are service-managed, never client-writeable.
DO $rls$ DECLARE t record; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='saas' LOOP
  EXECUTE format('ALTER TABLE saas.%I ENABLE ROW LEVEL SECURITY',t.tablename);
  EXECUTE format('REVOKE ALL ON saas.%I FROM PUBLIC, anon, authenticated',t.tablename);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON saas.%I TO service_role',t.tablename);
 END LOOP;
END $rls$;
-- Narrow membership predicate: no client can alter memberships or claim another identity.
CREATE FUNCTION saas.is_active_member(p_organization_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog AS $fn$
 SELECT auth.uid() IS NOT NULL AND EXISTS (
  SELECT 1 FROM saas.memberships m JOIN saas.organizations o ON o.id=m.organization_id
  WHERE m.organization_id=p_organization_id AND m.user_id=auth.uid()
   AND m.status='active' AND o.status='active'
 );
$fn$;
REVOKE ALL ON FUNCTION saas.is_active_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION saas.is_active_member(uuid) TO authenticated, service_role;
-- Membership-scoped *read only* access for the new platform tables.
GRANT SELECT ON saas.organizations, saas.memberships, saas.module_entitlements, saas.feature_flags TO authenticated;
CREATE POLICY member_org_read ON saas.organizations FOR SELECT TO authenticated USING (saas.is_active_member(id));
CREATE POLICY member_membership_read ON saas.memberships FOR SELECT TO authenticated USING (saas.is_active_member(organization_id));
CREATE POLICY member_entitlement_read ON saas.module_entitlements FOR SELECT TO authenticated USING (saas.is_active_member(organization_id));
CREATE POLICY member_flags_read ON saas.feature_flags FOR SELECT TO authenticated USING (saas.is_active_member(organization_id));
-- Server-selected tenant must be independently validated against membership.
CREATE FUNCTION saas.require_organization(p_organization_id uuid)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $fn$
BEGIN
 IF p_organization_id IS NULL OR NOT saas.is_active_member(p_organization_id) THEN
  RAISE EXCEPTION 'Organization not accessible' USING ERRCODE='42501';
 END IF;
 RETURN p_organization_id;
END $fn$;
REVOKE ALL ON FUNCTION saas.require_organization(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION saas.require_organization(uuid) TO authenticated, service_role;
COMMIT;
