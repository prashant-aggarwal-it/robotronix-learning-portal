-- Synthetic two-tenant read-isolation test; all writes rolled back.
-- Requires one existing DEV auth.users row; no Auth data is changed.
BEGIN;
DO $guard$ BEGIN IF NOT EXISTS(SELECT 1 FROM auth.users) THEN RAISE EXCEPTION 'Missing DEV test Auth user'; END IF; END $guard$;
INSERT INTO saas.organizations(slug,display_name) VALUES
 ('saas-test-organization-a','Synthetic Academy A'),('saas-test-organization-b','Synthetic Academy B');
INSERT INTO saas.memberships(organization_id,user_id,role_key)
SELECT o.id,u.id,'admin' FROM saas.organizations o
CROSS JOIN (SELECT id FROM auth.users LIMIT 1) u
WHERE o.slug='saas-test-organization-a';
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM auth.users LIMIT 1),true);
SET LOCAL ROLE authenticated;
SELECT 1 / CASE WHEN
  (SELECT count(*) FROM saas.organizations WHERE slug='saas-test-organization-a')=1
  AND (SELECT count(*) FROM saas.organizations WHERE slug='saas-test-organization-b')=0
  AND (SELECT count(*) FROM saas.memberships)=1
  AND (SELECT saas.is_active_member(id) FROM saas.organizations WHERE slug='saas-test-organization-a')
THEN 1 ELSE 0 END AS scoped_member_read_pass;
-- A different JWT user, with no membership, must see no organizations.
SELECT set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
SELECT 1 / CASE WHEN (SELECT count(*) FROM saas.organizations)=0
  AND (SELECT count(*) FROM saas.memberships)=0 THEN 1 ELSE 0 END AS outsider_read_denied_pass;
ROLLBACK;
