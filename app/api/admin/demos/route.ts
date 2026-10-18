import crypto from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {requireAdmin} from "@/lib/server/admin-api";
import {createGeneralZoomMeeting} from "@/lib/server/zoom-classroom";
import {zonedLocalToUtc} from "@/lib/timezones";
export const dynamic="force-dynamic";

function token(){return crypto.randomBytes(32).toString("base64url")}
function hash(value:string){return crypto.createHash("sha256").update(value).digest("hex")}
function addMinutes(time:string,minutes:number){const[h,m]=time.split(":").map(Number);const total=h*60+m+minutes;return String(Math.floor(total/60)%24).padStart(2,"0")+":"+String(total%60).padStart(2,"0")}
function publicUrl(request:NextRequest,raw:string){return request.nextUrl.origin+"/demo/"+encodeURIComponent(raw)}

async function assertNoTrainerConflict(db:any,trainerId:string,date:string,startTime:string,endTime:string,timezone:string,excludeEventId?:string){
 const start=zonedLocalToUtc(date,startTime,timezone),end=zonedLocalToUtc(date,endTime,timezone);
 const from=new Date(start.getTime()-18*60*60_000).toISOString().slice(0,10);
 const to=new Date(end.getTime()+18*60*60_000).toISOString().slice(0,10);
 const {data,error}=await db.from("schedule_events").select("id,date,start_time,end_time,timezone,status,title")
  .eq("trainer_id",trainerId).gte("date",from).lte("date",to).not("status","in","(cancelled,rescheduled)");
 if(error)throw new Error(error.message);
 for(const e of data||[]){
  if(excludeEventId&&e.id===excludeEventId)continue;
  const a=zonedLocalToUtc(e.date,String(e.start_time).slice(0,5),e.timezone).getTime();
  const b=zonedLocalToUtc(e.date,String(e.end_time).slice(0,5),e.timezone).getTime();
  if(start.getTime()<b&&end.getTime()>a)throw new Error("Trainer already has another commitment during this time: "+e.title);
 }
}

export async function GET(request:NextRequest){
 const auth=await requireAdmin(request);if("error" in auth)return auth.error;
 const {data,error}=await auth.admin.from("demo_sessions")
  .select("id,session_type,focus,status,created_at,schedule_event:schedule_events(id,date,start_time,end_time,timezone,title,status),trainer:trainers(id,full_name),participants:demo_session_participants(id,attendance,summary_published_at,parent_rating,lead:demo_leads(id,parent_name,parent_whatsapp,parent_email,child_name,grade,interest,experience_level,source,status))")
  .order("created_at",{ascending:false}).limit(200);
 if(error)return NextResponse.json({ok:false,error:error.message},{status:500});
 const {data:requests,error:rErr}=await auth.admin.from("demo_guest_requests")
  .select("id,demo_session_participant_id,request_type,message,status,created_at,participant:demo_session_participants(id,lead:demo_leads(child_name,parent_name),demo_session:demo_sessions(id,focus,schedule_event:schedule_events(date,start_time,timezone)))")
  .eq("status","open").order("created_at",{ascending:false}).limit(100);
 if(rErr)return NextResponse.json({ok:false,error:rErr.message},{status:500});
 return NextResponse.json({ok:true,sessions:data||[],requests:requests||[]},{headers:{"Cache-Control":"no-store"}});
}

export async function POST(request:NextRequest){
 const auth=await requireAdmin(request);if("error" in auth)return auth.error;
 const body=await request.json().catch(()=>({})) as any;
 try{
  if(body.action==="reschedule"){
   const sessionId=String(body.sessionId||""),date=String(body.date||""),startTime=String(body.startTime||""),trainerId=String(body.trainerId||"");
   const duration=Math.max(30,Math.min(90,Number(body.durationMinutes||45))),timezone=String(body.timezone||"Asia/Kolkata");
   if(!sessionId||!trainerId||!date||!/^\d{2}:\d{2}$/.test(startTime))throw new Error("Demo, trainer, date and start time are required.");
   const {data:session,error:sErr}=await auth.admin.from("demo_sessions")
    .select("id,focus,status,schedule_event_id,zoom_meeting_id,trainer_id,schedule_event:schedule_events(id,date,start_time,end_time,timezone),participants:demo_session_participants(id,lead_id)")
    .eq("id",sessionId).maybeSingle();
   if(sErr)throw new Error(sErr.message);if(!session)throw new Error("Demo session not found.");if(session.status!=="scheduled")throw new Error("Only scheduled demos can be cancelled.");if(session.status!=="scheduled")throw new Error("Only scheduled demos can be rescheduled.");
   const endTime=addMinutes(startTime,duration);if(endTime<=startTime)throw new Error("Demo must finish on the same day.");
   await assertNoTrainerConflict(auth.admin,trainerId,date,startTime,endTime,timezone,session.schedule_event_id);
   const startAt=zonedLocalToUtc(date,startTime,timezone).toISOString();
   if(session.zoom_meeting_id){
    const {data:m,error:mErr}=await auth.admin.from("zoom_meetings").select("id,host_account_id,zoom_meeting_id").eq("id",session.zoom_meeting_id).maybeSingle();
    if(mErr)throw new Error(mErr.message);
    if(m){
     const {zoomApi}=await import("@/lib/server/zoom");
     await zoomApi(m.host_account_id,"/meetings/"+encodeURIComponent(m.zoom_meeting_id),{method:"PATCH",body:JSON.stringify({start_time:startAt,duration,timezone:"UTC"})});
     const {error:zErr}=await auth.admin.from("zoom_meetings").update({scheduled_start:startAt,duration_minutes:duration,status:"scheduled",actual_started_at:null,actual_ended_at:null,updated_at:new Date().toISOString()}).eq("id",m.id);
     if(zErr)throw new Error(zErr.message);
    }
   }
   const {error:eErr}=await auth.admin.from("schedule_events").update({trainer_id:trainerId,date,start_time:startTime,end_time:endTime,timezone,status:"scheduled",updated_at:new Date().toISOString()}).eq("id",session.schedule_event_id);
   if(eErr)throw new Error(eErr.message);
   const {error:dErr}=await auth.admin.from("demo_sessions").update({trainer_id:trainerId,status:"scheduled",completed_at:null,updated_at:new Date().toISOString()}).eq("id",sessionId);
   if(dErr)throw new Error(dErr.message);
   await auth.admin.from("demo_session_participants").update({attendance:"scheduled",summary_published_at:null,updated_at:new Date().toISOString()}).eq("demo_session_id",sessionId);
   const leadIds=(session.participants||[]).map((p:any)=>p.lead_id).filter(Boolean);
   if(leadIds.length)await auth.admin.from("demo_leads").update({status:"demo_scheduled",updated_at:new Date().toISOString()}).in("id",leadIds);
   await auth.admin.from("portal_notifications").insert({recipient_role:"trainer",trainer_id:trainerId,type:"demo_rescheduled",priority:"important",title:"Demo rescheduled",message:`${session.focus} is now scheduled for ${date} at ${startTime}.`,href:"/trainer/demos"});
   return NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
  }

  if(body.action==="cancel_session"){
   const sessionId=String(body.sessionId||"");if(!sessionId)throw new Error("Demo session is required.");
   const {data:session,error:sErr}=await auth.admin.from("demo_sessions")
    .select("id,focus,status,schedule_event_id,zoom_meeting_id,trainer_id,participants:demo_session_participants(id,lead_id)")
    .eq("id",sessionId).maybeSingle();
   if(sErr)throw new Error(sErr.message);if(!session)throw new Error("Demo session not found.");
   if(session.zoom_meeting_id){
    const {data:m}=await auth.admin.from("zoom_meetings").select("id,host_account_id,zoom_meeting_id,status").eq("id",session.zoom_meeting_id).maybeSingle();
    if(m&&!["cancelled","ended"].includes(m.status)){const {zoomApi}=await import("@/lib/server/zoom");try{await zoomApi(m.host_account_id,"/meetings/"+encodeURIComponent(m.zoom_meeting_id),{method:"DELETE"})}catch{}}
    if(m)await auth.admin.from("zoom_meetings").update({status:"cancelled",updated_at:new Date().toISOString()}).eq("id",m.id);
   }
   await auth.admin.from("schedule_events").update({status:"cancelled",updated_at:new Date().toISOString()}).eq("id",session.schedule_event_id);
   await auth.admin.from("demo_sessions").update({status:"cancelled",updated_at:new Date().toISOString()}).eq("id",sessionId);
   await auth.admin.from("demo_session_participants").update({attendance:"cancelled",summary_published_at:null,updated_at:new Date().toISOString()}).eq("demo_session_id",sessionId);
   const leadIds=(session.participants||[]).map((p:any)=>p.lead_id).filter(Boolean);
   if(leadIds.length)await auth.admin.from("demo_leads").update({status:"follow_up",updated_at:new Date().toISOString()}).in("id",leadIds);
   await auth.admin.from("portal_notifications").insert({recipient_role:"trainer",trainer_id:session.trainer_id,type:"demo_cancelled",priority:"important",title:"Demo cancelled",message:`${session.focus} has been cancelled by Robotronix Admin.`,href:"/trainer/demos"});
   return NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
  }

  if(body.action==="lead_status"){
   const participantId=String(body.participantId||""),status=String(body.status||"");
   if(!participantId||!["follow_up","converted","lost"].includes(status))throw new Error("Choose a valid demo learner and pipeline status.");
   const {data:p,error:pErr}=await auth.admin.from("demo_session_participants").select("id,lead_id").eq("id",participantId).maybeSingle();
   if(pErr)throw new Error(pErr.message);if(!p)throw new Error("Demo learner not found.");
   const {data:currentLead,error:leadReadError}=await auth.admin.from("demo_leads").select("status").eq("id",p.lead_id).maybeSingle();
   if(leadReadError)throw new Error(leadReadError.message);
   if(!currentLead)throw new Error("Demo lead not found.");
   if(currentLead.status==="converted"&&status!=="converted")throw new Error("Converted leads require an explicit Admin correction workflow.");
   if(status==="converted"){
    const {data:attendee,error:attendeeError}=await auth.admin.from("demo_session_participants").select("attendance").eq("id",participantId).single();
    if(attendeeError)throw new Error(attendeeError.message);
    if(attendee.attendance!=="attended")throw new Error("Record attended demo outcome before marking a lead converted.");
   }
   const {error}=await auth.admin.from("demo_leads").update({status,updated_at:new Date().toISOString()}).eq("id",p.lead_id);
   if(error)throw new Error(error.message);
   return NextResponse.json({ok:true,status},{headers:{"Cache-Control":"no-store"}});
  }

  if(body.action==="resolve_request"){
   const requestId=String(body.requestId||"");if(!requestId)throw new Error("Guest request is required.");
   const {error}=await auth.admin.from("demo_guest_requests").update({status:"resolved",resolved_at:new Date().toISOString()}).eq("id",requestId);
   if(error)throw new Error(error.message);
   return NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
  }

  if(body.action==="regenerate_link"){
   const participantId=String(body.participantId||"");if(!participantId)throw new Error("Demo participant is required.");
   const raw=token(),expires=new Date(Date.now()+30*24*60*60_000).toISOString();
   const {data,error}=await auth.admin.from("demo_session_participants").update({guest_token_hash:hash(raw),guest_token_expires_at:expires,updated_at:new Date().toISOString()}).eq("id",participantId).select("id").maybeSingle();
   if(error)throw new Error(error.message);if(!data)throw new Error("Demo participant not found.");
   return NextResponse.json({ok:true,guestUrl:publicUrl(request,raw)},{headers:{"Cache-Control":"no-store"}});
  }

  if(body.action==="add_participant"){
   const sessionId=String(body.sessionId||"");
   const {data:session,error:sErr}=await auth.admin.from("demo_sessions").select("id,session_type,status").eq("id",sessionId).maybeSingle();
   if(sErr)throw new Error(sErr.message);if(!session||session.session_type!=="group"||session.status!=="scheduled")throw new Error("Choose an upcoming group demo.");
   const parentName=String(body.parentName||"").trim(),whatsapp=String(body.parentWhatsApp||"").trim(),childName=String(body.childName||"").trim(),grade=String(body.grade||"").trim(),interest=String(body.interest||"").trim();
   if(!parentName||!whatsapp||!childName||!grade||!interest)throw new Error("Parent name, WhatsApp, child name, grade and interest are required.");
   const {data:lead,error:lErr}=await auth.admin.from("demo_leads").insert({parent_name:parentName,parent_whatsapp:whatsapp,parent_email:String(body.parentEmail||"").trim()||null,child_name:childName,grade,interest,experience_level:["new","some","experienced"].includes(body.experienceLevel)?body.experienceLevel:"new",source:String(body.source||"manual"),status:"demo_scheduled"}).select("id").single();
   if(lErr)throw new Error(lErr.message);
   const raw=token();const expires=new Date(Date.now()+30*24*60*60_000).toISOString();
   const {data:participant,error:pErr}=await auth.admin.from("demo_session_participants").insert({demo_session_id:sessionId,lead_id:lead.id,guest_token_hash:hash(raw),guest_token_expires_at:expires}).select("id").single();
   if(pErr){await auth.admin.from("demo_leads").delete().eq("id",lead.id);throw new Error(pErr.message)}
   return NextResponse.json({ok:true,participantId:participant.id,guestUrl:publicUrl(request,raw)},{headers:{"Cache-Control":"no-store"}});
  }

  const parentName=String(body.parentName||"").trim(),whatsapp=String(body.parentWhatsApp||"").trim(),childName=String(body.childName||"").trim(),grade=String(body.grade||"").trim(),interest=String(body.interest||"").trim();
  const trainerId=String(body.trainerId||""),date=String(body.date||""),startTime=String(body.startTime||""),timezone=String(body.timezone||"Asia/Kolkata");
  const duration=Math.max(30,Math.min(90,Number(body.durationMinutes||45))),sessionType=body.sessionType==="group"?"group":"one_to_one";
  if(!parentName||!whatsapp||!childName||!grade||!interest)throw new Error("Parent name, WhatsApp, child name, grade and interest are required.");
  if(!trainerId||!date||!/^\d{2}:\d{2}$/.test(startTime))throw new Error("Trainer, date and start time are required.");
  const endTime=addMinutes(startTime,duration);if(endTime<=startTime)throw new Error("Demo must finish on the same day.");
  await assertNoTrainerConflict(auth.admin,trainerId,date,startTime,endTime,timezone);

  let leadId="",eventId="",sessionId="",participantId="",meetingId="";
  try{
   const {data:lead,error:lErr}=await auth.admin.from("demo_leads").insert({parent_name:parentName,parent_whatsapp:whatsapp,parent_email:String(body.parentEmail||"").trim()||null,child_name:childName,grade,interest,experience_level:["new","some","experienced"].includes(body.experienceLevel)?body.experienceLevel:"new",source:String(body.source||"manual"),status:"demo_scheduled"}).select("id").single();
   if(lErr)throw new Error(lErr.message);leadId=lead.id;
   const title=(sessionType==="group"?"Group Demo":"Demo")+" · "+String(body.focus||interest||"Discovery");
   const {data:event,error:eErr}=await auth.admin.from("schedule_events").insert({trainer_id:trainerId,title,date,start_time:startTime,end_time:endTime,timezone,event_type:"demo",delivery_mode:sessionType==="group"?"small_group":"one_to_one",status:"scheduled",notes:"Demo Experience V1"}).select("id").single();
   if(eErr)throw new Error(eErr.message);eventId=event.id;
   const {data:session,error:sErr}=await auth.admin.from("demo_sessions").insert({schedule_event_id:eventId,trainer_id:trainerId,session_type:sessionType,focus:String(body.focus||interest||"Discovery Session").trim(),status:"scheduled",created_by:auth.actorId}).select("id").single();
   if(sErr)throw new Error(sErr.message);sessionId=session.id;
   const raw=token(),expires=new Date(Date.now()+30*24*60*60_000).toISOString();
   const {data:participant,error:pErr}=await auth.admin.from("demo_session_participants").insert({demo_session_id:sessionId,lead_id:leadId,guest_token_hash:hash(raw),guest_token_expires_at:expires}).select("id").single();
   if(pErr)throw new Error(pErr.message);participantId=participant.id;
   const startAt=zonedLocalToUtc(date,startTime,timezone).toISOString();
   const meeting=await createGeneralZoomMeeting(auth.admin,{title:"Robotronix Demo · "+String(body.focus||interest),startAt,durationMinutes:duration,recording:false,notes:"Demo Experience V1",createdBy:auth.actorId});
   meetingId=meeting.id;
   const {error:mErr}=await auth.admin.from("zoom_meetings").update({purpose:"demo",schedule_event_id:eventId,external_invite_enabled:true}).eq("id",meeting.id);
   if(mErr)throw new Error(mErr.message);
   const {error:linkErr}=await auth.admin.from("demo_sessions").update({zoom_meeting_id:meeting.id}).eq("id",sessionId);
   if(linkErr)throw new Error(linkErr.message);
   await auth.admin.from("portal_notifications").insert({recipient_role:"trainer",trainer_id:trainerId,type:"demo_assigned",priority:"important",title:"New discovery session assigned",message:`${String(body.focus||interest||"Discovery Session")} · ${date} at ${startTime}`,href:"/trainer/demos"});
   return NextResponse.json({ok:true,sessionId,participantId,guestUrl:publicUrl(request,raw)},{headers:{"Cache-Control":"no-store"}});
  }catch(error){
   if(meetingId){
    const {data:m}=await auth.admin.from("zoom_meetings").select("host_account_id,zoom_meeting_id").eq("id",meetingId).maybeSingle();
    if(m){try{const {zoomApi}=await import("@/lib/server/zoom");await zoomApi(m.host_account_id,"/meetings/"+encodeURIComponent(m.zoom_meeting_id),{method:"DELETE"})}catch{}}
    await auth.admin.from("zoom_meetings").delete().eq("id",meetingId);
   }
   if(participantId)await auth.admin.from("demo_session_participants").delete().eq("id",participantId);
   if(sessionId)await auth.admin.from("demo_sessions").delete().eq("id",sessionId);
   if(eventId)await auth.admin.from("schedule_events").delete().eq("id",eventId);
   if(leadId)await auth.admin.from("demo_leads").delete().eq("id",leadId);
   throw error;
  }
 }catch(error){
  return NextResponse.json({ok:false,error:error instanceof Error?error.message:String(error)},{status:400,headers:{"Cache-Control":"no-store"}});
 }
}
