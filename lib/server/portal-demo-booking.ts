import "server-only";
import crypto from "node:crypto";
import {createGeneralZoomMeeting} from "@/lib/server/zoom-classroom";
import {zonedLocalToUtc} from "@/lib/timezones";

export type DemoBookingInput={
 parentName:string;parentWhatsApp:string;parentEmail?:string;childName:string;grade:string;
 interest:string;experienceLevel?:"new"|"some"|"experienced";source?:string;focus?:string;
 trainerId:string;date:string;startTime:string;timezone:string;durationMinutes?:number;
 sessionType?:"one_to_one"|"group";
};
export type DemoBookingResult={sessionId:string;participantId:string;eventId:string;guestToken:string};

export function validateDemoBooking(input:DemoBookingInput){
 if(!input.parentName?.trim()||!input.parentWhatsApp?.trim()||!input.childName?.trim()||!input.grade?.trim()||!input.interest?.trim())
  throw new Error("Parent, WhatsApp, learner, grade and programme are required.");
 if(!/^[0-9a-f-]{36}$/i.test(input.trainerId)||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(input.date)||!/^[0-2][0-9]:[0-5][0-9]$/.test(input.startTime))
  throw new Error("Choose a valid trainer, date and start time.");
 if(!Number.isFinite(input.durationMinutes??45)||Number(input.durationMinutes??45)<30||Number(input.durationMinutes??45)>90)
  throw new Error("Demo duration must be between 30 and 90 minutes.");
 if(!["one_to_one","group",undefined].includes(input.sessionType))throw new Error("Invalid demo format.");
 const duration=input.durationMinutes??45;
 const [h,m]=input.startTime.split(":").map(Number),end=h*60+m+duration;
 if(end>=1440||h>23||end<=h*60+m)throw new Error("Demo must finish on the same day.");
 const endTime=String(Math.floor(end/60)).padStart(2,"0")+":"+String(end%60).padStart(2,"0");
 const startAt=zonedLocalToUtc(input.date,input.startTime,input.timezone||"Asia/Kolkata");
 if(Number.isNaN(startAt.getTime())||startAt.getTime()<=Date.now())throw new Error("Choose a future demo time.");
 return {duration,endTime,startAt};
}

export async function createPortalDemoBooking(db:any,actorId:string,input:DemoBookingInput):Promise<DemoBookingResult>{
 const {duration,endTime,startAt}=validateDemoBooking(input);
 const sessionType=input.sessionType==="group"?"group":"one_to_one";
 const focus=String(input.focus||input.interest).trim().slice(0,160);
 const title=(sessionType==="group"?"Group Demo · ":"Demo · ")+focus;
 const {data:eventId,error:reserveError}=await db.rpc("portal_demo_reserve_slot",{
  p_trainer_id:input.trainerId,p_title:title,p_date:input.date,p_start:input.startTime,
  p_end:endTime,p_timezone:input.timezone||"Asia/Kolkata",p_mode:sessionType==="group"?"small_group":"one_to_one"
 });
 if(reserveError)throw new Error(reserveError.code==="23P01"?"Trainer already has a session in this slot.":"Unable to reserve the selected trainer slot.");
 let leadId="",sessionId="",participantId="",meetingId="";
 try{
  const {data:lead,error:leadError}=await db.from("demo_leads").insert({
   parent_name:input.parentName.trim(),parent_whatsapp:input.parentWhatsApp.trim(),parent_email:input.parentEmail?.trim()||null,
   child_name:input.childName.trim(),grade:input.grade.trim(),interest:input.interest.trim(),
   experience_level:input.experienceLevel||"new",source:input.source||"manual",status:"demo_scheduled"
  }).select("id").single();
  if(leadError)throw new Error("Could not create demo learner.");leadId=lead.id;
  const {data:session,error:sessionError}=await db.from("demo_sessions").insert({
   schedule_event_id:eventId,trainer_id:input.trainerId,session_type:sessionType,focus,status:"scheduled",created_by:actorId
  }).select("id").single();
  if(sessionError)throw new Error("Could not create demo session.");sessionId=session.id;
  const guestToken=crypto.randomBytes(32).toString("base64url");
  const {data:participant,error:participantError}=await db.from("demo_session_participants").insert({
   demo_session_id:sessionId,lead_id:leadId,guest_token_hash:crypto.createHash("sha256").update(guestToken).digest("hex"),
   guest_token_expires_at:new Date(Date.now()+30*86400000).toISOString()
  }).select("id").single();
  if(participantError)throw new Error("Could not add demo learner.");participantId=participant.id;
  const meeting=await createGeneralZoomMeeting(db,{title:"Robotronix Demo · "+focus,startAt:startAt.toISOString(),durationMinutes:duration,recording:false,notes:"Discovery demo",createdBy:actorId});
  meetingId=meeting.id;
  const {error:zoomError}=await db.from("zoom_meetings").update({purpose:"demo",schedule_event_id:eventId,external_invite_enabled:true}).eq("id",meetingId);
  if(zoomError)throw new Error("Could not attach Zoom to demo.");
  const {error:linkError}=await db.from("demo_sessions").update({zoom_meeting_id:meetingId}).eq("id",sessionId);
  if(linkError)throw new Error("Could not attach meeting to demo.");
  await db.from("portal_notifications").insert({recipient_role:"trainer",trainer_id:input.trainerId,type:"demo_assigned",priority:"important",title:"New discovery session assigned",message:`${focus} · ${input.date} at ${input.startTime}`,href:"/trainer/demos"});
  return {sessionId,participantId,eventId,guestToken};
 }catch(error){
  if(meetingId){
   const {data:meeting}=await db.from("zoom_meetings").select("host_account_id,zoom_meeting_id").eq("id",meetingId).maybeSingle();
   if(meeting){try{const {zoomApi}=await import("@/lib/server/zoom");await zoomApi(meeting.host_account_id,"/meetings/"+encodeURIComponent(meeting.zoom_meeting_id),{method:"DELETE"})}catch{}}
   await db.from("zoom_meetings").delete().eq("id",meetingId);
  }
  if(participantId)await db.from("demo_session_participants").delete().eq("id",participantId);
  if(sessionId)await db.from("demo_sessions").delete().eq("id",sessionId);
  if(leadId)await db.from("demo_leads").delete().eq("id",leadId);
  await db.from("schedule_events").delete().eq("id",eventId);
  throw error;
 }
}
