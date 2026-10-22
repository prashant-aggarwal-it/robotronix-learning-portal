import fs from "node:fs";

const required=[
 "app/api/zoom/schedule/sync/route.ts",
 "app/api/zoom/classroom/[scheduleEventId]/route.ts",
 "app/api/zoom/webhook/route.ts",
 "app/api/zoom/overview/route.ts",
 "app/api/zoom/reconcile/route.ts",
 "app/api/zoom/retention/route.ts",
 "app/api/zoom/meetings/route.ts",
 "app/api/zoom/recordings/[recordingId]/route.ts",
 "app/api/zoom/recordings/[recordingId]/stream/route.ts",
 "app/admin/zoom/page.tsx",
 "app/admin/zoom/meeting/[meetingId]/page.tsx",
 "app/admin/zoom/recording/[recordingId]/page.tsx",
 "netlify/functions/zoom-retention.mts",
 "app/classroom/[scheduleEventId]/page.tsx",
 "components/ZoomClassActions.tsx",
 "lib/server/zoom-classroom.ts",
 "lib/server/zoom-recording.ts",
 "database/01_install/01_CREATE_SCHEMA.sql"
];
for(const file of required)if(!fs.existsSync(file))throw new Error("Missing Zoom Classroom V1 file: "+file);

const migration=fs.readFileSync("database/01_install/01_CREATE_SCHEMA.sql","utf8");
for(const token of ["'general'","zoom_participant_sessions","zoom_recordings","zoom_webhook_events","attempt_count","protected_from_deletion"]){
 if(!migration.includes(token))throw new Error("Zoom Classroom V1 migration is missing: "+token);
}
const sdk=fs.readFileSync("app/api/zoom/sdk-session/route.ts","utf8");
if(!sdk.includes("/users/me/zak"))throw new Error("Zoom host session must use the ZAK endpoint.");
const webhook=fs.readFileSync("app/api/zoom/webhook/route.ts","utf8");
for(const event of ["meeting.started","meeting.ended","meeting.participant_joined","meeting.participant_left","recording.completed","recording.deleted"]){
 if(!webhook.includes(event))throw new Error("Zoom webhook handling is missing: "+event);
}
const admin=fs.readFileSync("app/admin/zoom/page.tsx","utf8");
for(const marker of ["New Meeting","General meetings","Cloud recordings","Zoom accounts","Sync with Zoom","No live action"]){
 if(!admin.includes(marker))throw new Error("Zoom Admin UI is missing: "+marker);
}
const zoom=fs.readFileSync("lib/server/zoom.ts","utf8");
for(const marker of ['access_token','redirect:"follow"','target.protocol!=="https:"','hostname.endsWith(".zoom.us")'])if(!zoom.includes(marker))throw new Error("Zoom hardening missing: "+marker);
const recordingDetail=fs.readFileSync("app/api/zoom/recordings/[recordingId]/route.ts","utf8");
if(!recordingDetail.includes('recording.status!=="completed"'))throw new Error("Playback must reject inactive recordings.");
const retention=fs.readFileSync("app/api/zoom/retention/route.ts","utf8");
for(const marker of ["retain_until","protected_from_deletion","action=trash","INTERNAL_CRON_SECRET"])if(!retention.includes(marker))throw new Error("Zoom retention hardening missing: "+marker);

// Verify the selected 60-day default remains consistent from schema to reconciliation.
// These static checks do not attest to production DB values, Netlify schedule, or Zoom Trash expiry.
for(const table of ["zoom_host_accounts","zoom_meetings"]){
 const column=new RegExp("alter\\s+table\\s+public\\."+table+"\\s+add\\s+column\\s+if\\s+not\\s+exists\\s+recording_retention_days\\s+integer\\s+not\\s+null\\s+default\\s+60\\s*;","i");
 if(!column.test(migration))throw new Error("60-day recording retention default missing for "+table);
}
const retentionSchedule=fs.readFileSync("netlify.toml","utf8");
if(!/schedule\\s*=\\s*["']15 2 \\* \\* \\*["']/.test(retentionSchedule))throw new Error("Daily Zoom retention schedule declaration is missing.");

const recordingReconcile=fs.readFileSync("lib/server/zoom-recording-reconcile.ts","utf8");
for(const marker of ["ignoreDuplicates:true","recording_retention_days","retain_until","||60","days*86400000"]){
 if(!recordingReconcile.includes(marker))throw new Error("Recording lifecycle reconciliation safeguard missing: "+marker);
}
for(const file of ["app/api/zoom/reconcile/route.ts","app/api/zoom/webhook/route.ts"]){
 const content=fs.readFileSync(file,"utf8");
 if(!content.includes("reconcileZoomRecording("))throw new Error("Provider sync bypasses recording lifecycle safeguards: "+file);
}
if(!retention.includes('select("status,protected_from_deletion,retain_until")'))throw new Error("Retention job must recheck deletion eligibility immediately before cleanup.");
if(!retention.includes("failures.push("))throw new Error("Retention cleanup failure diagnostics are missing.");


const allocationSql=fs.readFileSync("database/01_install/01_CREATE_SCHEMA.sql","utf8");
for(const marker of ["btree_gist","zoom_host_active_meeting_no_overlap","exclude using gist","23P01"]){
 if(marker==="23P01")continue;
 if(!allocationSql.includes(marker))throw new Error("Zoom host overlap guard missing: "+marker);
}
const classroom=fs.readFileSync("lib/server/zoom-classroom.ts","utf8");
for(const marker of ['error.code==="23P01"','await deleteRemoteMeetingSafely(host.id,String(created.id))']){
 if(!classroom.includes(marker))throw new Error("Concurrent-host reservation recovery missing: "+marker);
}

console.log("Zoom Classroom V1 structure and production hardening: OK");
