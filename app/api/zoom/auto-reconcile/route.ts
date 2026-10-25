import {NextRequest,NextResponse} from "next/server";
import {syncZoomForScheduleEvent} from "@/lib/server/zoom-classroom";
import {zoomServiceClient} from "@/lib/server/zoom";
import {zonedLocalToUtc} from "@/lib/timezones";
export const dynamic="force-dynamic";

// Server-to-server retry: no browser credential, no new class records, max 3 Zoom API provisioning attempts.
export async function POST(request:NextRequest){
 const expected=process.env.INTERNAL_CRON_SECRET?.trim();
 const supplied=request.headers.get("x-robotronix-cron-secret")?.trim();
 if(!expected||supplied!==expected)return NextResponse.json({ok:false,error:"Unauthorized."},{status:401});
 try{
  const db=zoomServiceClient();
  const {data:hosts,error:hostError}=await db.from("zoom_host_accounts")
   .select("id").eq("status","connected").eq("enabled",true).limit(1);
  if(hostError)throw new Error(hostError.message);
  if(!hosts?.length)return NextResponse.json({ok:true,created:0,repaired:0,skipped:0,reason:"No connected host."});
  const {data:meetings,error:meetingsError}=await db.from("zoom_meetings")
   .select("schedule_event_id,join_url,status,last_error,updated_at")
   .eq("purpose","class").not("schedule_event_id","is",null);
  if(meetingsError)throw new Error(meetingsError.message);
  const [offlineEnrollments,offlineCohorts]=await Promise.all([
   db.from("enrollments").select("id").eq("delivery_channel","offline"),
   db.from("cohorts").select("id").eq("delivery_channel","offline")
  ]);
  if(offlineEnrollments.error||offlineCohorts.error)throw new Error(offlineEnrollments.error?.message||offlineCohorts.error?.message);
  const offlineEnrollmentIds=new Set((offlineEnrollments.data||[]).map(row=>row.id));
  const offlineCohortIds=new Set((offlineCohorts.data||[]).map(row=>row.id));
  const linked=new Map((meetings||[]).map(m=>[m.schedule_event_id,m]));
  const candidates:string[]=[];
  for(let page=0;page<15;page++){
   const {data:events,error}=await db.from("schedule_events")
    .select("id,date,start_time,timezone,enrollment_id,cohort_id")
    .eq("event_type","class").in("status",["scheduled","makeup"])
    .order("date",{ascending:true}).order("start_time",{ascending:true}).order("id",{ascending:true})
    .range(page*200,page*200+199);
   if(error)throw new Error(error.message);
   for(const event of events||[]){
    if((event.enrollment_id&&offlineEnrollmentIds.has(event.enrollment_id))||(event.cohort_id&&offlineCohortIds.has(event.cohort_id)))continue;
    const meeting=linked.get(event.id);
    if(meeting?.join_url&&/^https:\/\//i.test(meeting.join_url)&&!["cancelled","error"].includes(meeting.status))continue;
    // Back off on recently reported failures; avoid retry storms against Zoom.
    if(meeting?.last_error&&meeting.updated_at&&Date.now()-new Date(meeting.updated_at).getTime()<2*60*60_000)continue;
    try{
     if(zonedLocalToUtc(event.date,event.start_time,event.timezone||"Asia/Kolkata").getTime()>=Date.now()+15*60_000)candidates.push(event.id);
    }catch{}
   }
   if((events||[]).length<200)break;
  }
  // Rotate the starting point so repeated failure of an unlinked class cannot starve later classes.
  const offset=candidates.length?Math.floor(Date.now()/3600000)%candidates.length:0;
  const chosen=candidates.slice(offset).concat(candidates.slice(0,offset)).slice(0,3);
  let created=0,repaired=0,skipped=0;
  const failures:Array<{eventId:string;reason:string}>=[];
  for(const eventId of chosen){
   try{
    const result=await syncZoomForScheduleEvent(db,eventId);
    if(result.action==="created")created++;
    else if(result.action==="repaired")repaired++;
    else skipped++;
   }catch(e){
    const reason=e instanceof Error?e.message:String(e);
    failures.push({eventId,reason});
    console.error("Zoom automatic classroom provisioning failed",eventId,reason);
   }
  }
  return NextResponse.json({ok:true,created,repaired,skipped,failed:failures.length,processed:chosen.length,remainingCandidates:Math.max(0,candidates.length-chosen.length),failures},{headers:{"Cache-Control":"no-store"}});
 }catch(e){
  console.error("Zoom automatic reconciliation failed",e);
  return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e)},{status:500});
 }
}
