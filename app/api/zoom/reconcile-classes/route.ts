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
  const {data:existing,error:meetingError}=await auth.admin.from("zoom_meetings")
   .select("schedule_event_id,join_url,status").eq("purpose","class").not("schedule_event_id","is",null);
  if(meetingError)throw new Error(meetingError.message);
  const linked=new Map((existing||[]).map(row=>[row.schedule_event_id,row]));
  // Scan in date order, across pages. The first 200 entries may already be provisioned.
  const batch:Array<{id:string;date:string;start_time:string;timezone:string|null}>=[];
  let scanned=0,eligibleCount=0,morePages=true;
  for(let page=0;morePages&&page<25;page++){
   let query=auth.admin.from("schedule_events")
    .select("id,date,start_time,timezone")
    .eq("event_type","class").in("status",["scheduled","tentative","makeup"])
    .order("date",{ascending:true}).order("start_time",{ascending:true}).order("id",{ascending:true})
    .range(page*200,page*200+199);
   if(enrollmentId)query=query.eq("enrollment_id",enrollmentId);
   const {data:events,error:eventError}=await query;
   if(eventError)throw new Error(eventError.message);
   const rows=events||[];
   scanned+=rows.length;
   for(const event of rows){
    const meeting=linked.get(event.id);
    if(meeting&&meeting.join_url&&/^https:\/\//i.test(meeting.join_url)&&!["cancelled","error"].includes(meeting.status))continue;
    try{
     if(zonedLocalToUtc(event.date,event.start_time,event.timezone||"Asia/Kolkata").getTime()<Date.now()-15*60_000)continue;
     eligibleCount++;
     if(batch.length<5)batch.push(event);
    }catch{}
   }
   morePages=rows.length===200;
  }
  // Remaining is a count of discovered candidates, not proof of Zoom success.
  let created=0,skipped=0,repaired=0;
  const failures:Array<{eventId:string;reason:string}>=[];
  // Sequential scheduling honours current host reservations. Database exclusion constraints
  // remain the final guard against competing provisioning requests.
  for(const event of batch){
   try{
    const result=await syncZoomForScheduleEvent(auth.admin,event.id,auth.actorId);
    if(result.action==="created")created++;
    else if(result.action==="repaired")repaired++;
    else skipped++;
   }catch(error){
    failures.push({eventId:event.id,reason:error instanceof Error?error.message:String(error)});
   }
  }
  return NextResponse.json({ok:true,created,skipped,failed:failures.length,failures,scanned,eligible:eligibleCount,processed:batch.length,repaired,remaining:Math.max(0,eligibleCount-batch.length)},{headers:{"Cache-Control":"no-store"}});
 }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:String(error)},{status:500});}
}
