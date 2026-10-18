import fs from "node:fs";

const required=[
 "database/04_upgrade/04_DEMO_EXPERIENCE_V1.sql",
 "app/api/admin/demos/route.ts",
 "app/api/demos/trainer/route.ts",
 "app/api/demo/[token]/route.ts",
 "app/api/demo/[token]/onboarding-prefill/route.ts",
 "app/admin/demos/page.tsx",
 "app/trainer/demos/page.tsx",
 "app/trainer/demo-room/[meetingId]/page.tsx",
 "app/demo/[token]/page.tsx",
 "components/demo/DemoHeroVisual.tsx"
];
for(const file of required)if(!fs.existsSync(file))throw new Error("Missing Demo Experience file: "+file);

const migration=fs.readFileSync("database/04_upgrade/04_DEMO_EXPERIENCE_V1.sql","utf8");
for(const marker of ["demo_leads","demo_sessions","demo_session_participants","demo_guest_requests","guest_token_hash","purpose in ('class','poc','general','demo')"])if(!migration.includes(marker))throw new Error("Demo migration missing: "+marker);

const trainerApi=fs.readFileSync("app/api/demos/trainer/route.ts","utf8");
if(/parent_whatsapp|parent_email/.test(trainerApi))throw new Error("Trainer Demo API must never select parent WhatsApp/email.");
for(const marker of ["child_name","grade","interest","experience_level"])if(!trainerApi.includes(marker))throw new Error("Trainer Demo API missing learner context: "+marker);

const guestApi=fs.readFileSync("app/api/demo/[token]/route.ts","utf8");
for(const marker of ["guest_token_hash","guest_token_expires_at","joinEnabled","summary_published_at"])if(!guestApi.includes(marker))throw new Error("Guest API missing security/state marker: "+marker);
if(/parent_whatsapp|parent_email/.test(guestApi))throw new Error("Public Demo API must never expose lead contact fields.");

const page=fs.readFileSync("app/demo/[token]/page.tsx","utf8");
for(const marker of ["Join Discovery Session","Google Calendar","Need another time?","Great first step","How did the demo feel?","ready to build something amazing?"])if(!page.includes(marker))throw new Error("Parent Demo Experience missing: "+marker);

const admin=fs.readFileSync("app/admin/demos/page.tsx","utf8");
for(const marker of ["Minimum details. Premium experience.","Add learner to group","The trainer will never receive WhatsApp or email details.","Mark resolved","Regenerate guest link","Reschedule","Converted","Lost"])if(!admin.includes(marker))throw new Error("Admin Demo Experience missing: "+marker);

const sdk=fs.readFileSync("app/api/zoom/sdk-session/route.ts","utf8");
for(const marker of ['meeting.purpose==="demo"','This demo is not assigned to you.','Demo guests should use their private invitation page.'])if(!sdk.includes(marker))throw new Error("Demo Zoom authorization missing: "+marker);

for(const marker of ["portal_notifications","demo_request","demo_feedback"])if(!guestApi.includes(marker))throw new Error("Demo live notification flow missing: "+marker);
const prefill=fs.readFileSync("app/api/demo/[token]/onboarding-prefill/route.ts","utf8");
for(const marker of ["parent_name","parent_whatsapp","child_name","Demo / Discovery Session"])if(!prefill.includes(marker))throw new Error("Demo onboarding prefill missing: "+marker);
const adminApi=fs.readFileSync("app/api/admin/demos/route.ts","utf8");
for(const marker of ['action==="reschedule"','action==="cancel_session"','action==="lead_status"'])if(!adminApi.includes(marker))throw new Error("Demo lifecycle action missing: "+marker);

const trainerLifecycle=fs.readFileSync("app/api/demos/trainer/route.ts","utf8");
for(const marker of ['session.status!=="scheduled"','attendance==="no_show"','every((x:any)=>x.attendance!=="scheduled")','update.summary_published_at=null']){
 if(!trainerLifecycle.includes(marker))throw new Error("Demo Trainer lifecycle safeguard missing: "+marker);
}
const adminLifecycle=fs.readFileSync("app/api/admin/demos/route.ts","utf8");
for(const marker of ["Only scheduled demos can be rescheduled.","Only scheduled demos can be cancelled.","Record attended demo outcome before marking a lead converted."]){
 if(!adminLifecycle.includes(marker))throw new Error("Demo Admin lifecycle safeguard missing: "+marker);
}
const noShowApi=fs.readFileSync("app/api/demo/[token]/route.ts","utf8");
const noShowPage=fs.readFileSync("app/demo/[token]/page.tsx","utf8");
if(!noShowApi.includes('participant.attendance==="no_show"?"no_show"')||!noShowPage.includes('data.state==="no_show"'))throw new Error("No-show family recovery experience is missing.");

console.log("Demo Experience V1 structure, privacy and live-experience checks: OK");
