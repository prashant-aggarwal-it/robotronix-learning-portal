import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const builder=fs.readFileSync("scripts/build-phase3c-upgrade.mjs","utf8");
test("Phase 3C canonical upgrade includes every security and invitation migration in order",()=>{
 for(const name of [
  "37_phase3c_last_active_owner_guard.sql",
  "38_phase3c_membership_management.sql",
  "40_phase3c_add_existing_member.sql",
  "41_phase3c_invitations.sql",
  "42_phase3c_invitation_revocation.sql",
  "43_phase3c_private_schema_list_rpcs.sql",
  "44_phase3c_public_function_hardening.sql"
 ])assert.ok(builder.includes(name),"missing "+name);
 assert.ok(builder.indexOf("37_phase3c")<builder.indexOf("43_phase3c"));
 assert.match(builder,/BEGIN;/);
 assert.match(builder,/COMMIT;/);
 assert.match(builder,/saas_qa_/);
});
