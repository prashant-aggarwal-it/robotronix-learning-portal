import crypto from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {connectFailure,noStore,uuid} from "@/lib/server/connect-auth";
import {portalBridgeAccess} from "@/lib/server/connect-portal-access";
import {createPortalDemoBooking} from "@/lib/server/portal-demo-booking";

export const dynamic="force-dynamic";
type Context={params:Promise<{tenantId:string}>};

export async function GET(request:NextRequest,{params}:Context){
 const {tenantId}=await params,access=await portalBridgeAccess(request,tenantId);
 if("error" in access)return access.error;
 if(!access.installed)return NextResponse.json({ok:true,installed:false,trainers:[],demos:[]},{headers:noStore});
 if(access.role==="viewer")return NextResponse.json({ok:true,installed:true,trainers:[],demos:[]},{headers:noStore});
 const db=access.session.admin;
 const [{data:trainers,error:trainerError},{data:linkResult,error:linkError}]=await Promise.all([
  db.from("trainers").select("id,full_name,specialties").eq("record_status","active").order("full_name"),
  db.rpc("connect_portal_demo_bridge",{p_actor_id:access.session.actorId,p_tenant_id:tenantId,p_action:"list",p_data:{}})
 ]);
 if(trainerError||linkError)return connectFailure("Unable to load connected demos.",503);
 const links=(linkResult?.items||[]) as Array<{id:string;opportunity_id:string;person_id:string;portal_session_id:string|null;status:string;version:number;created_at:string}>;
 const sessionIds=(links||[]).map(l=>l.portal_session_id).filter((x):x is string=>Boolean(x));
 const {data:sessions}=sessionIds.length?await db.from("demo_sessions")
  .select("id,status,trainer_id,schedule_event:schedule_events(date,start_time,end_time,timezone,status)")
  .in("id",sessionIds):{data:[]};
 const byId=new Map((sessions||[]).map(s=>[s.id,s]));
 return NextResponse.json({ok:true,installed:true,trainers:trainers||[],demos:(links||[]).map(link=>({
  ...link,portalStatus:link.portal_session_id?byId.get(link.portal_session_id)?.status||null:null,
  trainerId:link.portal_session_id?byId.get(link.portal_session_id)?.trainer_id||null:null,
  schedule:link.portal_session_id?byId.get(link.portal_session_id)?.schedule_event||null:null
 }))},{headers:noStore});
}

export async function POST(request:NextRequest,{params}:Context){
 const {tenantId}=await params,access=await portalBridgeAccess(request,tenantId,true);
 if("error" in access)return access.error;
 if(!access.installed)return connectFailure("Connect the Learning Portal before booking demos.",409);
 if(Number(request.headers.get("content-length")||0)>8000)return connectFailure("Booking request is too large.",413);
 const data=await request.json().catch(()=>null) as Record<string,unknown>|null;
 if(!data||Array.isArray(data)||typeof data!=="object")return connectFailure("Invalid booking request.",400);
 const {requestId,opportunityId,learnerPersonId,trainerId}=data;
 if(!uuid(requestId)||!uuid(opportunityId)||!uuid(learnerPersonId)||!uuid(trainerId))return connectFailure("Select an admission, learner, trainer and booking ID.",400);
 if(typeof data.date!=="string"||typeof data.startTime!=="string"||typeof data.timezone!=="string"||typeof data.grade!=="string")
  return connectFailure("Date, time, timezone and learner grade are required.",400);
 const db=access.session.admin;
 const [{data:context,error:contextError},{data:trainer}]=await Promise.all([
  db.rpc("connect_portal_demo_bridge",{p_actor_id:access.session.actorId,p_tenant_id:tenantId,p_action:"booking_context",
   p_data:{opportunityId,learnerPersonId}}),
  db.from("trainers").select("id").eq("id",trainerId).eq("record_status","active").maybeSingle()
 ]);
 if(contextError||!context||!trainer)return connectFailure("Verify learner/admission, guardian phone and active trainer.",400);
 const guardianId=String(opportunityId); // Stable identity for the request fingerprint; guardian lookup is server-authoritative.
 const payload={opportunityId,learnerPersonId,guardianId,trainerId,date:data.date,startTime:data.startTime,timezone:data.timezone,grade:data.grade,
  interest:String(data.interest||context.opportunityTitle).slice(0,160),durationMinutes:Number(data.durationMinutes||45),sessionType:(data.sessionType==="group"?"group":"one_to_one") as "group"|"one_to_one"};
 const payloadHash=crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
 const {data:link,error:insertError}=await db.rpc("connect_portal_demo_bridge",{p_actor_id:access.session.actorId,
  p_tenant_id:tenantId,p_action:"begin",p_data:{requestId,payloadHash,opportunityId,learnerPersonId}});
 if(insertError)return connectFailure(insertError.code==="23505"?"Booking request already in progress.":"Unable to reserve CRM booking.",insertError.code==="23505"?409:503);
 if(link.existing)return link.payloadHash!==payloadHash?connectFailure("Booking key was already used for different details.",409):
  NextResponse.json({ok:true,status:link.status,linkId:link.id,sessionId:link.sessionId,guestUrl:null},{headers:noStore});
 try{
  const booking=await createPortalDemoBooking(db,access.portalActorId!,{
   parentName:context.guardianName,parentWhatsApp:context.guardianMobile,parentEmail:context.guardianEmail,
   childName:context.learnerName,grade:data.grade,interest:payload.interest,experienceLevel:"new",source:"connect_crm",
   focus:context.opportunityTitle,trainerId,date:data.date,startTime:data.startTime,timezone:data.timezone,
   durationMinutes:payload.durationMinutes,sessionType:payload.sessionType
  });
  const {error:linkError}=await db.rpc("connect_portal_demo_bridge",{p_actor_id:access.session.actorId,p_tenant_id:tenantId,
   p_action:"complete",p_data:{linkId:link.id,sessionId:booking.sessionId,scheduleEventId:booking.eventId,participantId:booking.participantId}});
  if(linkError)throw new Error("Booking was created, but CRM synchronization needs attention.");
  const guestUrl=request.nextUrl.origin+"/demo/"+encodeURIComponent(booking.guestToken);
  return NextResponse.json({ok:true,status:"scheduled",linkId:link.id,sessionId:booking.sessionId,guestUrl},{headers:noStore});
 }catch(error){
  // Portal booking may exist even if link synchronization failed; never auto-retry an ambiguous Zoom creation.
  await db.rpc("connect_portal_demo_bridge",{p_actor_id:access.session.actorId,p_tenant_id:tenantId,p_action:"fail",p_data:{linkId:link.id}});
  return connectFailure(error instanceof Error&&error.message.includes("slot")?"Trainer slot is unavailable.":"Demo booking could not be completed. Check the Portal before retrying.",409);
 }
}

export async function PATCH(request:NextRequest,{params}:Context){
 const {tenantId}=await params,access=await portalBridgeAccess(request,tenantId,true);
 if("error" in access)return access.error;
 if(!access.installed)return connectFailure("Learning Portal connection is disabled.",409);
 const data=await request.json().catch(()=>null) as Record<string,unknown>|null;
 if(!data||!uuid(data.linkId)||!["cancel","reschedule"].includes(String(data.action)))return connectFailure("Invalid demo change request.",400);
 const db=access.session.admin;
 const {data:link,error:detailError}=await db.rpc("connect_portal_demo_bridge",{
  p_actor_id:access.session.actorId,p_tenant_id:tenantId,p_action:"detail",p_data:{linkId:data.linkId}
 });
 if(detailError)return connectFailure("Not allowed to change this demo.",403);
 if(!link||!link.portal_session_id||link.status!=="scheduled")return connectFailure("This demo cannot be changed.",409);
 if(!Number.isInteger(data.version)||data.version!==link.version)return connectFailure("Demo changed; refresh and try again.",409);
 if(!["owner","admin","manager"].includes(access.role)&&link.created_by!==access.session.actorId)
  return connectFailure("Only the booking owner or manager can change this demo.",403);
 const {data:session}=await db.from("demo_sessions").select("id,focus,trainer_id,status,zoom_meeting_id,schedule_event_id")
  .eq("id",link.portal_session_id).maybeSingle();
 if(!session||session.status!=="scheduled")return connectFailure("The Portal demo has already moved to another state.",409);
 const {data:meeting}=session.zoom_meeting_id?await db.from("zoom_meetings").select("id,host_account_id,zoom_meeting_id,status").eq("id",session.zoom_meeting_id).maybeSingle():{data:null};
 const {zoomApi}=await import("@/lib/server/zoom");
 if(data.action==="cancel"){
  try{
   if(meeting&&!['cancelled','ended'].includes(meeting.status)){
    try{await zoomApi(meeting.host_account_id,"/meetings/"+encodeURIComponent(meeting.zoom_meeting_id),{method:"DELETE"});}
    catch(e){if(!/not exist|does not exist|3001/i.test(e instanceof Error?e.message:String(e)))throw e;}
   }
   const {error:sErr}=await db.from("demo_sessions").update({status:"cancelled",updated_at:new Date().toISOString()}).eq("id",session.id).eq("status","scheduled");
   if(sErr)throw sErr;
   await db.from("schedule_events").update({status:"cancelled",updated_at:new Date().toISOString()}).eq("id",session.schedule_event_id);
   await db.from("demo_session_participants").update({attendance:"cancelled",updated_at:new Date().toISOString()}).eq("demo_session_id",session.id);
   if(meeting)await db.from("zoom_meetings").update({status:"cancelled",updated_at:new Date().toISOString()}).eq("id",meeting.id);
   const {error:changeError}=await db.rpc("connect_portal_demo_bridge",{p_actor_id:access.session.actorId,
    p_tenant_id:tenantId,p_action:"change",p_data:{linkId:link.id,status:"cancelled",version:link.version}});
   if(changeError)throw changeError;
   await db.from("portal_notifications").insert({recipient_role:"trainer",trainer_id:session.trainer_id,type:"demo_cancelled",priority:"important",title:"Demo cancelled",message:`${session.focus} was cancelled.`,href:"/trainer/demos"});
   return NextResponse.json({ok:true,status:"cancelled"},{headers:noStore});
  }catch{return connectFailure("Cancellation requires reconciliation. Check the Portal before retrying.",503);}
 }
 if(!uuid(data.trainerId)||typeof data.date!=="string"||typeof data.startTime!=="string"||typeof data.timezone!=="string")return connectFailure("Choose a trainer and new time.",400);
 const duration=Number(data.durationMinutes||45);
 if(!Number.isInteger(duration)||duration<30||duration>90||!/^[0-2][0-9]:[0-5][0-9]$/.test(data.startTime))return connectFailure("Choose a valid 30–90 minute slot.",400);
 const [h,m]=data.startTime.split(":").map(Number),end=h*60+m+duration;
 if(h>23||end>=1440)return connectFailure("Demo must finish the same day.",400);
 const endTime=String(Math.floor(end/60)).padStart(2,"0")+":"+String(end%60).padStart(2,"0");
 const {data:oldEvent}=await db.from("schedule_events").select("trainer_id,date,start_time,end_time,timezone").eq("id",session.schedule_event_id).maybeSingle();
 if(!oldEvent)return connectFailure("Original demo schedule unavailable.",409);
 const {error:moveError}=await db.rpc("portal_demo_move_slot",{p_event_id:session.schedule_event_id,p_trainer_id:data.trainerId,
  p_date:data.date,p_start:data.startTime,p_end:endTime,p_timezone:data.timezone});
 if(moveError)return connectFailure("Trainer is unavailable in that slot.",409);
 try{
  const {zonedLocalToUtc}=await import("@/lib/timezones");
  if(meeting){await zoomApi(meeting.host_account_id,"/meetings/"+encodeURIComponent(meeting.zoom_meeting_id),{method:"PATCH",body:JSON.stringify({start_time:zonedLocalToUtc(data.date,data.startTime,data.timezone).toISOString(),duration,timezone:"UTC"})});}
  const {error:sErr}=await db.from("demo_sessions").update({trainer_id:data.trainerId,updated_at:new Date().toISOString()}).eq("id",session.id);
  if(sErr)throw sErr;
  if(meeting)await db.from("zoom_meetings").update({scheduled_start:zonedLocalToUtc(data.date,data.startTime,data.timezone).toISOString(),duration_minutes:duration,updated_at:new Date().toISOString()}).eq("id",meeting.id);
  await db.from("demo_session_participants").update({attendance:"scheduled",summary_published_at:null,updated_at:new Date().toISOString()}).eq("demo_session_id",session.id);
  const {error:changeError}=await db.rpc("connect_portal_demo_bridge",{p_actor_id:access.session.actorId,
   p_tenant_id:tenantId,p_action:"change",p_data:{linkId:link.id,status:"scheduled",version:link.version}});
  if(changeError)throw changeError;
  await db.from("portal_notifications").insert({recipient_role:"trainer",trainer_id:data.trainerId,type:"demo_rescheduled",priority:"important",title:"Demo rescheduled",message:`${session.focus} · ${data.date} at ${data.startTime}`,href:"/trainer/demos"});
  return NextResponse.json({ok:true,status:"scheduled"},{headers:noStore});
 }catch{
  // Best-effort local compensation; Zoom failure and DB failure must surface for operator reconciliation.
  await db.rpc("portal_demo_move_slot",{p_event_id:session.schedule_event_id,p_trainer_id:oldEvent.trainer_id,
   p_date:oldEvent.date,p_start:String(oldEvent.start_time).slice(0,5),p_end:String(oldEvent.end_time).slice(0,5),p_timezone:oldEvent.timezone});
  return connectFailure("Demo reschedule needs review in the Portal.",503);
 }
}
