import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const dir=path.join(root,"database/connect");
const source=path.join(dir,"saas");
const tests=path.join(dir,"tests");
const requiredTests=[
 "verify_foundation.sql",
 "verify_workspace_security_dev.sql",
 "verify_crm_phase2b_dev.sql",
 "verify_multichannel_dev.sql",
 "verify_phase3b_dev.sql",
 "verify_analytics_dev.sql",
 "verify_simple_mode_dev.sql"
];
for(const file of requiredTests){
 if(!fs.existsSync(path.join(tests,file)))throw new Error("Missing Connect SQL verification: "+file);
}
for(const file of fs.readdirSync(source)){
 if(/verify|test|qa_/i.test(file))throw new Error("Connect verification script mixed into migration source: "+file);
}
for(const file of fs.readdirSync(tests)){
 if(!requiredTests.includes(file))throw new Error("Unreviewed Connect SQL test file: "+file);
}
if(!fs.existsSync(path.join(dir,"README.md")))throw new Error("Connect database operating guide missing.");
console.log("Connect database layout OK: "+fs.readdirSync(source).length+" source files and "+requiredTests.length+" verification scripts.");
