import fs from "node:fs";
const required=[
 "lib/calendar.ts",
 "components/calendar/CalendarActions.tsx",
 "components/calendar/LearnerCalendar.tsx",
 "app/parent/calendar/page.tsx",
 "app/student/calendar/page.tsx",
 "app/api/calendar/subscription/route.ts",
 "app/api/calendar/trainer/[trainerId]/feed/route.ts",
 "database/01_install/01_CREATE_SCHEMA.sql"
];
for(const file of required)if(!fs.existsSync(file))throw new Error("Missing calendar file: "+file);
const actions=fs.readFileSync("components/calendar/CalendarActions.tsx","utf8");
for(const marker of ["Google Calendar","Apple / Outlook (.ics)"])if(!actions.includes(marker))throw new Error("Calendar action missing: "+marker);
const trainer=fs.readFileSync("app/trainer/schedule/page.tsx","utf8");
for(const marker of ["PRIVATE CALENDAR SUBSCRIPTION","Generate private link","Copy subscription link"])if(!trainer.includes(marker))throw new Error("Trainer calendar subscription missing: "+marker);
const schema=fs.readFileSync("database/01_install/01_CREATE_SCHEMA.sql","utf8");
if(!schema.includes("calendar_subscription_tokens"))throw new Error("Fresh schema missing calendar subscription tokens.");
const copyEditor=fs.readFileSync("components/PreferredAvailabilityEditor.tsx","utf8");
for(const marker of ['setCopyMode("replace")','Copy timings','Click Save availability to apply','overlapping slot','timingValidationMessages']){
 if(!copyEditor.includes(marker))throw new Error("Availability copy UI feedback/regression: missing "+marker);
}
const availabilityEditor=fs.readFileSync("components/TrainerAvailabilityEditor.tsx","utf8");
for(const marker of ["savedValue","Unsaved availability changes","setSavedValue(value)","preferredWindowsOverlap(w,other)","timeRangeError(w.start,w.end,w.endsNextDay,12*60)"]){
 if(!availabilityEditor.includes(marker))throw new Error("Trainer availability unsaved state missing: "+marker);
}
console.log("Calendar experience structure: OK");
