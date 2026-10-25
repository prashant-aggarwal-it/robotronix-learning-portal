import type {SupabaseClient} from "@supabase/supabase-js";
import {zonedLocalToUtc} from "@/lib/timezones";
import {zoomApi} from "@/lib/server/zoom";

type ScheduleRow={
 id:string;trainer_id:string;course_id:string|null;enrollment_id:string|null;cohort_id:string|null;student_id:string|null;
 title:string;date:string;start_time:string;end_time:string;timezone:string;event_type:string;status:string;
};

type HostRow={
 id:string;label:string;zoom_email:string;status:string;enabled:boolean;priority:number;recording_enabled:boolean;
 recording_retention_days:number;learner_recording_default:boolean;
};

function durationMinutes(event:ScheduleRow){
 const start=zonedLocalToUtc(event.date,event.start_time,event.timezone);
 const end=zonedLocalToUtc(event.date,event.end_time,event.timezone);
 return Math.max(1,Math.round((end.getTime()-start.getTime())/60000));
}

function classWindow(event:ScheduleRow){
 const start=zonedLocalToUtc(event.date,event.start_time,event.timezone);
 const duration=durationMinutes(event);
 return {start,end:new Date(start.getTime()+duration*60000),duration};
}

async function deliveryIsOnline(db:SupabaseClient,event:ScheduleRow){
 if(event.enrollment_id){
  const {data}=await db.from("enrollments").select("delivery_channel").eq("id",event.enrollment_id).maybeSingle();
  return data?.delivery_channel!=="offline";
 }
 if(event.cohort_id){
  const {data}=await db.from("cohorts").select("delivery_channel").eq("id",event.cohort_id).maybeSingle();
  return data?.delivery_channel!=="offline";
 }
 return true;
}

async function loadHosts(db:SupabaseClient){
 const {data,error}=await db.from("zoom_host_accounts")
  .select("id,label,zoom_email,status,enabled,priority,recording_enabled,recording_retention_days,learner_recording_default")
  .eq("status","connected").eq("enabled",true)
  .order("priority",{ascending:true}).order("connected_at",{ascending:true});
 if(error)throw new Error(error.message);
 return (data||[]) as HostRow[];
}

async function hostAvailable(db:SupabaseClient,hostId:string,start:Date,end:Date,excludeMeetingId?:string){
 const from=new Date(start.getTime()-12*60*60*1000).toISOString();
 const to=new Date(end.getTime()+12*60*60*1000).toISOString();
 let query=db.from("zoom_meetings").select("id,scheduled_start,duration_minutes,status")
  .eq("host_account_id",hostId).in("status",["scheduled","started"])
  .gte("scheduled_start",from).lte("scheduled_start",to);
 if(excludeMeetingId)query=query.neq("id",excludeMeetingId);
 const {data,error}=await query;
 if(error)throw new Error(error.message);
 return !(data||[]).some((row:any)=>{
  const otherStart=new Date(row.scheduled_start);
  const otherEnd=new Date(otherStart.getTime()+Number(row.duration_minutes||60)*60000);
  return start<otherEnd&&end>otherStart;
 });
}

async function chooseHost(db:SupabaseClient,start:Date,end:Date,preferredHostId?:string,excludeMeetingId?:string){
 const hosts=await loadHosts(db);
 if(!hosts.length)throw new Error("No enabled Zoom host account is connected. Connect or enable a Zoom account first.");
 if(preferredHostId){
  const preferred=hosts.find(h=>h.id===preferredHostId);
  if(preferred&&await hostAvailable(db,preferred.id,start,end,excludeMeetingId))return preferred;
 }
 for(const host of hosts){
  if(await hostAvailable(db,host.id,start,end,excludeMeetingId))return host;
 }
 throw new Error(`All ${hosts.length} connected Zoom host account${hosts.length===1?" is":"s are"} busy during this class. Move the class time or add another Zoom account.`);
}

function meetingSettings(host:HostRow){
 return {
  host_video:true,
  participant_video:true,
  join_before_host:false,
  waiting_room:false,
  mute_upon_entry:false,
  audio:"both",
  auto_recording:host.recording_enabled?"cloud":"none"
 };
}

async function deleteRemoteMeetingSafely(hostId:string,meetingNumber:string){
 try{await zoomApi(hostId,`/meetings/${encodeURIComponent(meetingNumber)}`,{method:"DELETE"});}
 catch(error){
  const message=error instanceof Error?error.message:String(error);
  if(!/not exist|does not exist|3001/i.test(message))throw error;
 }
}

export async function cancelZoomForScheduleEvent(db:SupabaseClient,scheduleEventId:string,{removeLocal=false}:{removeLocal?:boolean}={}){
 const {data:meeting,error}=await db.from("zoom_meetings").select("*").eq("schedule_event_id",scheduleEventId).eq("purpose","class").maybeSingle();
 if(error)throw new Error(error.message);
 if(!meeting)return {action:"none" as const};
 if(!["cancelled","ended"].includes(meeting.status)){
  await deleteRemoteMeetingSafely(meeting.host_account_id,meeting.zoom_meeting_id);
 }
 if(removeLocal){
  const {error:deleteError}=await db.from("zoom_meetings").delete().eq("id",meeting.id);
  if(deleteError)throw new Error(deleteError.message);
 }else{
  const {error:updateError}=await db.from("zoom_meetings").update({status:"cancelled",updated_at:new Date().toISOString()}).eq("id",meeting.id);
  if(updateError)throw new Error(updateError.message);
 }
 return {action:"cancelled" as const,meetingId:meeting.id};
}

export async function syncZoomForScheduleEvent(db:SupabaseClient,scheduleEventId:string,actorId?:string){
 const {data:event,error:eventError}=await db.from("schedule_events")
  .select("id,trainer_id,course_id,enrollment_id,cohort_id,student_id,title,date,start_time,end_time,timezone,event_type,status")
  .eq("id",scheduleEventId).maybeSingle();
 if(eventError)throw new Error(eventError.message);
 if(!event)throw new Error("Scheduled class was not found.");

 const eligible=event.event_type==="class"&&!["cancelled","rescheduled","conducted","blocked"].includes(event.status)&&await deliveryIsOnline(db,event as ScheduleRow);
 if(!eligible)return cancelZoomForScheduleEvent(db,scheduleEventId);

 const typed=event as ScheduleRow;
 const {start,end,duration}=classWindow(typed);
 const {data:existing,error:meetingError}=await db.from("zoom_meetings").select("*").eq("schedule_event_id",scheduleEventId).eq("purpose","class").maybeSingle();
 if(meetingError)throw new Error(meetingError.message);

 // Reuse an existing meeting before allocating another host or creating a duplicate.
 // Zoom PATCH responses do not contain join_url, so retrieve it from Zoom if the stored link is missing.
 if(existing&&["scheduled","started"].includes(existing.status)&&(!existing.join_url||!/^https:\/\//i.test(existing.join_url))){
  try{
   const remote=await zoomApi(existing.host_account_id,`/meetings/${encodeURIComponent(existing.zoom_meeting_id)}`);
   const joinUrl=typeof remote?.join_url==="string"&&/^https:\/\//i.test(remote.join_url)?remote.join_url:null;
   if(joinUrl){
    const {error:repairError}=await db.from("zoom_meetings").update({join_url:joinUrl,last_error:null,updated_at:new Date().toISOString()}).eq("id",existing.id);
    if(repairError)throw new Error(repairError.message);
    return {action:"repaired" as const,meetingId:existing.id,hostId:existing.host_account_id};
   }
   throw new Error("Zoom returned no valid joining URL for the existing meeting.");
  }catch(repairError){
   const reason=repairError instanceof Error?repairError.message:String(repairError);
   await db.from("zoom_meetings").update({last_error:"Zoom joining link unavailable: "+reason,updated_at:new Date().toISOString()}).eq("id",existing.id);
   throw new Error("Existing Zoom meeting needs attention: "+reason);
  }
 }
 const host=await chooseHost(db,start,end,existing?.host_account_id,existing?.id);
 const body={
  topic:`Robotronix Classroom · ${typed.title}`,
  type:2,
  start_time:start.toISOString(),
  duration,
  timezone:"UTC",
  agenda:"Robotronix online learning session",
  settings:meetingSettings(host)
 };

 if(existing&&existing.host_account_id===host.id&&!["cancelled","ended"].includes(existing.status)){
  await zoomApi(host.id,`/meetings/${encodeURIComponent(existing.zoom_meeting_id)}`,{method:"PATCH",body:JSON.stringify(body)});
  const {error}=await db.from("zoom_meetings").update({
   topic:body.topic,scheduled_start:start.toISOString(),duration_minutes:duration,status:"scheduled",
   recording_enabled:host.recording_enabled,recording_status:host.recording_enabled?"pending":"not_expected",
   recording_retention_days:host.recording_retention_days,
   learner_recording_visible:host.learner_recording_default,last_error:null,updated_at:new Date().toISOString()
  }).eq("id",existing.id);
  if(error)throw new Error(error.message);
  return {action:"updated" as const,meetingId:existing.id,hostId:host.id};
 }

 const created=await zoomApi(host.id,"/users/me/meetings",{method:"POST",body:JSON.stringify(body)});
 if(!created?.id||typeof created.join_url!=="string"||!/^https:\/\//i.test(created.join_url)){
  if(created?.id)await deleteRemoteMeetingSafely(host.id,String(created.id)).catch(()=>{});
  throw new Error("Zoom did not return a valid meeting ID and join URL. Classroom provisioning was not completed.");
}
 if(existing){
  // Reserve the new host in the database before removing the original Zoom room.
  // The GiST exclusion constraint rejects overlapping concurrent reservations.
  const {error}=await db.from("zoom_meetings").update({
   host_account_id:host.id,zoom_meeting_id:String(created.id),zoom_meeting_uuid:created.uuid?String(created.uuid):null,
   topic:String(created.topic||body.topic),passcode:String(created.password||created.encrypted_password||""),
   join_url:created.join_url?String(created.join_url):null,status:"scheduled",scheduled_start:start.toISOString(),duration_minutes:duration,
   recording_enabled:host.recording_enabled,recording_status:host.recording_enabled?"pending":"not_expected",
   recording_retention_days:host.recording_retention_days,learner_recording_visible:host.learner_recording_default,
   last_error:null,updated_at:new Date().toISOString()
  }).eq("id",existing.id);
  if(error){
   await deleteRemoteMeetingSafely(host.id,String(created.id));
   throw new Error(error.code==="23P01"?"The Zoom host became busy while scheduling. Please retry.":error.message);
  }
  try{await deleteRemoteMeetingSafely(existing.host_account_id,existing.zoom_meeting_id)}
  catch(cleanupError){console.error("Old Zoom meeting needs reconciliation after successful host reallocation",existing.id,cleanupError)}
  return {action:"reallocated" as const,meetingId:existing.id,hostId:host.id};
 }

 const {data:inserted,error:insertError}=await db.from("zoom_meetings").insert({
  host_account_id:host.id,schedule_event_id:scheduleEventId,purpose:"class",zoom_meeting_id:String(created.id),
  zoom_meeting_uuid:created.uuid?String(created.uuid):null,topic:String(created.topic||body.topic),
  passcode:String(created.password||created.encrypted_password||""),join_url:created.join_url?String(created.join_url):null,
  status:"scheduled",scheduled_start:start.toISOString(),duration_minutes:duration,created_by:actorId||null,
  recording_enabled:host.recording_enabled,recording_status:host.recording_enabled?"pending":"not_expected",
  recording_retention_days:host.recording_retention_days,learner_recording_visible:host.learner_recording_default
 }).select("id").single();
 if(insertError){
  await deleteRemoteMeetingSafely(host.id,String(created.id));
  throw new Error(insertError.code==="23P01"?"The Zoom host became busy while scheduling. Please retry.":insertError.message);
 }
 return {action:"created" as const,meetingId:inserted.id,hostId:host.id};
}

export async function classAccessForProfile(db:SupabaseClient,scheduleEventId:string,profile:{id:string;role:string}){
 const {data:event,error}=await db.from("schedule_events").select("id,trainer_id,student_id,cohort_id,enrollment_id,event_type,status,date,start_time,end_time,timezone,title").eq("id",scheduleEventId).maybeSingle();
 if(error)throw new Error(error.message);if(!event||event.event_type!=="class")return null;
 if(profile.role==="admin")return {event,canHost:true,canJoin:true};
 if(profile.role==="trainer"){
  const {data:trainer}=await db.from("trainers").select("id").eq("profile_id",profile.id).maybeSingle();
  const allowed=Boolean(trainer?.id&&trainer.id===event.trainer_id);
  return {event,canHost:allowed,canJoin:allowed};
 }
 let studentIds:string[]=[];
 if(event.student_id)studentIds=[event.student_id];
 else if(event.enrollment_id){
  const {data:enrollment}=await db.from("enrollments").select("student_id").eq("id",event.enrollment_id).maybeSingle();
  if(enrollment?.student_id)studentIds=[enrollment.student_id];
 }else if(event.cohort_id){
  const {data:enrollments}=await db.from("enrollments").select("student_id").eq("cohort_id",event.cohort_id).eq("status","active");
  studentIds=(enrollments||[]).map((x:any)=>x.student_id);
 }
 if(profile.role==="student"){
  const {data:student}=await db.from("students").select("id").eq("profile_id",profile.id).maybeSingle();
  return {event,canHost:false,canJoin:Boolean(student?.id&&studentIds.includes(student.id))};
 }
 if(profile.role==="parent"){
  const {data:parent}=await db.from("parents").select("id").eq("profile_id",profile.id).maybeSingle();
  if(!parent?.id)return {event,canHost:false,canJoin:false};
  const {data:links}=await db.from("parent_students").select("student_id").eq("parent_id",parent.id);
  return {event,canHost:false,canJoin:(links||[]).some((x:any)=>studentIds.includes(x.student_id))};
 }
 return {event,canHost:false,canJoin:false};
}

export function classJoinWindow(event:any,role:string){
 const start=zonedLocalToUtc(event.date,event.start_time,event.timezone);
 const end=zonedLocalToUtc(event.date,event.end_time,event.timezone);
 const now=Date.now();
 const opens=start.getTime()-(role==="trainer"||role==="admin"?30:10)*60_000;
 const closes=end.getTime()+60*60_000;
 return {allowed:now>=opens&&now<=closes,opensAt:new Date(opens).toISOString(),closesAt:new Date(closes).toISOString()};
}


export async function createGeneralZoomMeeting(db:SupabaseClient,input:{
 title:string;startAt?:string;durationMinutes?:number;hostId?:string;recording?:boolean;notes?:string;createdBy:string;
}){
 const start=input.startAt?new Date(input.startAt):new Date(Date.now()+60_000);
 if(Number.isNaN(start.getTime()))throw new Error("Meeting start time is invalid.");
 const duration=Math.max(15,Math.min(720,Number(input.durationMinutes||60)));
 const end=new Date(start.getTime()+duration*60_000);
 const host=await chooseHost(db,start,end,input.hostId);
 const recording=input.recording??host.recording_enabled;
 const body={
  topic:String(input.title||"Robotronix Meeting").trim().slice(0,160)||"Robotronix Meeting",
  type:2,
  start_time:start.toISOString(),
  duration,
  timezone:"UTC",
  agenda:String(input.notes||"Robotronix meeting").slice(0,2000),
  settings:{
   host_video:true,participant_video:true,join_before_host:false,waiting_room:true,
   mute_upon_entry:false,audio:"both",auto_recording:recording?"cloud":"none"
  }
 };
 const created=await zoomApi(host.id,"/users/me/meetings",{method:"POST",body:JSON.stringify(body)});
 const {data,error}=await db.from("zoom_meetings").insert({
  host_account_id:host.id,schedule_event_id:null,purpose:"general",
  zoom_meeting_id:String(created.id),zoom_meeting_uuid:created.uuid?String(created.uuid):null,
  topic:String(created.topic||body.topic),passcode:String(created.password||created.encrypted_password||""),
  join_url:created.join_url?String(created.join_url):null,status:"scheduled",
  scheduled_start:start.toISOString(),duration_minutes:duration,created_by:input.createdBy,
  recording_enabled:recording,recording_status:recording?"pending":"not_expected",
  recording_retention_days:host.recording_retention_days,learner_recording_visible:false,
  meeting_notes:String(input.notes||"").slice(0,2000)||null,external_invite_enabled:true
 }).select("id,host_account_id,zoom_meeting_id,topic,join_url,passcode,status,scheduled_start,duration_minutes,recording_enabled").single();
 if(error){
  await deleteRemoteMeetingSafely(host.id,String(created.id));
  throw new Error(error.message);
 }
 return {...data,hostLabel:host.label,hostEmail:host.zoom_email||""};
}

export async function cancelGeneralZoomMeeting(db:SupabaseClient,meetingId:string){
 const {data:meeting,error}=await db.from("zoom_meetings").select("*").eq("id",meetingId).eq("purpose","general").maybeSingle();
 if(error)throw new Error(error.message);
 if(!meeting)throw new Error("Meeting not found.");
 if(!["cancelled","ended"].includes(meeting.status))await deleteRemoteMeetingSafely(meeting.host_account_id,meeting.zoom_meeting_id);
 const {error:updateError}=await db.from("zoom_meetings").update({status:"cancelled",updated_at:new Date().toISOString()}).eq("id",meeting.id);
 if(updateError)throw new Error(updateError.message);
 return {id:meeting.id,status:"cancelled" as const};
}
