// Generate the ordered, reviewable Phase 3C SaaS security upgrade.
// No database connection; intended for an existing Phase 3A/B Education Suite.
import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const filenames=[
 "37_phase3c_last_active_owner_guard.sql",
 "38_phase3c_membership_management.sql",
 "40_phase3c_add_existing_member.sql",
 "41_phase3c_invitations.sql",
 "42_phase3c_invitation_revocation.sql",
 "43_phase3c_private_schema_list_rpcs.sql",
 "44_phase3c_public_function_hardening.sql"
];
const guard=`-- ROBOTRONIX PHASE 3C — ADDITIVE AUTHORIZATION AND MEMBERSHIP UPGRADE.
-- Existing Education Suite SaaS foundation required. NOT a fresh install.
-- NEVER run this on production without a separately approved change plan.
BEGIN;
DO $preflight$
BEGIN
 IF to_regclass('saas.organizations') IS NULL
 OR to_regclass('saas.memberships') IS NULL
 OR to_regclass('saas.audit_events') IS NULL
 OR to_regclass('public.students') IS NULL
 OR to_regprocedure('public.saas_authorized_organizations(uuid)') IS NULL THEN
  RAISE EXCEPTION 'Phase 3A/B Education Suite SaaS foundation required';
 END IF;
END $preflight$;
`;
const sections=filenames.map((filename,i)=>{
 const body=fs.readFileSync(path.join(root,"database/saas",filename),"utf8").trim();
 if(!body||/saas_qa_|dev_only\//.test(body))throw new Error("Invalid production upgrade source "+filename);
 return "-- STEP "+String(i+1).padStart(2,"0")+" — "+filename+"\n"+body+"\n";
});
const output=guard+"\n"+sections.join("\n")+"\nCOMMIT;\n";
const target=path.join(root,"database/generated/SAAS_PHASE3C_UPGRADE.sql");
fs.mkdirSync(path.dirname(target),{recursive:true});
fs.writeFileSync(target,output);
console.log("Generated "+target+" ("+filenames.length+" Phase 3C canonical steps); no database changed.");
