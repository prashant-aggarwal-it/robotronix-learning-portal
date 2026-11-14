-- Phase 3C: prevent an organization from losing its last active owner.
-- Additive guard on membership changes; no existing memberships are modified.
CREATE OR REPLACE FUNCTION saas.guard_last_active_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $fn$
DECLARE remaining integer;
BEGIN
 IF TG_OP = 'DELETE' OR (OLD.role_key = 'owner' AND OLD.status = 'active'
   AND (NEW.role_key <> 'owner' OR NEW.status <> 'active' OR NEW.organization_id <> OLD.organization_id)) THEN
  IF OLD.role_key = 'owner' AND OLD.status = 'active' THEN
   PERFORM 1 FROM saas.organizations WHERE id=OLD.organization_id FOR UPDATE;
   SELECT count(*) INTO remaining FROM saas.memberships
    WHERE organization_id=OLD.organization_id
      AND role_key='owner' AND status='active' AND id<>OLD.id;
   IF remaining=0 THEN
    RAISE EXCEPTION 'Cannot remove the last active organization owner'
      USING ERRCODE='42501';
   END IF;
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END
$fn$;
REVOKE ALL ON FUNCTION saas.guard_last_active_owner() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS memberships_last_owner_guard ON saas.memberships;
CREATE TRIGGER memberships_last_owner_guard
BEFORE UPDATE OR DELETE ON saas.memberships
FOR EACH ROW EXECUTE FUNCTION saas.guard_last_active_owner();
