// Zoom Classroom V2 offline release contracts. Not a substitute for live Zoom or Supabase DEV QA.
import fs from "node:fs";
import {readCanonicalSql} from "./read-canonical-sql.mjs";
const read=p=>fs.readFileSync(p,"utf8");
const schema=readCanonicalSql();
const classroom=read("lib/server/zoom-classroom.ts");
const scheduler=read("app/api/zoom/auto-reconcile/route.ts");
const sdk=read("app/api/zoom/sdk-session/route.ts");
const overview=read("app/api/zoom/overview/route.ts");
const admin=read("app/admin/zoom/page.tsx");
const netlify=read("netlify.toml");
const claim=(yes,description)=>{if(!yes)throw new Error("Zoom JIT contract missing: "+description);};
for(const name of ["zoom_class_provisioning_leases","claim_zoom_class_provisioning",
 "release_zoom_class_provisioning","zoom_class_host_reservations",
 "zoom_class_host_reservation_no_overlap","reserve_zoom_host_for_class","zoom_class_reservation_sync_trg"]){
 claim(schema.includes(name),"schema "+name);
}
claim(schema.includes("pg_advisory_xact_lock"),"atomic host capacity allocation");
claim(schema.includes("grant execute on function public.claim_zoom_class_provisioning(uuid,uuid) to service_role"),"service-role provisioning claim");
claim(schema.includes("revoke all on public.zoom_class_host_reservations from anon,authenticated"),"reservation privacy");
claim(classroom.includes('action:"deferred" as const')&&classroom.includes("untilStart>35*60_000"),"deferred meeting creation");
claim(classroom.includes('db.rpc("claim_zoom_class_provisioning"')&&classroom.includes('db.rpc("release_zoom_class_provisioning"'),"DB lease around Zoom API calls");
claim(classroom.includes('db.rpc("reserve_zoom_host_for_class"')&&classroom.includes("reservation.host_account_id"),"provisioning must use reserved host");
claim(classroom.includes('"zoom_class_host_reservations"'),"general meetings respect class reservations");
claim(netlify.includes('[functions."zoom-auto-reconcile"]')&&netlify.includes('schedule = "*/5 * * * *"'),"five-minute JIT cadence");
claim(scheduler.includes("35*60_000")&&scheduler.includes("matchesTime"),"35-minute window and rescheduling repair");
claim(scheduler.includes("cancelZoomForScheduleEvent")&&scheduler.includes("reservationsRecovered"),"background cancellation and capacity recovery");
claim(sdk.includes("syncZoomForScheduleEvent")&&sdk.includes("!access?.canJoin"),"authorized direct-launch fallback");
claim(overview.includes("readinessSummary")&&overview.includes("readinessIssues"),"upcoming exceptions API");
claim(admin.includes("Retry capacity")&&admin.includes("Host capacity exceptions"),"Admin host-capacity repair interface");
console.log("Zoom Classroom V2 JIT and capacity static release contracts passed.");
