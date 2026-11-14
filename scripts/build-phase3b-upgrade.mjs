// Build an ordered, reviewable Phase 3B Academy SaaS upgrade from canonical SQL.
// This script never connects to Supabase or modifies a database.
import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const files=[
 "14_academy_resource_ownership_guard.sql",
 "15_shared_course_reference_catalog.sql",
 "16_adopt_shared_course_template.sql",
 "17_legacy_academy_rls_boundaries.sql",
 "18_dependent_academy_rls_boundaries.sql",
 "19_privileged_academy_read_policy_hardening.sql",
 "20_tenant_aware_legacy_core_writes.sql",
 "21_legacy_academy_auxiliary_rls.sql",
 "22_core_org_preinsert_ownership.sql",
 "23_inline_core_owner_returning_rls.sql",
 "24_shared_course_template_read_api.sql",
 "25_fk_scoped_legacy_academy_crud.sql",
 "26_restrict_legacy_global_admin_overrides.sql",
 "27_privileged_finance_scope.sql",
 "28_role_aware_academy_core_reads.sql",
 "31_membership_revocation_legacy_fallback_guard.sql",
 "32_revoked_user_rls_marker.sql",
 "29_zoom_recording_stream_tenant_guard.sql",
 "30_session_records_role_scoped_rls.sql",
 "33_complete_legacy_data_access_boundaries.sql"
];
const guard=`-- PHASE 3B: ADDITIVE ACADEMY + SAAS UPGRADE (not a fresh installer)
-- Requires Academy and the Phase 3A SaaS foundation already installed.
-- Never apply to CRM-only or Tasks-only installations.
-- IMPORTANT: no production execution without an explicit separately approved change window.
DO $preflight$
BEGIN
 IF to_regclass('saas.organizations') IS NULL
 OR to_regclass('saas.academy_students') IS NULL
 OR to_regclass('saas.academy_courses') IS NULL
 OR to_regclass('saas.academy_trainers') IS NULL
 OR to_regclass('saas.academy_enrollments') IS NULL
 OR to_regclass('public.students') IS NULL THEN
  RAISE EXCEPTION 'Academy + Phase 3A foundation required';
 END IF;
END $preflight$;
`;
const contents=files.map((filename,i)=>{
 const file=path.join(root,"database/saas",filename);
 const body=fs.readFileSync(file,"utf8").trim();
 if(!/^--/.test(body)||!body.includes("BEGIN;")||!body.includes("COMMIT;"))
  throw new Error("Unexpected migration structure: "+filename);
 if(body.includes("saas_qa_")||body.includes("dev_only/"))
  throw new Error("DEV-only QA object in installer: "+filename);
 return "-- STEP "+String(i+1).padStart(2,"0")+" — "+filename+"\n"+body+"\n";
});
const generated=path.join(root,"database/generated/SAAS_PHASE3B_UPGRADE.sql");
fs.mkdirSync(path.dirname(generated),{recursive:true});
fs.writeFileSync(generated,guard+"\n"+contents.join("\n")+"\n");
console.log("Generated "+generated+" ("+files.length+" canonical SQL steps). No database changed.");
