import {NextRequest,NextResponse} from "next/server";
import {requireAdmin} from "@/lib/server/admin-api";
import {syncZoomForScheduleEvent} from "@/lib/server/zoom-classroom";
import {zonedLocalToUtc} from "@/lib/timezones";
export const dynamic="force-dynamic";

// An explicit admin repair action. Never regenerate class occurrences or touch learning records.
export async function POST(request:NextRequest){
 const auth=await requireAdmin(request);if("error" in auth)return auth.error;
 try{
  const {data:hosts,error:hostError}=await auth.admin.from("zoom_host_accounts").select("id").eq("status","connected").eq("enabled",true).limit(1);
  if(hostError)throw new Error(hostError.message);
  if(!hosts?.length)return NextResponse.json({ok:false,error:"Connect and enable a Zoom host before reconciling classes."},{status:409});
  const input=await request.json().catch(()=>({}));
  const enrollmentId=typeof input?.enrollmentId==="string"&&/^[a-f0-9-]{36}$/i.test(input.enrollmentId)?input.enrollmentId:null;
  const baseQuery=auth.admin.from("schedule_events")
   .select("id,date,start_time,timezone,event_type,status")
   .eq("event_type","class").in("status",["scheduled","tentative","makeup"])
   .order("date",{ascending:true}).limit(200);
  const {data:events,error:eventError}=await (enrollmentId?baseQuery.eq("enrollment_id",enrollmentId):baseQuery);
  if(eventError)throw new Error(eventError.message);
  const {data:existing,error:meetingError}=await auth.admin.from("zoom_meetings")
   .select("schedule_event_id").eq("purpose","class").not("schedule_event_id","is",null);
  if(meetingError)throw new Error(meetingError.message);
  const linked=new Set((existing||[]).map(row=>row.schedule_event_id));
  const eligible=(events||[]).filter(event=>{
   if(linked.has(event.id))return false;
   try{return zonedLocalToUtc(event.date,event.start_time,event.timezone||"Asia/Kolkata").getTime()>=Date.now()-15*60_000}catch{return false}
  });
  // Bound each repair request to avoid platform timeouts when a full course is scheduled.
  const batch=eligible.slice(0,5);
  let created=0,skipped=0;
  const failures:Array<{eventId:string;reason:string}>=[];
  // Sequential scheduling honours current host reservations. Database exclusion constraints
  // remain the final guard against competing provisioning requests.
  for(const event of batch){
   try{
    const result=await syncZoomForScheduleEvent(auth.admin,event.id,auth.actorId);
    if(result.action==="created")created++;
    else skipped++;
   }catch(error){
    failures.push({eventId:event.id,reason:error instanceof Error?error.message:String(error)});
   }
  }
  return NextResponse.json({ok:true,created,skipped,failed:failures.length,failures,scanned:(events||[]).length,eligible:eligible.length,processed:batch.length,remaining:Math.max(0,eligible.length-batch.length)},{headers:{"Cache-Control":"no-store"}});
 }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:String(error)},{status:500});}
}
