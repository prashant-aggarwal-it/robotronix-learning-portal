import {NextRequest,NextResponse} from "next/server";
import {requirePortalUser} from "@/lib/server/portal-api";
import {classAccessForProfile,classJoinWindow,syncZoomForScheduleEvent} from "@/lib/server/zoom-classroom";
import {logSystemEvent} from "@/lib/server/system-log";
export const dynamic="force-dynamic";

export async function GET(request:NextRequest,{params}:{params:Promise<{scheduleEventId:string}>}){
 const auth=await requirePortalUser(request,["admin","trainer","parent","student"]);if("error" in auth)return auth.error;
 try{
  const {scheduleEventId}=await params;
  const access=await classAccessForProfile(auth.admin,scheduleEventId,auth.profile);
  if(!access?.canJoin)return NextResponse.json({ok:false,error:"You do not have access to this classroom."},{status:403});
  const window=classJoinWindow(access.event,auth.profile.role);
  // When the trainer opens the classroom near start, recover an unprovisioned room.
  // This does not grant a learner host access or create far-future meetings.
  const {data:readyCheck}=await auth.admin.from("zoom_meetings").select("id,join_url,status").eq("schedule_event_id",scheduleEventId).eq("purpose","class").maybeSingle();
  if(window.allowed&&access.canHost&&["scheduled","makeup"].includes(access.event.status)&&(!readyCheck||!readyCheck.join_url||readyCheck.status==="error")){
   try{await syncZoomForScheduleEvent(auth.admin,scheduleEventId);}catch{
    await logSystemEvent({source:"zoom-classroom",action:"readiness",level:"warning",code:"JIT_CLASSROOM_RETRY_FAILED",message:"Classroom meeting was unavailable during a trainer readiness check."});
   }
  }
  const {data:meeting,error}=await auth.admin.from("zoom_meetings")
   .select("id,status,scheduled_start,duration_minutes,recording_enabled,recording_status,learner_recording_visible,last_error,join_url")
   .eq("schedule_event_id",scheduleEventId).eq("purpose","class").maybeSingle();
  if(error)throw new Error(error.message);
  let recordingId:string|null=null;
  if(meeting?.id&&meeting.recording_status==="ready"){
   const {data:recording}=await auth.admin.from("zoom_recordings").select("id,learner_visible,status")
    .eq("zoom_meeting_id",meeting.id).eq("status","completed").order("created_at",{ascending:false}).limit(1).maybeSingle();
   const privileged=auth.profile.role==="admin"||Boolean(access.canHost);
   if(recording&&(privileged||(meeting.learner_recording_visible&&recording.learner_visible)))recordingId=recording.id;
  }
  return NextResponse.json({ok:true,classroom:{
   available:Boolean(meeting&&typeof meeting.join_url==="string"&&/^https:\/\//i.test(meeting.join_url)&&!["cancelled","error"].includes(meeting.status)),
   canHost:access.canHost,canJoin:access.canJoin,withinJoinWindow:window.allowed,opensAt:window.opensAt,closesAt:window.closesAt,
   meeting:meeting?{id:meeting.id,status:meeting.status,recordingEnabled:meeting.recording_enabled,recordingStatus:meeting.recording_status,learnerRecordingVisible:meeting.learner_recording_visible,recordingId,lastError:meeting.last_error||(!meeting.join_url?"Zoom joining link is missing; ask an administrator to reconcile this class.":null)}:null
  }},{headers:{"Cache-Control":"no-store"}});
 }catch(error){
  return NextResponse.json({ok:false,error:error instanceof Error?error.message:String(error)},{status:400});
 }
}
