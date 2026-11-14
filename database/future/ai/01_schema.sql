-- FUTURE MODULE AI — BASE CANONICAL DDL
-- FUTURE DESIGN ONLY. Never run in active Release 1 installer.
-- Dependencies documented in database/future/manifest.json.
CREATE SCHEMA IF NOT EXISTS ai;
REVOKE ALL ON SCHEMA ai FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA ai TO service_role;
CREATE TABLE ai.agents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid REFERENCES saas.organizations(id),
 name text NOT NULL, enabled boolean NOT NULL DEFAULT false
);

CREATE TABLE ai.prompt_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), agent_id uuid NOT NULL REFERENCES ai.agents(id),
 version_no integer NOT NULL, prompt_template text NOT NULL, UNIQUE(agent_id,version_no)
);

CREATE TABLE ai.conversations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), agent_id uuid NOT NULL REFERENCES ai.agents(id),
 initiated_by uuid NOT NULL REFERENCES auth.users(id), started_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ai.tool_grants (
 agent_id uuid NOT NULL REFERENCES ai.agents(id), tool_key text NOT NULL,
 requires_approval boolean NOT NULL DEFAULT true, PRIMARY KEY(agent_id,tool_key)
);

CREATE TABLE ai.executions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id uuid NOT NULL REFERENCES ai.conversations(id),
 tool_key text, approved_by uuid REFERENCES auth.users(id),
 status text NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ai.usage_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), execution_id uuid NOT NULL REFERENCES ai.executions(id),
 tokens_in integer NOT NULL DEFAULT 0, tokens_out integer NOT NULL DEFAULT 0,
 estimated_cost numeric NOT NULL DEFAULT 0
);

-- DENY BY DEFAULT: no anon/authenticated table grants.
ALTER TABLE ai.agents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE ai.agents FROM PUBLIC, anon, authenticated;
ALTER TABLE ai.prompt_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE ai.prompt_versions FROM PUBLIC, anon, authenticated;
ALTER TABLE ai.conversations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE ai.conversations FROM PUBLIC, anon, authenticated;
ALTER TABLE ai.tool_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE ai.tool_grants FROM PUBLIC, anon, authenticated;
ALTER TABLE ai.executions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE ai.executions FROM PUBLIC, anon, authenticated;
ALTER TABLE ai.usage_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE ai.usage_events FROM PUBLIC, anon, authenticated;
