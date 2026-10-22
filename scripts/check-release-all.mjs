// Run all release checks even if one fails. Print one actionable failure summary.
// This is a static/local gate, not a substitute for authenticated DEV/Production QA.
import {spawnSync} from "node:child_process";
const checks=[
 "typecheck","check:structure","check:communication","check:finance",
 "check:migration","check:fresh-db","check:docs","check:zoom-poc","check:zoom-classroom",
 "check:razorpay-ops","check:exports","check:customer-delight",
 "check:calendar","check:demo-experience","check:live-data",
 "check:p2p3-live","check:stabilization","check:trainer-courses-ui"
];
const failed=[];
for(const check of checks){
 console.log("\n"+ "=".repeat(18)+" "+check+" "+"=".repeat(18));
 const result=spawnSync(process.platform==="win32"?"npm.cmd":"npm",["run",check],{
  stdio:"inherit",shell:process.platform==="win32",env:process.env
 });
 if(result.error||result.status!==0){
  failed.push({check,reason:result.error?.message||"exit code "+String(result.status)});
  console.error("FAILED:",check);
 }
}
if(failed.length){
 console.error("\nRELEASE CHECK FAILED: "+failed.length+" of "+checks.length+" checks. Fix all listed checks and rerun:");
 for(const f of failed)console.error(" - npm run "+f.check+" ("+f.reason+")");
 process.exitCode=1;
}else{
 console.log("\nALL "+checks.length+" RELEASE CHECKS PASSED.");
}
