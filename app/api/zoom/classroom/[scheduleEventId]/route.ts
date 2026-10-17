import {NextRequest,NextResponse} from "next/server";
import {requirePortalUser} from "@/lib/server/portal-api";
import {classAccessForProfile,classJoinWindow} from "@/lib/server/zoom-classroom";
export const dynamic="force-dynamic";

export async function GET(request:NextRequest,{params}:{params:Promise<{scheduleEventId:string}>}){
 const auth=await requirePortalUser(request,["admin","trainer","parent","student"]);if("error" in auth)return auth.error;
 try{
  const {scheduleEventId}=await params;
  const access=await classAccessForProfile(auth.admin,scheduleEventId,auth.profile);
  if(!access?.canJoin)return NextResponse.json({ok:false,error:"You do not have access to this classroom."},{status:403});
  const {data:meeting,error}=await auth.admin.from("zoom_meetings")
   .select("id,status,scheduled_start,duration_minutes,recording_enabled,recording_status,learner_recording_visible,last_error")
   .eq("schedule_event_id",scheduleEventId).eq("purpose","class").maybeSingle();
  if(error)throw new Error(error.message);
  const window=classJoinWindow(access.event,auth.profile.role);
  return NextResponse.json({ok:true,classroom:{
   available:Boolean(meeting&&!["cancelled","error"].includes(meeting.status)),
   canHost:access.canHost,canJoin:access.canJoin,withinJoinWindow:window.allowed,opensAt:window.opensAt,closesAt:window.closesAt,
   meeting:meeting?{id:meeting.id,status:meeting.status,recordingEnabled:meeting.recording_enabled,recordingStatus:meeting.recording_status,learnerRecordingVisible:meeting.learner_recording_visible,lastError:meeting.last_error}:null
  }},{headers:{"Cache-Control":"no-store"}});
 }catch(error){
  return NextResponse.json({ok:false,error:error instanceof Error?error.message:String(error)},{status:400});
 }
}
