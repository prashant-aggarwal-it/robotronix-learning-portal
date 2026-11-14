import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read=x=>fs.readFileSync(x,"utf8");
test("Organization invites use random one-time tokens and only store hashes",()=>{
 const route=read("app/api/platform/organizations/[organizationId]/invitations/route.ts");
 const sql=read("database/saas/41_phase3c_invitations.sql");
 assert.match(route,/crypto\.randomBytes\(32\)/);
 assert.match(route,/createHash\("sha256"\)/);
 assert.match(sql,/token_sha256 text NOT NULL UNIQUE/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.saas_create_invitation_v1/);
});
test("Invitation acceptance revalidates session and verified email",()=>{
 const route=read("app/api/platform/invitations/accept/route.ts");
 const sql=read("database/saas/41_phase3c_invitations.sql");
 assert.match(route,/auth\.getUser\(bearer\)/);
 assert.match(route,/user\.email_confirmed_at/);
 assert.match(sql,/email_confirmed_at IS NOT NULL/);
 assert.match(sql,/v_inv\.status<>'pending'/);
 assert.match(sql,/v_inv\.expires_at<=now\(\)/);
 assert.match(sql,/v_inv\.email<>v_email/);
});
test("Invite revocation is actor-scoped and audited",()=>{
 const route=read("app/api/platform/organizations/[organizationId]/invitations/[invitationId]/route.ts");
 const sql=read("database/saas/42_phase3c_invitation_revocation.sql");
 assert.match(route,/getAuthorizedOrganizations/);
 assert.match(route,/p_actor_id:userId/);
 assert.match(sql,/v_inv\.role_key IN \('owner','admin'\)/);
 assert.match(sql,/invitation\.revoked/);
});
