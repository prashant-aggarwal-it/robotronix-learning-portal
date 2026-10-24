import {NextRequest,NextResponse} from "next/server";
import {requirePortalUser} from "@/lib/server/portal-api";
import {classAccessForProfile} from "@/lib/server/zoom-classroom";
import {createRecordingStreamToken} from "@/lib/server/zoom-recording";
import {zoomApi} from "@/lib/server/zoom";
export const dynamic="force-dynamic";

async function load(auth:any,recordingId:string){
 const {data,error}=await auth.admin.from("zoom_recordings")
  .select("id,zoom_meeting_id,zoom_recording_file_id,recording_type,file_type,file_extension,file_size_bytes,recording_start,recording_end,status,learner_visible,retain_until,protected_from_deletion,download_url")
  .eq("id",recordingId).maybeSingle();
 if(error)throw new Error(error.message);if(!data)throw new Error("Recording not found.");
 const {data:meeting,error:meetingError}=await auth.admin.from("zoom_meetings")
  .select("id,host_account_id,zoom_meeting_id,schedule_event_id,purpose,topic,learner_recording_visible,status")
  .eq("id",data.zoom_meeting_id).maybeSingle();
 if(meetingError)throw new Error(meetingError.message);if(!meeting)throw new Error("Recording meeting not found.");
 return {recording:data,meeting};
}
async function allowed(auth:any,meeting:any,recording:any){
 if(auth.profile.role==="admin")return true;
 if(meeting.purpose!=="class"||!meeting.schedule_event_id)return false;
 const access=await classAccessForProfile(auth.admin,meeting.schedule_event_id,auth.profile);
 if(auth.profile.role==="trainer")return Boolean(access?.canHost);
 if(!recording.learner_visible||!meeting.learner_recording_visible)return false;
 return Boolean(access?.canJoin);
}

export async function GET(request:NextRequest,{params}:{params:Promise<{recordingId:string}>}){
 const auth=await requirePortalUser(request,["admin","trainer","parent","student"]);if("error" in auth)return auth.error;
 try{
  const {recordingId}=await params;const {recording,meeting}=await load(auth,recordingId);
  if(!await allowed(auth,meeting,recording))return NextResponse.json({ok:false,error:"You do not have access to this recording."},{status:403});
  if(recording.status!=="completed")return NextResponse.json({ok:false,error:"This recording is not available for playback."},{status:404});
  const token=createRecordingStreamToken(recording.id,auth.profile.id);
  return NextResponse.json({ok:true,recording:{id:recording.id,topic:meeting.topic,fileType:recording.file_type,recordingType:recording.recording_type,
   sizeBytes:recording.file_size_bytes,status:recording.status,retainUntil:recording.retain_until,protected:recording.protected_from_deletion,
   learnerVisible:recording.learner_visible,streamUrl:`/api/zoom/recordings/${recording.id}/stream?token=${encodeURIComponent(token)}`}},
   {headers:{"Cache-Control":"no-store"}});
 }catch(error){console.error("Zoom recording API failed",error instanceof Error?error.name:"UnknownError");return NextResponse.json({ok:false,error:"Unable to process recording request."},{status:400,headers:{"Cache-Control":"no-store"}});}
}

export async function PATCH(request:NextRequest,{params}:{params:Promise<{recordingId:string}>}){
 const auth=await requirePortalUser(request,["admin"]);if("error" in auth)return auth.error;
 try{
  const {recordingId}=await params;const body=await request.json().catch(()=>({})) as {action?:string;days?:number};
  const {recording,meeting}=await load(auth,recordingId);
  if(body.action==="toggle-learner"){
   const visible=!recording.learner_visible;
   const {error}=await auth.admin.from("zoom_recordings").update({learner_visible:visible,updated_at:new Date().toISOString()}).eq("id",recording.id);
   if(error)throw new Error(error.message);return NextResponse.json({ok:true,learnerVisible:visible});
  }
  if(body.action==="toggle-protect"){
   const value=!recording.protected_from_deletion;
   const {error}=await auth.admin.from("zoom_recordings").update({protected_from_deletion:value,updated_at:new Date().toISOString()}).eq("id",recording.id);
   if(error)throw new Error(error.message);return NextResponse.json({ok:true,protected:value});
  }
  if(body.action==="extend"){
   const days=Math.max(1,Math.min(3650,Number(body.days||60)));
   const base=Math.max(Date.now(),recording.retain_until?new Date(recording.retain_until).getTime():Date.now());
   const retainUntil=new Date(base+days*86400000).toISOString();
   const {error}=await auth.admin.from("zoom_recordings").update({retain_until:retainUntil,updated_at:new Date().toISOString()}).eq("id",recording.id);
   if(error)throw new Error(error.message);return NextResponse.json({ok:true,retainUntil});
  }
  if(body.action==="delete"){
   if(recording.protected_from_deletion)throw new Error("This recording is protected. Remove protection before deleting it.");
   await zoomApi(meeting.host_account_id,`/meetings/${encodeURIComponent(meeting.zoom_meeting_id)}/recordings/${encodeURIComponent(recording.zoom_recording_file_id)}?action=trash`,{method:"DELETE"});
   const {error}=await auth.admin.from("zoom_recordings").update({status:"deleted",deleted_from_zoom_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",recording.id);
   if(error)throw new Error(error.message);return NextResponse.json({ok:true,status:"deleted"});
  }
  throw new Error("Unsupported recording action.");
 }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:String(error)},{status:400});}
}
