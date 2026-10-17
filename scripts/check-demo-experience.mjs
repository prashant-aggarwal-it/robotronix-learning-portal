import fs from "node:fs";

const required=[
 "database/04_upgrade/04_DEMO_EXPERIENCE_V1.sql",
 "app/api/admin/demos/route.ts",
 "app/api/demos/trainer/route.ts",
 "app/api/demo/[token]/route.ts",
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
for(const marker of ["Join Demo Session","Add to Google Calendar","Need another time?","Great first step","How did the demo feel?"])if(!page.includes(marker))throw new Error("Parent Demo Experience missing: "+marker);

const admin=fs.readFileSync("app/admin/demos/page.tsx","utf8");
for(const marker of ["Minimum details. Premium experience.","Add learner to group","The trainer will never receive WhatsApp or email details."])if(!admin.includes(marker))throw new Error("Admin Demo Experience missing: "+marker);

const sdk=fs.readFileSync("app/api/zoom/sdk-session/route.ts","utf8");
for(const marker of ['meeting.purpose==="demo"','This demo is not assigned to you.','Demo guests should use their private invitation page.'])if(!sdk.includes(marker))throw new Error("Demo Zoom authorization missing: "+marker);

console.log("Demo Experience V1 structure and privacy checks: OK");
