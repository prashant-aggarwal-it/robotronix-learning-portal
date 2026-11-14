import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
for(const file of ["process-reminders.mjs","zoom-auto-reconcile.mts","zoom-retention.mts"]){
 test(file+" requires explicit single Netlify scheduler ownership before processing",()=>{
  const s=fs.readFileSync("netlify/functions/"+file,"utf8");
  const a=s.indexOf('schedulerCapabilityEnabled("portal")');
  const b=s.indexOf('netlifyJobOwned("PORTAL_SCHEDULER_ENABLED")');
  assert.ok(a>=0&&b>a,file+": missing ownership gate");
  assert.match(s,/portal-scheduler-not-owned/);
 });
}
