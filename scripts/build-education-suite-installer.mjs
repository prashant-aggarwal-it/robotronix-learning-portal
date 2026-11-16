// Generate a reviewable Education Suite installer from canonical, ordered SQL.
// Does NOT connect to Supabase. This bundle must pass isolated DEV certification before use.
import fs from "node:fs";
import path from "node:path";
import {execFileSync} from "node:child_process";
const root=process.cwd();
const db=path.join(root,"database");
execFileSync(process.execPath,[path.join(root,"scripts/build-db-installers.mjs")],{cwd:root,stdio:"inherit"});
const original=fs.readFileSync(path.join(db,"generated/ROBOTRONIX_FULL_SUITE_FRESH_INSTALL.sql"),"utf8");
const allSaas=fs.readdirSync(path.join(db,"saas")).filter(f=>/^\d{2}_[\w-]+\.sql$/.test(f)).sort((a,b)=>Number(a.slice(0,2))-Number(b.slice(0,2)));
const saas=allSaas.filter(f=>!/(?:verify|readiness|preflight|rollback|test|audit)/i.test(f));
if(allSaas.length!==64||allSaas[0].slice(0,2)!=="01"||allSaas.at(-1).slice(0,2)!=="64")throw Error("SaaS source inventory changed: expected 01..64; review before building");
if(saas.length<40)throw Error("Unexpected number of installable SaaS files");
const migrations=fs.readdirSync(path.join(root,"supabase/migrations")).filter(f=>/^20261115_milestone_[ab]_.*\.sql$/.test(f)).sort();
const ordered=[
 "20261115_milestone_a_phase3_organization_signup.sql",
 "20261115_milestone_a_phase3_organization_lookup.sql",
 "20261115_milestone_a_phase4_module_provisioning.sql",
 "20261115_milestone_a_phase5_academy_brand.sql",
 "20261115_milestone_a_phase6_workspaces.sql",
 "20261115_milestone_b_phase8_family_access.sql",
 "20261115_milestone_b_phase8_student_picker.sql",
 "20261115_milestone_b_phase8_family_progress.sql",
 "20261115_milestone_b_academy_scoped_admin_overview.sql",
 "20261115_milestone_b_scoped_trainer_access.sql",
 "20261115_milestone_b_members_directory_rpc.sql",
 "20261115_milestone_b_admin_list_entitlements.sql",
 "20261115_milestone_b_membership_module_sync.sql"
];
if(JSON.stringify([...migrations].sort())!==JSON.stringify([...ordered].sort()))throw Error("Milestone migration list changed; review ordering and update builder before generating");
const preflight = `DO $suite_guard$ BEGIN IF to_regclass('public.profiles') IS NOT NULL OR to_regnamespace('saas') IS NOT NULL OR to_regnamespace('tasks') IS NOT NULL OR to_regnamespace('connect') IS NOT NULL THEN RAISE EXCEPTION 'Fresh-install requires empty app schemas'; END IF; END $suite_guard$;`;
const parts=[["Fresh install guard",preflight],["Existing canonical Academy / CRM / Tasks fresh install",original]];
for(const name of saas)parts.push(["SaaS "+name,fs.readFileSync(path.join(db,"saas",name),"utf8")]);
for(const name of ordered)parts.push(["Milestone "+name,fs.readFileSync(path.join(root,"supabase/migrations",name),"utf8")]);
const output=parts.map(([label,sql],i)=>"\n-- ==================== STAGE "+(i+1)+": "+label+" ====================\n"+sql.trim()+"\n").join("\n");
const target=path.join(db,"generated/ROBOTRONIX_EDUCATION_SUITE_FRESH_INSTALL_UNCERTIFIED.sql");
fs.mkdirSync(path.dirname(target),{recursive:true});
fs.writeFileSync(target,"-- DEV ONLY / UNCERTIFIED. Review and test in empty isolated Supabase before use.\n-- Never run in populated DEV or PROD.\n"+output);
console.log("Generated "+target+" ("+parts.length+" ordered sections). UNTESTED against a fresh Supabase database.");
