-- FUTURE MODULE ANALYTICS — BASE CANONICAL DDL
-- FUTURE DESIGN ONLY. Never run in active Release 1 installer.
-- Dependencies documented in database/future/manifest.json.
CREATE SCHEMA IF NOT EXISTS analytics;
REVOKE ALL ON SCHEMA analytics FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA analytics TO service_role;
CREATE TABLE analytics.metric_definitions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), metric_key text NOT NULL UNIQUE,
 description text NOT NULL, source_module text NOT NULL
);

CREATE TABLE analytics.metric_snapshots (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 metric_id uuid NOT NULL REFERENCES analytics.metric_definitions(id),
 organization_id uuid REFERENCES platform.organizations(id),
 bucket_start timestamptz NOT NULL, metric_value numeric NOT NULL,
 calculated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE analytics.refresh_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), started_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz, status text NOT NULL
);

-- DENY BY DEFAULT: no anon/authenticated table grants.
ALTER TABLE analytics.metric_definitions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE analytics.metric_definitions FROM PUBLIC, anon, authenticated;
ALTER TABLE analytics.metric_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE analytics.metric_snapshots FROM PUBLIC, anon, authenticated;
ALTER TABLE analytics.refresh_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE analytics.refresh_runs FROM PUBLIC, anon, authenticated;
