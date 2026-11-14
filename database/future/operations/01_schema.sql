-- FUTURE MODULE OPERATIONS — BASE CANONICAL DDL
-- FUTURE DESIGN ONLY. Never run in active Release 1 installer.
-- Dependencies documented in database/future/manifest.json.
CREATE SCHEMA IF NOT EXISTS operations;
REVOKE ALL ON SCHEMA operations FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA operations TO service_role;
CREATE TABLE operations.facilities (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid REFERENCES platform.organizations(id),
 legacy_center_id uuid UNIQUE REFERENCES public.delivery_centers(id), name text NOT NULL
);

CREATE TABLE operations.equipment (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), facility_id uuid NOT NULL REFERENCES operations.facilities(id),
 asset_tag text NOT NULL UNIQUE, equipment_type text NOT NULL
);

CREATE TABLE operations.stock_movements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), equipment_id uuid NOT NULL REFERENCES operations.equipment(id),
 quantity_delta integer NOT NULL CHECK(quantity_delta<>0),
 occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE operations.allocations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), equipment_id uuid NOT NULL REFERENCES operations.equipment(id),
 assigned_user_id uuid REFERENCES auth.users(id), allocated_at timestamptz NOT NULL DEFAULT now(),
 returned_at timestamptz
);

CREATE TABLE operations.maintenance_work_orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), equipment_id uuid NOT NULL REFERENCES operations.equipment(id),
 status text NOT NULL DEFAULT 'open', created_at timestamptz NOT NULL DEFAULT now()
);

-- DENY BY DEFAULT: no anon/authenticated table grants.
ALTER TABLE operations.facilities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE operations.facilities FROM PUBLIC, anon, authenticated;
ALTER TABLE operations.equipment ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE operations.equipment FROM PUBLIC, anon, authenticated;
ALTER TABLE operations.stock_movements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE operations.stock_movements FROM PUBLIC, anon, authenticated;
ALTER TABLE operations.allocations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE operations.allocations FROM PUBLIC, anon, authenticated;
ALTER TABLE operations.maintenance_work_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE operations.maintenance_work_orders FROM PUBLIC, anon, authenticated;
