-- Phase 3B: permanent-per-user membership marker prevents revoked SaaS users
-- from falling back to legacy global Admin authorization. Removed with Auth user.
BEGIN;
CREATE TABLE IF NOT EXISTS saas.user_membership_history (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 first_joined_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE saas.user_membership_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON saas.user_membership_history FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON saas.user_membership_history TO service_role;
INSERT INTO saas.user_membership_history(user_id)
 SELECT DISTINCT user_id FROM saas.memberships ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION saas.track_membership_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
BEGIN
 INSERT INTO saas.user_membership_history(user_id) VALUES(NEW.user_id) ON CONFLICT DO NOTHING;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION saas.track_membership_history() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS saas_membership_history_insert ON saas.memberships;
CREATE TRIGGER saas_membership_history_insert AFTER INSERT ON saas.memberships
FOR EACH ROW EXECUTE FUNCTION saas.track_membership_history();
CREATE OR REPLACE FUNCTION public.saas_actor_ever_member(p_actor_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $fn$
 SELECT EXISTS(SELECT 1 FROM saas.user_membership_history WHERE user_id=p_actor_id);
$fn$;
REVOKE ALL ON FUNCTION public.saas_actor_ever_member(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.saas_actor_ever_member(uuid) TO service_role;
COMMIT;
